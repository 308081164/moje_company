"""
逐步调试流水线：对齐 / 融合各阶段单步执行。
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

DEBUG_STEP_IDS: List[str] = [
    "prepare",
    "inlay_sanitize",
    "ai_sanitize",
    "ai_cad_reverse",
    "ai_part_split",
    "ai_inlay_detect",
    "size_align",
    "align_coarse",
    "align_icp",
    "align_refine",
    "gap_close",
    "crop",
    "colored_merge",
]

STEP_DEFINITIONS: List[Dict[str, str]] = [
    {
        "id": "prepare",
        "name": "准备输入",
        "operation": "校验 raw_mesh 与镶嵌底座文件，记录网格 bbox 与顶点数。",
        "expected": "文件可读、顶点数 > 0，可在预览区看到 AI 白模。",
    },
    {
        "id": "inlay_sanitize",
        "name": "镶嵌底座清洗",
        "operation": "sanitize_mesh：去除浮渣并选取主 CAD 装配体。",
        "expected": "清洗后镶嵌结构完整、无多余碎片。",
    },
    {
        "id": "ai_sanitize",
        "name": "AI 白模清洗",
        "operation": "sanitize_mesh：去除 AI 生成浮渣/孤立碎片，保留主戒圈装配体。",
        "expected": "清洗后戒圈与镶口主体完整，无孔内杂线或游离几何。",
    },
    {
        "id": "ai_cad_reverse",
        "name": "CAD 曲面逆向",
        "operation": "Ultra 模式 mesh → 分区 B-spline 拟合 → STEP AP214，输出 cad_fit_report.json。",
        "expected": "STEP 可导入 Rhino；score_0_100 与 max_deviation_mm 在报告内可查。",
    },
    {
        "id": "ai_part_split",
        "name": "AI 拆件",
        "operation": "按戒圈/戒头拆分 AI 白模（连通分量或环带启发式），输出分色预览与部件 mask。",
        "expected": "戒圈（蓝）与戒头（琥珀）区域完整、边界清晰；未启用时本步自动跳过。",
    },
    {
        "id": "ai_inlay_detect",
        "name": "AI 镶嵌结构识别",
        "operation": "比对导入镶嵌 setting/shank 包络，在 AI 主体上识别对应结构并标红。",
        "expected": "红色区域覆盖 AI 戒头/镶口与戒圈座位，便于确认识别是否正确。",
    },
    {
        "id": "size_align",
        "name": "轮廓尺寸对齐",
        "operation": "角度剖面互相关 + 戒圈/镶口包络比对，统一缩放 AI 白模（禁止 overlap）。",
        "expected": "diam_ratio 接近 1.0，volume_ratio ≥ 1.0，inlay_overlap 升高且 AI 不被镶嵌吞没。",
    },
    {
        "id": "align_coarse",
        "name": "粗对齐",
        "operation": "CASA / ring_frame 粗对齐（不含 ICP），含 overlap 与轴修正。",
        "expected": "AI 与镶嵌共心、尺度接近，up_cos ≥ 0.25。",
    },
    {
        "id": "align_icp",
        "name": "ICP 精修",
        "operation": "仅对戒圈 shank 做 ICP，并通过姿态/重叠门控决定是否采纳。",
        "expected": "shank 距离改善且戒头未翻转。",
    },
    {
        "id": "align_refine",
        "name": "Overlap + Rescue",
        "operation": "overlap 精修与 alignment rescue，修正直径漂移与头朝下。",
        "expected": "overlap ≥ 80%，姿态指标正常。",
    },
    {
        "id": "gap_close",
        "name": "接口贴合",
        "operation": "close_ai_inlay_interface_gap：缩小 AI 与镶口接触缝隙。",
        "expected": "setting_median 下降，接触面无明显缝隙。",
    },
    {
        "id": "crop",
        "name": "AI 裁剪",
        "operation": "crop_overlapping_ai_body：裁切与镶嵌重叠的 AI 面片。",
        "expected": "AI 主体与爪位/戒圈几何贴合。",
    },
    {
        "id": "colored_merge",
        "name": "分色合并",
        "operation": "export_colored_dual_mesh：琥珀镶嵌 + 蓝色 AI 双网格 GLB。",
        "expected": "分色预览共心、尺度一致，可直接用于验收。",
    },
]


@dataclass
class DebugPipelineContext:
    session_id: str
    source_task_id: str
    output_dir: str
    raw_mesh_path: str
    inlay_mesh_path: str
    user_fmt: str = "glb"
    enable_icp: bool = True
    enable_ai_part_split: bool = False
    cleaned_inlay_path: Optional[str] = None
    cleaned_ai_path: Optional[str] = None
    ai_part_split_path: Optional[str] = None
    ai_part_split_info: Optional[Dict[str, Any]] = None
    ai_shank_vertex_mask_path: Optional[str] = None
    ai_setting_vertex_mask_path: Optional[str] = None
    ai_inlay_detect_path: Optional[str] = None
    ai_inlay_detect_info: Optional[Dict[str, Any]] = None
    size_aligned_mesh_path: Optional[str] = None
    size_align_info: Optional[Dict[str, Any]] = None
    size_align_transform: Optional[np.ndarray] = None
    src_tmp: Optional[str] = None
    shank_tmp: Optional[str] = None
    target_mesh_path: Optional[str] = None
    transform: Optional[np.ndarray] = None
    align_info: Dict[str, Any] = field(default_factory=dict)
    aligned_mesh_path: Optional[str] = None
    current_ai_path: Optional[str] = None
    full_ring_inlay: bool = False
    full_ring_reason: Optional[str] = None
    pre_gap_stats: Optional[Dict[str, Any]] = None
    crop_info: Optional[Dict[str, Any]] = None

    def state_path(self) -> str:
        return os.path.join(self.output_dir, "debug_context.json")

    def save(self) -> None:
        os.makedirs(self.output_dir, exist_ok=True)
        data = asdict(self)
        if self.transform is not None:
            t_path = os.path.join(self.output_dir, "transform.npy")
            np.save(t_path, self.transform)
            data["transform"] = t_path
        else:
            data["transform"] = None
        if self.size_align_transform is not None:
            t_path = os.path.join(self.output_dir, "size_align_transform.npy")
            np.save(t_path, self.size_align_transform)
            data["size_align_transform"] = t_path
        else:
            data["size_align_transform"] = None
        with open(self.state_path(), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    @classmethod
    def load(cls, path: str) -> "DebugPipelineContext":
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        t_ref = data.pop("transform", None)
        t_size = data.pop("size_align_transform", None)
        valid = {f.name for f in cls.__dataclass_fields__.values()}
        filtered = {k: v for k, v in data.items() if k in valid}
        ctx = cls(**filtered)
        if t_ref and os.path.isfile(t_ref):
            ctx.transform = np.load(t_ref)
        if t_size and os.path.isfile(t_size):
            ctx.size_align_transform = np.load(t_size)
        return ctx


def _ai_source_path(ctx: DebugPipelineContext) -> str:
    return (
        ctx.size_aligned_mesh_path
        or ctx.current_ai_path
        or ctx.cleaned_ai_path
        or ctx.raw_mesh_path
    )


def _ai_mesh_path_for_align(ctx: DebugPipelineContext) -> str:
    """AI mesh before size/align transforms (post sanitize)."""
    return ctx.cleaned_ai_path or ctx.raw_mesh_path


def _step_result(
    step_id: str,
    *,
    success: bool,
    preview_path: Optional[str],
    preview_mode: str,
    metrics: Optional[Dict[str, Any]] = None,
    artifacts: Optional[Dict[str, str]] = None,
    message: str = "",
) -> Dict[str, Any]:
    return {
        "step_id": step_id,
        "success": success,
        "preview_path": preview_path,
        "preview_mode": preview_mode,
        "metrics": metrics or {},
        "artifacts": artifacts or {},
        "message": message,
    }


def _preview_colored(processor, ctx: DebugPipelineContext, step_id: str) -> str:
    from app.utils.file_utils import generate_output_path

    inlay = ctx.cleaned_inlay_path or ctx.inlay_mesh_path
    ai_path = (
        ctx.current_ai_path
        or ctx.aligned_mesh_path
        or ctx.size_aligned_mesh_path
        or ctx.cleaned_ai_path
        or ctx.raw_mesh_path
    )
    out = generate_output_path(ctx.output_dir, ctx.session_id, f"debug_preview_{step_id}.glb")
    processor.export_colored_dual_mesh(
        inlay_mesh_path=inlay,
        generated_mesh_path=ai_path,
        output_path=out,
        output_format="glb",
    )
    return out


def _alignment_metrics(processor, ctx: DebugPipelineContext) -> Dict[str, Any]:
    info = ctx.align_info or {}
    fq = info.get("final_quality") or {}
    metrics = {
        "overlap": info.get("inlay_overlap_ratio"),
        "up_cos": fq.get("up_cos"),
        "diam_ratio": fq.get("diam_ratio"),
        "setting_median": fq.get("setting_median"),
        "shank_median": fq.get("shank_median"),
        "method": info.get("method"),
        "icp_fitness": info.get("icp_fitness"),
    }
    if ctx.transform is not None and ctx.target_mesh_path:
        try:
            target = processor._load_trimesh_mesh(ctx.target_mesh_path)
            source = processor._load_trimesh_mesh(ctx.raw_mesh_path)
            shank, setting = processor._split_shank_and_setting(target)
            fi = processor._estimate_ring_frame(shank)
            up = processor._geometric_setting_up(fi, setting)
            if up is None:
                up = processor._detect_setting_up(target, fi)
            frame = processor._frame_with_up(fi, up)
            full_ring, _ = processor._detect_full_ring_inlay_mode(target, frame)
            pose = processor._eval_alignment_pose_metrics(
                source, target, shank, setting, frame, ctx.transform, full_ring=full_ring
            )
            metrics.update(
                {
                    "overlap": pose.get("overlap"),
                    "up_cos": pose.get("up_cos"),
                    "diam_ratio": pose.get("diam_ratio"),
                    "setting_median": pose.get("setting_median"),
                    "center_dist": pose.get("center_dist"),
                }
            )
        except Exception as e:
            logger.debug("alignment metrics probe skipped: %s", e)
    return {k: v for k, v in metrics.items() if v is not None}


def debug_step_prepare(processor, ctx: DebugPipelineContext) -> Dict[str, Any]:
    from app.utils.file_utils import generate_output_path

    if not os.path.isfile(ctx.raw_mesh_path):
        return _step_result(
            "prepare",
            success=False,
            preview_path=None,
            preview_mode="white",
            message=f"raw_mesh 不存在: {ctx.raw_mesh_path}",
        )
    if not os.path.isfile(ctx.inlay_mesh_path):
        return _step_result(
            "prepare",
            success=False,
            preview_path=None,
            preview_mode="white",
            message=f"镶嵌底座不存在: {ctx.inlay_mesh_path}",
        )
    ai_info = processor.analyze_mesh(ctx.raw_mesh_path)
    inlay_info = processor.analyze_mesh(ctx.inlay_mesh_path)
    if ai_info.get("vertices", 0) <= 0:
        return _step_result(
            "prepare",
            success=False,
            preview_path=None,
            preview_mode="white",
            message="AI 网格顶点数为 0",
        )
    ctx.current_ai_path = ctx.raw_mesh_path
    preview = generate_output_path(ctx.output_dir, ctx.session_id, "debug_preview_prepare.glb")
    processor.convert_format(ctx.raw_mesh_path, preview, "glb")
    ctx.save()
    return _step_result(
        "prepare",
        success=True,
        preview_path=preview,
        preview_mode="white",
        metrics={"ai": ai_info, "inlay": inlay_info},
        artifacts={"raw_mesh": ctx.raw_mesh_path, "inlay": ctx.inlay_mesh_path},
        message="输入校验通过",
    )


def debug_step_inlay_sanitize(processor, ctx: DebugPipelineContext) -> Dict[str, Any]:
    from app.utils.file_utils import generate_output_path

    out = generate_output_path(ctx.output_dir, ctx.session_id, "inlay_clean.glb")
    cleaned, info = processor.sanitize_mesh(ctx.inlay_mesh_path, out, select_primary=True)
    ctx.cleaned_inlay_path = cleaned
    ctx.target_mesh_path = cleaned
    preview = generate_output_path(ctx.output_dir, ctx.session_id, "debug_preview_inlay_sanitize.glb")
    processor.convert_format(cleaned, preview, "glb")
    ctx.save()
    return _step_result(
        "inlay_sanitize",
        success=True,
        preview_path=preview,
        preview_mode="white",
        metrics={"sanitize": info},
        artifacts={"cleaned_inlay": cleaned},
        message="镶嵌底座清洗完成",
    )


def debug_step_ai_sanitize(processor, ctx: DebugPipelineContext) -> Dict[str, Any]:
    from app.utils.file_utils import generate_output_path

    out = generate_output_path(ctx.output_dir, ctx.session_id, "ai_clean.glb")
    try:
        cleaned, info = processor.sanitize_mesh(
            ctx.raw_mesh_path, out, select_primary=True
        )
        ctx.cleaned_ai_path = cleaned
        ctx.current_ai_path = cleaned
        preview = generate_output_path(
            ctx.output_dir, ctx.session_id, "debug_preview_ai_sanitize.glb"
        )
        processor.convert_format(cleaned, preview, "glb")
        ctx.save()
        return _step_result(
            "ai_sanitize",
            success=True,
            preview_path=preview,
            preview_mode="white",
            metrics={"sanitize": info},
            artifacts={"cleaned_ai": cleaned},
            message="AI 白模清洗完成",
        )
    except Exception as e:
        logger.exception("ai_sanitize failed")
        return _step_result(
            "ai_sanitize",
            success=False,
            preview_path=None,
            preview_mode="white",
            message=str(e),
        )


def debug_step_ai_cad_reverse(processor, ctx: DebugPipelineContext) -> Dict[str, Any]:
    from app.config import _load_ultra_cad_config
    from app.services.cad_reverse import cad_reverse_mesh
    from app.services.cad_reverse.surface_fit import occ_available
    from app.utils.file_utils import generate_output_path

    ai_src = ctx.cleaned_ai_path or ctx.current_ai_path or ctx.raw_mesh_path
    if not ai_src or not os.path.isfile(ai_src):
        return _step_result(
            "ai_cad_reverse",
            success=False,
            preview_path=None,
            preview_mode="white",
            message="无可用 AI mesh",
        )

    ultra_cad = _load_ultra_cad_config()
    if not ultra_cad.enabled or not occ_available():
        reason = "ULTRA_CAD_ENABLED=0" if not ultra_cad.enabled else "pythonocc_not_available"
        return _step_result(
            "ai_cad_reverse",
            success=True,
            preview_path=ai_src,
            preview_mode="white",
            metrics={"skipped": True, "reason": reason, "occ_available": occ_available()},
            message="CAD 逆向已跳过（环境不可用）",
        )

    try:
        result = cad_reverse_mesh(
            ai_src,
            ctx.output_dir,
            ctx.session_id,
            ultra_cad=ultra_cad,
        )
        preview = generate_output_path(
            ctx.output_dir, ctx.session_id, "debug_preview_ai_cad_reverse.glb"
        )
        processor.convert_format(ai_src, preview, "glb")
        ctx.save()
        metrics = {
            k: result.get(k)
            for k in (
                "success",
                "score_0_100",
                "max_deviation_mm",
                "surface_count",
                "primitive_ratio",
                "quality_passed",
                "occ_available",
                "warning",
                "error",
            )
            if result.get(k) is not None
        }
        artifacts = {}
        if result.get("step_path"):
            artifacts["cad_step"] = result["step_path"]
        if result.get("report_path"):
            artifacts["cad_fit_report"] = result["report_path"]
        return _step_result(
            "ai_cad_reverse",
            success=bool(result.get("success")),
            preview_path=preview if os.path.isfile(preview) else ai_src,
            preview_mode="white",
            metrics=metrics,
            artifacts=artifacts,
            message="CAD 逆向完成" if result.get("success") else result.get("error", "CAD 逆向失败"),
        )
    except Exception as e:
        logger.exception("ai_cad_reverse failed")
        return _step_result(
            "ai_cad_reverse",
            success=False,
            preview_path=None,
            preview_mode="white",
            message=str(e),
        )


def _load_vertex_mask(path: Optional[str]) -> Optional[np.ndarray]:
    if path and os.path.isfile(path):
        return np.asarray(np.load(path), dtype=bool)
    return None


def debug_step_ai_part_split(processor, ctx: DebugPipelineContext) -> Dict[str, Any]:
    from app.utils.file_utils import generate_output_path

    ai_src = _ai_mesh_path_for_align(ctx)
    if not ctx.enable_ai_part_split:
        ctx.ai_part_split_info = {"skipped": True, "reason": "disabled"}
        ctx.save()
        preview = generate_output_path(
            ctx.output_dir, ctx.session_id, "debug_preview_ai_part_split.glb"
        )
        if os.path.isfile(ai_src):
            processor.convert_format(ai_src, preview, "glb")
        return _step_result(
            "ai_part_split",
            success=True,
            preview_path=preview if os.path.isfile(preview) else ai_src,
            preview_mode="white",
            metrics={"skipped": True, "reason": "disabled"},
            message="已跳过 AI 拆件（未启用）",
        )
    preview = generate_output_path(
        ctx.output_dir, ctx.session_id, "debug_preview_ai_part_split.glb"
    )
    try:
        out_path, info = processor.export_ai_part_split_preview(ai_src, preview)
        shank_mask = info.pop("_shank_mask", None)
        setting_mask = info.pop("_setting_mask", None)
        shank_path = os.path.join(ctx.output_dir, "ai_shank_vertex_mask.npy")
        setting_path = os.path.join(ctx.output_dir, "ai_setting_vertex_mask.npy")
        if shank_mask is not None:
            np.save(shank_path, np.asarray(shank_mask, dtype=bool))
            ctx.ai_shank_vertex_mask_path = shank_path
        if setting_mask is not None:
            np.save(setting_path, np.asarray(setting_mask, dtype=bool))
            ctx.ai_setting_vertex_mask_path = setting_path
        ctx.ai_part_split_path = out_path
        ctx.ai_part_split_info = info
        ctx.save()
        return _step_result(
            "ai_part_split",
            success=True,
            preview_path=out_path,
            preview_mode="colored",
            metrics={
                "method": info.get("method"),
                "n_shank": info.get("n_shank"),
                "n_setting": info.get("n_setting"),
                "n_components": info.get("n_components"),
            },
            artifacts={"ai_part_split": out_path},
            message=(
                f"AI 拆件完成：戒圈 {info.get('n_shank', 0)} 顶点，"
                f"戒头 {info.get('n_setting', 0)} 顶点"
            ),
        )
    except Exception as e:
        logger.exception("ai_part_split failed")
        return _step_result(
            "ai_part_split",
            success=False,
            preview_path=None,
            preview_mode="colored",
            message=str(e),
        )


def debug_step_ai_inlay_detect(processor, ctx: DebugPipelineContext) -> Dict[str, Any]:
    from app.utils.file_utils import generate_output_path

    ai_src = _ai_mesh_path_for_align(ctx)
    preview = generate_output_path(
        ctx.output_dir, ctx.session_id, "debug_preview_ai_inlay_detect.glb"
    )
    shank_mask = _load_vertex_mask(ctx.ai_shank_vertex_mask_path)
    setting_mask = _load_vertex_mask(ctx.ai_setting_vertex_mask_path)
    try:
        out_path, info = processor.export_ai_inlay_detect_preview(
            ai_src,
            ctx.inlay_mesh_path,
            preview,
            cleaned_inlay_path=ctx.cleaned_inlay_path,
            ai_part_split_info=ctx.ai_part_split_info,
            ai_shank_mask=shank_mask,
            ai_setting_mask=setting_mask,
        )
        ctx.ai_inlay_detect_path = out_path
        ctx.ai_inlay_detect_info = info
        ctx.save()
        return _step_result(
            "ai_inlay_detect",
            success=True,
            preview_path=out_path,
            preview_mode="colored",
            metrics={
                "n_detected": info.get("n_detected"),
                "detect_ratio": info.get("detect_ratio"),
                "profile_peak": info.get("profile_peak"),
                "roll_hint_deg": info.get("roll_hint_deg"),
                "detect_method": info.get("detect_method"),
                "nricp_success": info.get("nricp_success"),
                "label_transfer_ratio": info.get("label_transfer_ratio"),
            },
            artifacts={"ai_inlay_detect": out_path},
            message=(
                f"识别 AI 镶嵌对应结构 {info.get('n_detected', 0)} 顶点 "
                f"({float(info.get('detect_ratio', 0)) * 100:.1f}%)"
            ),
        )
    except Exception as e:
        logger.exception("ai_inlay_detect failed")
        return _step_result(
            "ai_inlay_detect",
            success=False,
            preview_path=None,
            preview_mode="white",
            message=str(e),
        )


def debug_step_size_align(processor, ctx: DebugPipelineContext) -> Dict[str, Any]:
    from app.utils.file_utils import generate_output_path

    inlay = ctx.cleaned_inlay_path or ctx.inlay_mesh_path
    ai_src = _ai_mesh_path_for_align(ctx)
    try:
        out_path, info, M = processor.apply_size_alignment(
            ai_src,
            ctx.inlay_mesh_path,
            ctx.cleaned_inlay_path,
            ctx.output_dir,
            ctx.session_id,
            output_format=ctx.user_fmt,
            inlay_detect_info=ctx.ai_inlay_detect_info,
        )
        ctx.size_aligned_mesh_path = out_path
        ctx.current_ai_path = out_path
        ctx.size_align_info = info
        ctx.size_align_transform = M
        preview = _preview_colored(processor, ctx, "size_align")
        ctx.save()
        metrics = dict(info.get("final_metrics") or {})
        metrics.update(
            {
                "scale_final": info.get("scale_final"),
                "diam_ratio": info.get("diam_ratio"),
                "peak_ratio": info.get("peak_ratio"),
                "shank_annular_gap_mm": info.get("shank_annular_gap_mm"),
                "setting_height_ratio": info.get("setting_height_ratio"),
                "volume_ratio": info.get("volume_ratio"),
                "inlay_overlap_ratio": info.get("inlay_overlap_ratio"),
                "ai_containment_ratio": info.get("ai_containment_ratio"),
            }
        )
        return _step_result(
            "size_align",
            success=True,
            preview_path=preview,
            preview_mode="colored",
            metrics=metrics,
            artifacts={"size_aligned": out_path},
            message=(
                f"轮廓尺寸对齐完成 scale={info.get('scale_final', 1.0):.4f} "
                f"diam_ratio={info.get('diam_ratio', 0):.3f}"
            ),
        )
    except Exception as e:
        logger.exception("size_align failed")
        return _step_result(
            "size_align",
            success=False,
            preview_path=None,
            preview_mode="colored",
            message=str(e),
        )


def debug_step_align_coarse(processor, ctx: DebugPipelineContext) -> Dict[str, Any]:
    from app.utils.file_utils import generate_output_path

    inlay = ctx.cleaned_inlay_path or ctx.inlay_mesh_path
    ai_src = _ai_source_path(ctx)
    aligned_out = generate_output_path(ctx.output_dir, ctx.session_id, f"aligned.{ctx.user_fmt}")
    try:
        workspace = processor._debug_init_alignment_workspace(
            ai_src, inlay, aligned_out
        )
        transform, info = processor._debug_compute_coarse_transform(
            workspace["source"],
            workspace["target"],
            workspace,
            skip_overlap_refine=bool(ctx.size_aligned_mesh_path),
        )
        ctx.transform = transform
        ctx.align_info = info
        ctx.src_tmp = workspace["src_tmp"]
        ctx.shank_tmp = workspace["shank_tmp"]
        ctx.target_mesh_path = workspace["target_path_for_icp"]
        processor._apply_trimesh_transform(workspace["src_tmp"], transform, aligned_out)
        ctx.aligned_mesh_path = aligned_out
        ctx.current_ai_path = aligned_out
        fq = info.get("final_quality")
        if not fq:
            processor._debug_update_final_quality(workspace, transform, info, aligned_out)
        preview = _preview_colored(processor, ctx, "align_coarse")
        ctx.save()
        return _step_result(
            "align_coarse",
            success=True,
            preview_path=preview,
            preview_mode="colored",
            metrics=_alignment_metrics(processor, ctx),
            artifacts={"aligned": aligned_out},
            message=f"粗对齐完成 (method={info.get('method')})",
        )
    except Exception as e:
        logger.exception("align_coarse failed")
        return _step_result(
            "align_coarse",
            success=False,
            preview_path=None,
            preview_mode="colored",
            message=str(e),
        )


def debug_step_align_icp(processor, ctx: DebugPipelineContext) -> Dict[str, Any]:
    if ctx.transform is None or not ctx.src_tmp:
        return _step_result(
            "align_icp",
            success=False,
            preview_path=None,
            preview_mode="colored",
            message="请先完成粗对齐步骤",
        )
    from app.utils.file_utils import generate_output_path

    aligned_out = ctx.aligned_mesh_path or generate_output_path(
        ctx.output_dir, ctx.session_id, f"aligned.{ctx.user_fmt}"
    )
    try:
        workspace = processor._debug_restore_alignment_workspace(ctx, aligned_out)
        transform, info = processor._debug_apply_icp_phase(
            workspace,
            ctx.transform,
            ctx.align_info,
            enable_icp=ctx.enable_icp,
        )
        ctx.transform = transform
        ctx.align_info = info
        processor._apply_trimesh_transform(ctx.src_tmp, transform, aligned_out)
        ctx.aligned_mesh_path = aligned_out
        ctx.current_ai_path = aligned_out
        processor._debug_update_final_quality(workspace, transform, info, aligned_out)
        preview = _preview_colored(processor, ctx, "align_icp")
        ctx.save()
        return _step_result(
            "align_icp",
            success=True,
            preview_path=preview,
            preview_mode="colored",
            metrics=_alignment_metrics(processor, ctx),
            artifacts={"aligned": aligned_out},
            message=f"ICP 阶段完成 (accepted={info.get('method', '').endswith('+icp')})",
        )
    except Exception as e:
        logger.exception("align_icp failed")
        return _step_result(
            "align_icp",
            success=False,
            preview_path=None,
            preview_mode="colored",
            message=str(e),
        )


def debug_step_align_refine(processor, ctx: DebugPipelineContext) -> Dict[str, Any]:
    if ctx.transform is None or not ctx.src_tmp:
        return _step_result(
            "align_refine",
            success=False,
            preview_path=None,
            preview_mode="colored",
            message="请先完成 ICP 步骤",
        )
    aligned_out = ctx.aligned_mesh_path
    try:
        workspace = processor._debug_restore_alignment_workspace(ctx, aligned_out)
        transform, info = processor._debug_apply_refine_rescue_phase(
            workspace, ctx.transform, ctx.align_info
        )
        ctx.transform = transform
        ctx.align_info = info
        processor._apply_trimesh_transform(ctx.src_tmp, transform, aligned_out)
        ctx.current_ai_path = aligned_out
        processor._debug_update_final_quality(workspace, transform, info, aligned_out)
        preview = _preview_colored(processor, ctx, "align_refine")
        ctx.save()
        return _step_result(
            "align_refine",
            success=True,
            preview_path=preview,
            preview_mode="colored",
            metrics=_alignment_metrics(processor, ctx),
            artifacts={"aligned": aligned_out},
            message="Overlap + Rescue 完成",
        )
    except Exception as e:
        logger.exception("align_refine failed")
        return _step_result(
            "align_refine",
            success=False,
            preview_path=None,
            preview_mode="colored",
            message=str(e),
        )


def debug_step_gap_close(processor, ctx: DebugPipelineContext) -> Dict[str, Any]:
    from app.utils.file_utils import generate_output_path

    inlay = ctx.cleaned_inlay_path or ctx.inlay_mesh_path
    ai_in = ctx.current_ai_path or ctx.aligned_mesh_path
    if not ai_in:
        return _step_result(
            "gap_close",
            success=False,
            preview_path=None,
            preview_mode="white",
            message="缺少对齐后的 AI 网格",
        )
    try:
        inlay_probe = processor._load_trimesh_mesh(inlay)
        full_ring, fr_reason = processor._detect_full_ring_inlay_mode(inlay_probe)
        ctx.full_ring_inlay = full_ring
        ctx.full_ring_reason = fr_reason
        if full_ring:
            ctx.save()
            preview = processor.convert_format(
                ai_in,
                generate_output_path(ctx.output_dir, ctx.session_id, "debug_preview_gap_close.glb"),
                "glb",
            )
            return _step_result(
                "gap_close",
                success=True,
                preview_path=preview,
                preview_mode="white",
                metrics={"skipped": True, "reason": "full_ring_envelope_pipeline"},
                message="全戒模式跳过 gap close",
            )
        align_info = ctx.align_info or {}
        ring_info = align_info.get("ring") or {}
        fq = align_info.get("final_quality") or {}
        set_hint = fq.get("setting_median") or ring_info.get("setting_median")
        diam_hint = ring_info.get("tgt_diameter") or ring_info.get("src_diameter")
        out = generate_output_path(ctx.output_dir, ctx.session_id, f"ai_pre_gap.{ctx.user_fmt}")
        out, stats = processor.close_ai_inlay_interface_gap(
            ai_in,
            inlay,
            out,
            setting_median_hint=set_hint,
            inlay_diameter_hint=diam_hint,
        )
        ctx.pre_gap_stats = stats
        if stats.get("success"):
            ctx.current_ai_path = out
        preview = processor.convert_format(
            ctx.current_ai_path,
            generate_output_path(ctx.output_dir, ctx.session_id, "debug_preview_gap_close.glb"),
            "glb",
        )
        ctx.save()
        return _step_result(
            "gap_close",
            success=True,
            preview_path=preview,
            preview_mode="white",
            metrics={"gap_close": stats},
            artifacts={"ai_mesh": ctx.current_ai_path},
            message="接口贴合完成" if stats.get("success") else "未检测到需贴合的缝隙",
        )
    except Exception as e:
        logger.exception("gap_close failed")
        return _step_result(
            "gap_close",
            success=False,
            preview_path=None,
            preview_mode="white",
            message=str(e),
        )


def debug_step_crop(processor, ctx: DebugPipelineContext) -> Dict[str, Any]:
    from app.utils.file_utils import generate_output_path

    inlay = ctx.cleaned_inlay_path or ctx.inlay_mesh_path
    ai_in = ctx.current_ai_path or ctx.aligned_mesh_path
    if not ai_in:
        return _step_result(
            "crop",
            success=False,
            preview_path=None,
            preview_mode="white",
            message="缺少 AI 网格",
        )
    if ctx.full_ring_inlay:
        preview = processor.convert_format(
            ai_in,
            generate_output_path(ctx.output_dir, ctx.session_id, "debug_preview_crop.glb"),
            "glb",
        )
        ctx.save()
        return _step_result(
            "crop",
            success=True,
            preview_path=preview,
            preview_mode="white",
            metrics={"skipped": True, "reason": "full_ring_envelope_pipeline"},
            message="全戒模式跳过裁剪",
        )
    try:
        align_info = ctx.align_info or {}
        ring_info = align_info.get("ring") or {}
        fq = align_info.get("final_quality") or {}
        set_hint = fq.get("setting_median") or ring_info.get("setting_median")
        diam_hint = ring_info.get("tgt_diameter") or ring_info.get("src_diameter")
        pre_gap = ctx.pre_gap_stats or {}
        overlap_only = bool(pre_gap.get("success"))
        if overlap_only and pre_gap.get("setting_median_after") is not None:
            set_hint = pre_gap.get("setting_median_after")
        out = generate_output_path(ctx.output_dir, ctx.session_id, f"ai_replaced.{ctx.user_fmt}")
        out, crop_info = processor.crop_overlapping_ai_body(
            ai_in,
            inlay,
            out,
            setting_median_hint=set_hint,
            inlay_diameter_hint=diam_hint,
            overlap_only=overlap_only,
        )
        ctx.crop_info = crop_info
        if not crop_info.get("skipped"):
            ctx.current_ai_path = out
        preview = processor.convert_format(
            ctx.current_ai_path,
            generate_output_path(ctx.output_dir, ctx.session_id, "debug_preview_crop.glb"),
            "glb",
        )
        ctx.save()
        return _step_result(
            "crop",
            success=True,
            preview_path=preview,
            preview_mode="white",
            metrics={"crop": crop_info},
            artifacts={"ai_mesh": ctx.current_ai_path},
            message="AI 裁剪完成" if not crop_info.get("skipped") else "裁剪已跳过",
        )
    except Exception as e:
        logger.exception("crop failed")
        return _step_result(
            "crop",
            success=False,
            preview_path=None,
            preview_mode="white",
            message=str(e),
        )


def debug_step_colored_merge(processor, ctx: DebugPipelineContext) -> Dict[str, Any]:
    from app.utils.file_utils import generate_output_path

    inlay = ctx.cleaned_inlay_path or ctx.inlay_mesh_path
    ai_in = ctx.current_ai_path or ctx.aligned_mesh_path
    if not ai_in:
        return _step_result(
            "colored_merge",
            success=False,
            preview_path=None,
            preview_mode="colored",
            message="缺少 AI 网格",
        )
    try:
        colored = generate_output_path(ctx.output_dir, ctx.session_id, "colored.glb")
        processor.export_colored_dual_mesh(
            inlay_mesh_path=inlay,
            generated_mesh_path=ai_in,
            output_path=colored,
            output_format="glb",
        )
        final = generate_output_path(ctx.output_dir, ctx.session_id, "final.glb")
        processor._export_preserving_scene(colored, final, "glb")
        ctx.save()
        return _step_result(
            "colored_merge",
            success=True,
            preview_path=final,
            preview_mode="colored",
            metrics=_alignment_metrics(processor, ctx),
            artifacts={"colored": colored, "final": final},
            message="分色合并完成",
        )
    except Exception as e:
        logger.exception("colored_merge failed")
        return _step_result(
            "colored_merge",
            success=False,
            preview_path=None,
            preview_mode="colored",
            message=str(e),
        )


DEBUG_STEP_RUNNERS = {
    "prepare": debug_step_prepare,
    "inlay_sanitize": debug_step_inlay_sanitize,
    "ai_sanitize": debug_step_ai_sanitize,
    "ai_cad_reverse": debug_step_ai_cad_reverse,
    "ai_part_split": debug_step_ai_part_split,
    "ai_inlay_detect": debug_step_ai_inlay_detect,
    "size_align": debug_step_size_align,
    "align_coarse": debug_step_align_coarse,
    "align_icp": debug_step_align_icp,
    "align_refine": debug_step_align_refine,
    "gap_close": debug_step_gap_close,
    "crop": debug_step_crop,
    "colored_merge": debug_step_colored_merge,
}


def run_debug_step(processor, ctx: DebugPipelineContext, step_id: str) -> Dict[str, Any]:
    runner = DEBUG_STEP_RUNNERS.get(step_id)
    if runner is None:
        raise ValueError(f"unknown debug step: {step_id}")
    return runner(processor, ctx)
