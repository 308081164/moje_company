"""
网格后处理模块
提供ICP点云对齐、SDF布尔融合、拓扑修复等功能
使用 trimesh 和 open3d 库
"""

import os
import logging
import numpy as np
from typing import Optional, Tuple, Dict, Any, List, Union

logger = logging.getLogger(__name__)

# 镶嵌底座 / AI 生成主体 分色（RGBA 0-255）
INLAY_REGION_COLOR = (230, 162, 60, 255)      # 琥珀色：引用镶嵌结构区域
GENERATED_REGION_COLOR = (64, 158, 255, 255)  # 蓝色：AI 生成主体区域


class MeshProcessor:
    """
    网格后处理器
    负责网格的对齐、融合和修复
    """

    def __init__(self):
        """初始化网格处理器"""
        self._open3d_available = False
        self._trimesh_available = False
        self._check_dependencies()

    def _check_dependencies(self):
        """检查依赖库是否可用"""
        try:
            import open3d as o3d
            self._open3d_available = True
            logger.info("Open3D 已加载")
        except ImportError:
            logger.warning("Open3D 未安装，ICP对齐功能将不可用。安装: pip install open3d")

        try:
            import trimesh
            self._trimesh_available = True
            logger.info("Trimesh 已加载")
        except ImportError:
            logger.warning("Trimesh 未安装，网格处理功能将不可用。安装: pip install trimesh")

    @property
    def is_ready(self) -> bool:
        """检查处理器是否就绪"""
        return self._trimesh_available

    @staticmethod
    def _mesh_vertex_count(mesh) -> int:
        return len(mesh.vertices) if mesh is not None and hasattr(mesh, "vertices") else 0

    @staticmethod
    def _is_valid_output_file(path: str, min_bytes: int = 128) -> bool:
        try:
            return os.path.isfile(path) and os.path.getsize(path) >= min_bytes
        except OSError:
            return False


    @staticmethod
    def _log_mesh_extents(label: str, mesh) -> None:
        """Log mesh bbox extents for debugging alignment/merge issues."""
        try:
            bounds = getattr(mesh, "bounds", None)
            if bounds is None:
                logger.info("[%s] mesh has no bounds (verts=%s)", label, MeshProcessor._mesh_vertex_count(mesh))
                return
            extents = (bounds[1] - bounds[0]).tolist()
            logger.info(
                "[%s] verts=%s extents=%s bounds_min=%s bounds_max=%s",
                label,
                MeshProcessor._mesh_vertex_count(mesh),
                [round(float(x), 6) for x in extents],
                [round(float(x), 6) for x in bounds[0].tolist()],
                [round(float(x), 6) for x in bounds[1].tolist()],
            )
        except Exception as e:
            logger.warning("[%s] failed to log extents: %s", label, e)

    def _split_components(self, mesh) -> list:
        """Split mesh into connected components; never raises on failure."""
        import trimesh

        if mesh is None or self._mesh_vertex_count(mesh) == 0:
            return []
        try:
            comps = mesh.split(only_watertight=False)
            if comps is None:
                return [mesh]
            if isinstance(comps, (list, tuple)):
                return [c for c in comps if isinstance(c, trimesh.Trimesh) and len(c.faces) > 0]
            return [mesh]
        except Exception as e:
            logger.debug("mesh split failed (%s); treating as single component", e)
            return [mesh]

    def _filter_junk_components(
        self,
        mesh,
        min_faces: int = 48,
        min_vert_frac: float = 0.002,
        min_bbox_volume: float = 1e-6,
    ) -> Tuple[Any, Dict[str, Any]]:
        """
        Drop tiny floaters / helper scraps before merge.
        Returns (filtered_mesh_or_list_of_comps, stats).
        """
        import trimesh

        comps = self._split_components(mesh)
        total_v = max(self._mesh_vertex_count(mesh), 1)
        min_verts = max(24, int(total_v * min_vert_frac))
        kept = []
        for c in comps:
            if len(c.faces) < min_faces:
                continue
            if len(c.vertices) < min_verts:
                continue
            extents = np.asarray(c.bounds[1] - c.bounds[0], dtype=np.float64)
            if float(np.prod(np.maximum(extents, 0.0))) < min_bbox_volume:
                continue
            # Extremely flat near-zero thickness helpers (CAD construction grids)
            aspect = float(np.max(extents) / max(float(np.min(extents)), 1e-12))
            if aspect > 80 and len(c.faces) < 200:
                continue
            kept.append(c)

        stats = {
            "components_in": len(comps),
            "components_kept": len(kept),
            "components_dropped": max(0, len(comps) - len(kept)),
        }
        if not kept:
            logger.warning(
                "junk filter dropped all %s components; keeping original mesh",
                len(comps),
            )
            return mesh, {**stats, "fallback": "original"}
        if len(kept) == 1:
            return kept[0], stats
        return kept, stats

    def _select_primary_assembly(self, components_or_mesh) -> Tuple[Any, Dict[str, Any]]:
        """
        Jewelry CAD exports often contain 3 orthogonal copies of the same setting.
        Spatially cluster components and keep the most compact high-face cluster.
        """
        import trimesh

        if isinstance(components_or_mesh, list):
            kept = [
                c for c in components_or_mesh
                if isinstance(c, trimesh.Trimesh) and len(c.faces) > 0
            ]
        else:
            kept = self._split_components(components_or_mesh)

        if not kept:
            raise ValueError("no components available for primary assembly selection")
        if len(kept) == 1:
            return kept[0], {"clusters": 1, "selected_parts": 1, "selected_faces": len(kept[0].faces)}

        n = len(kept)
        parent = list(range(n))

        def find(i: int) -> int:
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i

        def union(a: int, b: int) -> None:
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[rb] = ra

        extents = [np.asarray(c.bounds[1] - c.bounds[0], dtype=np.float64) for c in kept]
        med = float(np.median([float(np.max(e)) for e in extents]))
        gap = max(med * 0.25, 1.0)
        bounds = [np.asarray(c.bounds, dtype=np.float64) for c in kept]
        for i in range(n):
            for j in range(i + 1, n):
                bi, bj = bounds[i], bounds[j]
                amin = bi[0] - gap
                amax = bi[1] + gap
                if np.all(amax >= bj[0]) and np.all(bj[1] >= amin):
                    union(i, j)

        clusters: Dict[int, list] = {}
        for i in range(n):
            clusters.setdefault(find(i), []).append(i)

        scored = []
        for idxs in clusters.values():
            parts = [kept[i] for i in idxs]
            faces = int(sum(len(p.faces) for p in parts))
            allv = np.vstack([np.asarray(p.vertices) for p in parts])
            bb = np.array([allv.min(axis=0), allv.max(axis=0)], dtype=np.float64)
            e = bb[1] - bb[0]
            aspect = float(np.max(e) / max(float(np.min(e)), 1e-9))
            largest = max(parts, key=lambda p: len(p.faces))
            le = np.asarray(largest.bounds[1] - largest.bounds[0], dtype=np.float64)
            large_aspect = float(np.max(le) / max(float(np.min(le)), 1e-9))
            # Prefer dense compact jewelry assembly over orthogonal CAD layout copies
            score = faces / (1.0 + 0.15 * aspect) / (1.0 + 0.25 * max(0.0, large_aspect - 2.0))
            scored.append(
                {
                    "score": score,
                    "faces": faces,
                    "parts": len(parts),
                    "aspect": aspect,
                    "large_aspect": large_aspect,
                    "center": ((bb[0] + bb[1]) * 0.5).tolist(),
                    "extents": e.tolist(),
                    "meshes": parts,
                }
            )

        scored.sort(key=lambda x: -x["score"])
        best = scored[0]
        for i, c in enumerate(scored[:6]):
            logger.info(
                "inlay cluster[%s]: faces=%s parts=%s aspect=%.2f large_aspect=%.2f score=%.1f center=%s",
                i,
                c["faces"],
                c["parts"],
                c["aspect"],
                c["large_aspect"],
                c["score"],
                [round(float(x), 3) for x in c["center"]],
            )

        parts = best["meshes"]
        out = trimesh.util.concatenate(parts) if len(parts) > 1 else parts[0]
        info = {
            "clusters": len(scored),
            "selected_parts": best["parts"],
            "selected_faces": best["faces"],
            "selected_aspect": best["aspect"],
            "cluster_gap": gap,
        }
        logger.info(
            "primary inlay assembly selected: parts=%s faces=%s aspect=%.2f (from %s clusters)",
            info["selected_parts"],
            info["selected_faces"],
            info["selected_aspect"],
            info["clusters"],
        )
        return out, info

    def sanitize_mesh(
        self,
        mesh_path: str,
        output_path: Optional[str] = None,
        select_primary: bool = True,
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Load mesh, drop junk floaters / helper scraps, optionally keep one primary
        spatial assembly (removes orthogonal CAD multi-view copies).
        """
        mesh = self._load_trimesh_mesh(mesh_path)
        filtered, junk_stats = self._filter_junk_components(mesh)
        info: Dict[str, Any] = {"junk_filter": junk_stats}

        if select_primary:
            primary, cluster_stats = self._select_primary_assembly(filtered)
            info["primary_assembly"] = cluster_stats
            mesh_out = primary
        else:
            import trimesh

            if isinstance(filtered, list):
                mesh_out = (
                    trimesh.util.concatenate(filtered)
                    if len(filtered) > 1
                    else filtered[0]
                )
            else:
                mesh_out = filtered

        if self._mesh_vertex_count(mesh_out) == 0:
            raise ValueError(f"sanitized mesh is empty: {mesh_path}")

        self._log_mesh_extents("sanitize/out", mesh_out)
        if output_path:
            os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
            ext = os.path.splitext(output_path)[1].lstrip(".").lower() or "glb"
            mesh_out.export(output_path, file_type=ext)
            if not self._is_valid_output_file(output_path):
                raise RuntimeError(f"sanitized output invalid: {output_path}")
            return output_path, info
        return mesh_path, info


    def _largest_component(self, mesh):
        """Return the connected component with the most faces."""
        comps = self._split_components(mesh)
        if not comps:
            return mesh
        return max(comps, key=lambda c: len(c.faces))

    def _estimate_ring_frame(self, mesh, n_sample: int = 12000, rng: int = 0) -> Dict[str, Any]:
        """
        Estimate torus/ring frame: hole center, torus axis (finger axis),
        median radius and a ring-likeness score.
        """
        pts = np.asarray(mesh.vertices, dtype=np.float64)
        if len(pts) == 0:
            raise ValueError("empty mesh for ring frame")
        if len(pts) > n_sample:
            idx = np.random.default_rng(rng).choice(len(pts), n_sample, replace=False)
            sample = pts[idx]
        else:
            sample = pts

        c0 = sample.mean(axis=0)
        cov = np.cov((sample - c0).T)
        eigval, eigvec = np.linalg.eigh(cov)
        order = np.argsort(eigval)[::-1]
        axes = eigvec[:, order]

        best: Optional[Dict[str, Any]] = None
        for i in range(3):
            axis = axes[:, i]
            axis = axis / (np.linalg.norm(axis) + 1e-12)
            d = (sample - c0) @ axis
            radial = sample - c0 - np.outer(d, axis)
            r = np.linalg.norm(radial, axis=1)
            r_floor = float(np.percentile(r, 15))
            r_med = float(np.median(r[r > r_floor])) if np.any(r > r_floor) else float(np.median(r))
            mask = (r > r_med * 0.45) & (r < r_med * 1.55)
            r_std = float(np.std(r[mask])) if int(mask.sum()) > 20 else 1e9
            thick = float(np.percentile(np.abs(d), 90))
            hole = float(np.mean(r > r_med * 0.35))
            score = hole / (1.0 + r_std / max(r_med, 1e-9)) / (
                1.0 + thick / max(2.0 * r_med, 1e-9)
            )
            if int(mask.sum()) > 20:
                c = sample[mask].mean(axis=0)
                c = c - ((c - c0) @ axis) * axis
            else:
                c = c0
            cand = {
                "axis": axis.copy(),
                "center": c.copy(),
                "r_med": r_med,
                "thick": thick,
                "score": float(score),
                "diameter": float(2.0 * r_med),
            }
            if best is None or cand["score"] > best["score"]:
                best = cand
        assert best is not None
        return best

    def _split_shank_and_setting(self, mesh) -> Tuple[Any, Optional[Any]]:
        """Largest component = shank; remaining parts = setting/prongs if present."""
        comps = self._split_components(mesh)
        if not comps:
            return mesh, None
        shank = max(comps, key=lambda c: len(c.faces))
        others = [c for c in comps if c is not shank]
        if not others:
            return shank, None
        import trimesh

        setting = (
            trimesh.util.concatenate(others) if len(others) > 1 else others[0]
        )
        return shank, setting

    def _geometric_setting_up(
        self,
        shank_or_frame: Dict[str, Any],
        setting_mesh,
    ) -> Optional[np.ndarray]:
        """Up = in-plane direction from ring center toward setting centroid."""
        if setting_mesh is None or self._mesh_vertex_count(setting_mesh) == 0:
            return None
        c = np.asarray(shank_or_frame["center"], dtype=np.float64)
        axis = np.asarray(shank_or_frame["axis"], dtype=np.float64)
        tip = np.asarray(setting_mesh.vertices, dtype=np.float64).mean(axis=0)
        v = tip - c
        v = v - (v @ axis) * axis
        n = float(np.linalg.norm(v))
        if n < 1e-9:
            return None
        return v / n

    def _detect_setting_up(self, mesh, base: Dict[str, Any]) -> np.ndarray:
        """
        Detect in-plane direction toward the setting/prong cluster
        (or AI top opening), relative to a ring frame.
        Prefer geometric shank→setting when multi-part inlay is available.
        """
        shank, setting = self._split_shank_and_setting(mesh)
        geo = self._geometric_setting_up(base, setting)
        if geo is not None:
            return geo

        pts = np.asarray(mesh.vertices, dtype=np.float64)
        c = np.asarray(base["center"], dtype=np.float64)
        axis = np.asarray(base["axis"], dtype=np.float64)
        rm = float(base["r_med"])
        d = (pts - c) @ axis
        radial = pts - c - np.outer(d, axis)
        r = np.linalg.norm(radial, axis=1)

        tmp = np.array([1.0, 0.0, 0.0]) if abs(axis[0]) < 0.9 else np.array([0.0, 1.0, 0.0])
        e1 = np.cross(axis, tmp)
        e1 = e1 / (np.linalg.norm(e1) + 1e-12)
        e2 = np.cross(axis, e1)
        ang = np.arctan2(radial @ e2, radial @ e1)
        outer = r > rm * 0.55
        bins = 72
        sc = np.zeros(bins, dtype=np.float64)
        for b in range(bins):
            a0 = -np.pi + b * (2 * np.pi / bins)
            a1 = a0 + 2 * np.pi / bins
            m = outer & (ang >= a0) & (ang < a1)
            if int(m.sum()) < 5:
                continue
            sc[b] = (
                float(m.sum())
                * (1.0 + float(np.max(np.abs(d[m]))) / max(rm, 1e-9))
                * (1.0 + max(0.0, float(np.max(r[m]) - rm)) / max(rm, 1e-9))
            )
        sc2 = np.convolve(np.r_[sc[-2:], sc, sc[:2]], np.ones(5) / 5.0, mode="valid")[:bins]
        bi = int(np.argmax(sc2))
        a_mid = -np.pi + (bi + 0.5) * 2 * np.pi / bins
        up = np.cos(a_mid) * e1 + np.sin(a_mid) * e2
        return up / (np.linalg.norm(up) + 1e-12)

    def _frame_with_up(self, base: Dict[str, Any], up: np.ndarray) -> Dict[str, Any]:
        axis = np.asarray(base["axis"], dtype=np.float64)
        axis = axis / (np.linalg.norm(axis) + 1e-12)
        up = np.asarray(up, dtype=np.float64)
        up = up - (up @ axis) * axis
        n = float(np.linalg.norm(up))
        if n < 1e-9:
            tmp = np.array([1.0, 0.0, 0.0]) if abs(axis[0]) < 0.9 else np.array([0.0, 1.0, 0.0])
            up = np.cross(axis, tmp)
            n = float(np.linalg.norm(up))
        up = up / max(n, 1e-12)
        side = np.cross(axis, up)
        side = side / (np.linalg.norm(side) + 1e-12)
        up = np.cross(side, axis)
        up = up / (np.linalg.norm(up) + 1e-12)
        R = np.column_stack([up, side, axis])
        if np.linalg.det(R) < 0:
            R[:, 1] *= -1
            side = R[:, 1]
        out = dict(base)
        out.update({"axis": axis, "up": up, "side": side, "R": R})
        return out

    def _inlay_inner_hole_radius(
        self,
        shank_mesh,
        frame: Dict[str, Any],
        percentile: float = 15.0,
    ) -> float:
        """Inner wall radius of inlay shank hole (AI outer should seat here)."""
        pts = np.asarray(shank_mesh.vertices, dtype=np.float64)
        c = np.asarray(frame["center"], dtype=np.float64)
        axis = np.asarray(frame["axis"], dtype=np.float64)
        up = np.asarray(frame.get("up", axis), dtype=np.float64)
        rm = float(frame["r_med"])
        thick = float(frame.get("thick", rm * 0.25))
        d = (pts - c) @ axis
        radial = pts - c - np.outer(d, axis)
        r = np.linalg.norm(radial, axis=1)
        ang_cos = (radial @ up) / np.maximum(r, 1e-9)
        mask = (ang_cos < 0.55) & (np.abs(d) < max(thick * 1.5, rm * 0.38))
        if int(mask.sum()) < 40:
            mask = np.abs(d) < max(thick * 1.8, rm * 0.45)
        return float(np.percentile(r[mask], percentile))

    def _ai_shank_outer_radius(
        self,
        ai_mesh,
        frame: Dict[str, Any],
        percentile: float = 85.0,
    ) -> float:
        """AI outer radius at shank band (surface facing inlay inner wall)."""
        pts = np.asarray(ai_mesh.vertices, dtype=np.float64)
        c = np.asarray(frame["center"], dtype=np.float64)
        axis = np.asarray(frame["axis"], dtype=np.float64)
        up = np.asarray(frame.get("up", axis), dtype=np.float64)
        rm = float(frame["r_med"])
        thick = float(frame.get("thick", rm * 0.25))
        d = (pts - c) @ axis
        radial = pts - c - np.outer(d, axis)
        r = np.linalg.norm(radial, axis=1)
        ang_cos = (radial @ up) / np.maximum(r, 1e-9)
        mask = (
            (ang_cos < 0.55)
            & (r > rm * 0.30)
            & (r < rm * 1.25)
            & (np.abs(d) < max(thick * 1.5, rm * 0.38))
        )
        if int(mask.sum()) < 40:
            mask = r > rm * 0.25
        return float(np.percentile(r[mask], percentile))

    def _ai_inner_bore_radius(
        self,
        ai_mesh,
        frame: Dict[str, Any],
        percentile: float = 10.0,
    ) -> float:
        """AI inner bore surface radius (finger-hole opening)."""
        pts = np.asarray(ai_mesh.vertices, dtype=np.float64)
        c = np.asarray(frame["center"], dtype=np.float64)
        axis = np.asarray(frame["axis"], dtype=np.float64)
        up = np.asarray(frame.get("up", axis), dtype=np.float64)
        rm = float(frame["r_med"])
        thick = float(frame.get("thick", rm * 0.25))
        d = (pts - c) @ axis
        radial = pts - c - np.outer(d, axis)
        r = np.linalg.norm(radial, axis=1)
        ang_cos = (radial @ up) / np.maximum(r, 1e-9)
        shank_band = (np.abs(d) < max(thick * 1.6, rm * 0.42)) & (ang_cos < 0.55)
        if int(shank_band.sum()) >= 30:
            return float(np.percentile(r[shank_band], percentile))
        axial_band = np.abs(d) < max(thick * 1.8, rm * 0.48)
        if int(axial_band.sum()) >= 20:
            return float(np.percentile(r[axial_band], percentile))
        return float(np.percentile(r, percentile))

    def _apply_band_limited_radial_scale(
        self,
        ai_mesh,
        shank_mesh,
        frame: Dict[str, Any],
        scale_factor: float,
    ) -> Tuple[Any, Dict[str, Any]]:
        """Shrink only the outer shank band; leave inner bore vertices unchanged."""
        if scale_factor >= 0.999:
            return ai_mesh, {"skipped": True, "scale_factor": float(scale_factor)}

        inlay_bore_r = self._inlay_inner_hole_radius(shank_mesh, frame, percentile=10.0)
        rm = float(frame["r_med"])
        band_start = max(inlay_bore_r * 1.06, rm * 0.32)
        band_end = rm * 1.05

        mesh = ai_mesh.copy()
        verts = np.asarray(mesh.vertices, dtype=np.float64)
        c = np.asarray(frame["center"], dtype=np.float64)
        axis = np.asarray(frame["axis"], dtype=np.float64)
        d_ax = (verts - c) @ axis
        radial = verts - c - np.outer(d_ax, axis)
        r = np.linalg.norm(radial, axis=1)

        t = np.clip((r - band_start) / max(band_end - band_start, 1e-9), 0.0, 1.0)
        t_smooth = t * t * (3.0 - 2.0 * t)
        factors = 1.0 + (float(scale_factor) - 1.0) * t_smooth
        factors = np.where(r >= band_start, factors, 1.0)

        radial_scaled = radial * factors.reshape(-1, 1)
        mesh.vertices = c + np.outer(d_ax, axis) + radial_scaled
        return mesh, {
            "scale_factor": float(scale_factor),
            "band_start_r": float(band_start),
            "vertices_adjusted": int((r >= band_start).sum()),
        }

    def _preserve_ring_bore_radius(
        self,
        ai_mesh,
        shank_mesh,
        frame: Dict[str, Any],
        tolerance: float = 0.985,
        max_expand: float = 1.35,
    ) -> Tuple[Any, Dict[str, Any]]:
        """
        Expand AI inner bore to match inlay finger-hole after contact-fit scaling.
        Uniform alignment/envelope shrink affects the whole mesh; this restores bore
        size with a smooth transition through the shank band.
        """
        target_r = self._inlay_inner_hole_radius(shank_mesh, frame, percentile=8.0)
        ai_bore_r = self._ai_inner_bore_radius(ai_mesh, frame, percentile=12.0)
        stats: Dict[str, Any] = {
            "target_bore_r": float(target_r),
            "ai_bore_r_before": float(ai_bore_r),
        }
        if ai_bore_r >= target_r * tolerance:
            stats["skipped"] = True
            stats["ai_bore_r_after"] = float(ai_bore_r)
            return ai_mesh, stats

        expand = float(np.clip(target_r / max(ai_bore_r, 1e-9), 1.0, max_expand))
        stats["expand_factor"] = expand

        mesh = ai_mesh.copy()
        verts = np.asarray(mesh.vertices, dtype=np.float64)
        c = np.asarray(frame["center"], dtype=np.float64)
        axis = np.asarray(frame["axis"], dtype=np.float64)
        rm = float(frame["r_med"])
        d_ax = (verts - c) @ axis
        radial = verts - c - np.outer(d_ax, axis)
        r = np.linalg.norm(radial, axis=1)

        bore_edge = target_r * 1.04
        transition = max(rm * 0.38, target_r * 1.25)
        t_span = max(transition - bore_edge, 1e-9)
        t = np.clip((r - bore_edge) / t_span, 0.0, 1.0)
        t_smooth = t * t * (3.0 - 2.0 * t)
        factors = 1.0 + (expand - 1.0) * (1.0 - t_smooth)
        active = r < transition
        factors = np.where(active, factors, 1.0)

        radial_scaled = radial * factors.reshape(-1, 1)
        mesh.vertices = c + np.outer(d_ax, axis) + radial_scaled
        stats["ai_bore_r_after"] = float(
            self._ai_inner_bore_radius(mesh, frame, percentile=12.0)
        )
        stats["vertices_adjusted"] = int(active.sum())
        return mesh, stats

    def _shank_annular_gap_mm(
        self,
        ai_mesh,
        shank_mesh,
        frame: Dict[str, Any],
    ) -> float:
        """
        Positive => AI outer sits inside inlay inner wall (visible annular gap).
        Uses inner-wall percentile minus AI outer percentile in shank sector.
        """
        inner_r = self._inlay_inner_hole_radius(shank_mesh, frame, percentile=15.0)
        outer_r = self._ai_shank_outer_radius(ai_mesh, frame, percentile=85.0)
        return float(inner_r - outer_r)

    def _ring_cylindrical_coords(
        self,
        pts: np.ndarray,
        frame: Dict[str, Any],
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """Axial offset, radial distance, angle, ang_cos(relative to setting up)."""
        c = np.asarray(frame["center"], dtype=np.float64)
        axis = np.asarray(frame["axis"], dtype=np.float64)
        up = np.asarray(frame.get("up", axis), dtype=np.float64)
        side_raw = frame.get("side")
        if side_raw is not None:
            side = np.asarray(side_raw, dtype=np.float64)
        else:
            side = None
        if side is None or side.shape != (3,) or not np.all(np.isfinite(side)):
            tmp = np.array([1.0, 0.0, 0.0]) if abs(axis[0]) < 0.9 else np.array([0.0, 1.0, 0.0])
            side = np.cross(axis, tmp)
            side = side / (np.linalg.norm(side) + 1e-12)
        d = (pts - c) @ axis
        radial = pts - c - np.outer(d, axis)
        r = np.linalg.norm(radial, axis=1)
        ang = np.arctan2(radial @ side, radial @ up)
        ang_cos = (radial @ up) / np.maximum(r, 1e-9)
        return d, r, ang, ang_cos

    def _inlay_inner_envelope_profile(
        self,
        shank_mesh,
        frame: Dict[str, Any],
        bins: int = 36,
    ) -> Dict[str, Any]:
        """Per-sector inlay inner-wall radius (mm) around the ring."""
        pts = np.asarray(shank_mesh.vertices, dtype=np.float64)
        rm = float(frame["r_med"])
        thick = float(frame.get("thick", rm * 0.25))
        d, r, ang, _ = self._ring_cylindrical_coords(pts, frame)
        inner_r = np.full(bins, np.nan, dtype=np.float64)
        valid = np.zeros(bins, dtype=bool)
        axial_band = max(thick * 1.2, rm * 0.32)
        for b in range(bins):
            a0 = -np.pi + b * (2.0 * np.pi / bins)
            a1 = a0 + 2.0 * np.pi / bins
            m = (ang >= a0) & (ang < a1) & (np.abs(d) < axial_band)
            if int(m.sum()) >= 8:
                inner_r[b] = float(np.percentile(r[m], 12))
                valid[b] = True
        return {"inner_r": inner_r, "valid": valid, "bins": bins}

    def _ai_outer_envelope_profile(
        self,
        ai_mesh,
        frame: Dict[str, Any],
        bins: int = 36,
        shank_only: bool = True,
    ) -> Dict[str, Any]:
        """Per-sector AI outer radius in the shank band."""
        pts = np.asarray(ai_mesh.vertices, dtype=np.float64)
        rm = float(frame["r_med"])
        thick = float(frame.get("thick", rm * 0.25))
        d, r, ang, ang_cos = self._ring_cylindrical_coords(pts, frame)
        outer_r = np.full(bins, np.nan, dtype=np.float64)
        valid = np.zeros(bins, dtype=bool)
        axial_band = max(thick * 1.5, rm * 0.38)
        for b in range(bins):
            a0 = -np.pi + b * (2.0 * np.pi / bins)
            a1 = a0 + 2.0 * np.pi / bins
            m = (ang >= a0) & (ang < a1) & (np.abs(d) < axial_band)
            if shank_only:
                m = (
                    m
                    & (ang_cos < 0.55)
                    & (r > rm * 0.30)
                    & (r < rm * 1.25)
                )
            if int(m.sum()) >= 6:
                outer_r[b] = float(np.percentile(r[m], 88))
                valid[b] = True
        return {"outer_r": outer_r, "valid": valid, "bins": bins}

    def _angular_shank_gap_profile(
        self,
        ai_mesh,
        shank_mesh,
        frame: Dict[str, Any],
        bins: int = 36,
    ) -> Dict[str, Any]:
        """
        Gap per sector: inner_r - outer_r.
        Positive => AI sits inside inlay inner wall; negative => AI protrudes.
        """
        inner_p = self._inlay_inner_envelope_profile(shank_mesh, frame, bins)
        outer_p = self._ai_outer_envelope_profile(ai_mesh, frame, bins, shank_only=True)
        both = inner_p["valid"] & outer_p["valid"]
        gaps = np.full(bins, np.nan, dtype=np.float64)
        gaps[both] = inner_p["inner_r"][both] - outer_p["outer_r"][both]
        arr = gaps[both]
        summary: Dict[str, Any] = {
            "gaps": gaps,
            "bins": bins,
            "n_sectors": int(both.sum()),
        }
        if len(arr) > 0:
            summary.update(
                {
                    "gap_mean": float(np.mean(arr)),
                    "gap_median": float(np.median(arr)),
                    "gap_min": float(np.min(arr)),
                    "gap_max": float(np.max(arr)),
                    "gap_p10": float(np.percentile(arr, 10)),
                    "gap_p90": float(np.percentile(arr, 90)),
                    "pct_ai_inside": float((arr > 0).mean() * 100.0),
                    "pct_ai_outside": float((arr < 0).mean() * 100.0),
                    "max_protrusion_mm": float(max(0.0, -np.min(arr))),
                }
            )
        return summary

    def _detect_full_ring_inlay_mode(
        self,
        inlay_mesh,
        frame: Optional[Dict[str, Any]] = None,
    ) -> Tuple[bool, str]:
        """
        True when inlay is a complete ring/torus (full-model upload), not prong-only.
        """
        comps = self._split_components(inlay_mesh)
        if len(comps) == 1:
            fi = self._estimate_ring_frame(inlay_mesh)
            if fi["score"] >= 0.35:
                return True, "single_component_ring"

        shank, setting = self._split_shank_and_setting(inlay_mesh)
        if frame is None:
            fi0 = self._estimate_ring_frame(shank)
            up_q = self._geometric_setting_up(fi0, setting)
            if up_q is None:
                up_q = self._detect_setting_up(inlay_mesh, fi0)
            frame = self._frame_with_up(fi0, up_q)

        prof = self._inlay_inner_envelope_profile(shank, frame, bins=36)
        coverage = float(prof["valid"].mean())
        if coverage >= 0.80:
            return True, "shank_envelope_coverage"

        whole_fi = self._estimate_ring_frame(inlay_mesh)
        shank_frac = len(shank.faces) / max(int(len(inlay_mesh.faces)), 1)
        if whole_fi["score"] >= 0.40 and shank_frac <= 0.40:
            return True, "complete_multipart_model"

        return False, "prong_only"

    @staticmethod
    def _scale_transform_about_point(
        M: np.ndarray,
        center: np.ndarray,
        scale_factor: float,
    ) -> np.ndarray:
        """Apply uniform scale about a world-space point to an existing 4x4 transform."""
        c = np.asarray(center, dtype=np.float64)
        T = np.eye(4, dtype=np.float64)
        T[:3, 3] = c
        Tinv = np.eye(4, dtype=np.float64)
        Tinv[:3, 3] = -c
        S = np.eye(4, dtype=np.float64)
        S[:3, :3] *= float(scale_factor)
        return T @ S @ Tinv @ M

    def _envelope_uniform_scale_factor(
        self,
        inner_profile: Dict[str, Any],
        outer_profile: Dict[str, Any],
        clearance_mm: float,
    ) -> float:
        """Scale <= 1 so AI outer fits inside inlay inner wall at every valid sector."""
        both = inner_profile["valid"] & outer_profile["valid"]
        if int(both.sum()) < 6:
            return 1.0
        targets = inner_profile["inner_r"][both] - float(clearance_mm)
        outers = outer_profile["outer_r"][both]
        ratios = targets / np.maximum(outers, 1e-9)
        return float(np.clip(np.min(ratios), 0.88, 1.0))

    def _sample_inlay_inner_wall_points(
        self,
        shank_mesh,
        frame: Dict[str, Any],
        n_per_sector: int = 6,
        bins: int = 36,
    ) -> np.ndarray:
        """Angularly distributed samples on the inlay inner shank wall."""
        pts = np.asarray(shank_mesh.vertices, dtype=np.float64)
        rm = float(frame["r_med"])
        thick = float(frame.get("thick", rm * 0.25))
        d, r, ang, ang_cos = self._ring_cylindrical_coords(pts, frame)
        axial_band = max(thick * 1.2, rm * 0.32)
        samples: List[np.ndarray] = []
        rng = np.random.default_rng(7)
        for b in range(bins):
            a0 = -np.pi + b * (2.0 * np.pi / bins)
            a1 = a0 + 2.0 * np.pi / bins
            m = (
                (ang >= a0)
                & (ang < a1)
                & (np.abs(d) < axial_band)
                & (ang_cos < 0.65)
            )
            if int(m.sum()) < 4:
                continue
            idx = np.where(m)[0]
            order = np.argsort(r[idx])
            inner_idx = idx[order[: max(2, min(n_per_sector, len(order)))]]
            if len(inner_idx) > n_per_sector:
                inner_idx = rng.choice(inner_idx, n_per_sector, replace=False)
            samples.append(pts[inner_idx])
        if not samples:
            return pts[: min(len(pts), 512)]
        return np.vstack(samples)

    def _inlay_point_covered_by_ai(
        self,
        ai_mesh,
        points: np.ndarray,
        tolerance_mm: Optional[float] = None,
    ) -> np.ndarray:
        """
        True where inlay sample points coincide with AI volume: inside the mesh
        or within surface tolerance (contact interface for jewelry shank seat).
        """
        pts = np.asarray(points, dtype=np.float64)
        if len(pts) == 0:
            return np.zeros(0, dtype=bool)

        extents = np.asarray(ai_mesh.bounds[1] - ai_mesh.bounds[0], dtype=np.float64)
        max_ext = float(np.max(extents))
        tol = float(tolerance_mm) if tolerance_mm is not None else max(max_ext * 0.025, 0.15)

        covered = np.zeros(len(pts), dtype=bool)
        try:
            if bool(getattr(ai_mesh, "is_watertight", False)):
                covered |= np.asarray(ai_mesh.contains(pts), dtype=bool)
        except Exception:
            pass

        try:
            from trimesh.proximity import ProximityQuery

            pq = ProximityQuery(ai_mesh)
            _, dist, _ = pq.on_surface(pts)
            covered |= np.asarray(dist <= tol, dtype=bool)
            return covered
        except Exception:
            pass

        try:
            from scipy.spatial import cKDTree

            ai_pts = np.asarray(ai_mesh.vertices, dtype=np.float64)
            dist, _ = cKDTree(ai_pts).query(pts, k=1)
            covered |= np.asarray(dist <= tol, dtype=bool)
        except Exception:
            pass

        return covered

    def _compute_inlay_ai_overlap_ratio(
        self,
        inlay_mesh,
        ai_mesh,
        *,
        shank_mesh=None,
        setting_mesh=None,
        frame: Optional[Dict[str, Any]] = None,
        full_ring: bool = False,
        max_samples: Optional[int] = None,
        tolerance_mm: Optional[float] = None,
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Fraction of sampled inlay points covered by aligned AI (inside + contact tol).
        Uses shank inner-wall samples when ring frame is known; prongs excluded.
        """
        cfg = self._get_alignment_config()
        n_samples = int(max_samples or cfg.casa_overlap_sample_count)

        has_setting = (
            setting_mesh is not None and self._mesh_vertex_count(setting_mesh) > 0
        )
        shank = (
            shank_mesh
            if shank_mesh is not None
            else self._largest_component(inlay_mesh)
        )

        samples: np.ndarray
        region: str
        if frame is not None and self._mesh_vertex_count(shank) > 0:
            wall = self._sample_inlay_inner_wall_points(shank, frame)
            if len(wall) >= 120:
                samples = wall
                region = "shank_inner_wall"
            else:
                samples = None
                region = "shank_inner_wall"
        else:
            samples = None
            region = "shank"

        if samples is None:
            if full_ring and not has_setting:
                measure_mesh = inlay_mesh
                region = "full"
            else:
                measure_mesh = shank
                region = "shank"
            try:
                import trimesh

                n_faces = max(int(len(measure_mesh.faces)), 1)
                n_draw = min(n_samples, max(500, n_faces * 3))
                samples, _ = trimesh.sample.sample_surface(measure_mesh, n_draw)
            except Exception:
                verts = np.asarray(measure_mesh.vertices, dtype=np.float64)
                if len(verts) > n_samples:
                    idx = np.random.default_rng(42).choice(
                        len(verts), n_samples, replace=False
                    )
                    samples = verts[idx]
                else:
                    samples = verts

        if len(samples) > n_samples:
            samples = samples[
                np.random.default_rng(42).choice(len(samples), n_samples, replace=False)
            ]

        if tolerance_mm is None:
            inlay_ext = float(
                np.max(inlay_mesh.bounds[1] - inlay_mesh.bounds[0])
            )
            ai_ext = float(np.max(ai_mesh.bounds[1] - ai_mesh.bounds[0]))
            diam = float(frame["diameter"]) if frame else max(inlay_ext, ai_ext)
            tolerance_mm = max(diam * 0.018, 0.10)

        covered = self._inlay_point_covered_by_ai(ai_mesh, samples, tolerance_mm)
        ratio = float(np.mean(covered)) if len(covered) else 0.0
        return ratio, {
            "region": region,
            "full_ring": bool(full_ring),
            "has_setting": bool(has_setting),
            "n_samples": int(len(samples)),
            "n_covered": int(covered.sum()),
            "ratio": ratio,
            "tolerance_mm": float(tolerance_mm),
        }

    def _pick_casa_scale_by_overlap(
        self,
        source_mesh,
        inlay_mesh,
        shank_mesh,
        setting_mesh,
        frame: Dict[str, Any],
        M_pose: np.ndarray,
        scale_candidates: List[float],
        full_ring: bool,
    ) -> Tuple[float, Dict[str, Any]]:
        """Pick uniform scale maximizing inlay-inside-AI overlap ratio."""
        cfg = self._get_alignment_config()
        c = np.asarray(frame["center"], dtype=np.float64)
        best_s = float(scale_candidates[0])
        best_ratio = -1.0
        best_info: Dict[str, Any] = {}
        tried: List[Dict[str, Any]] = []

        for s_cand in scale_candidates:
            s_val = float(np.clip(s_cand, cfg.casa_scale_min, cfg.casa_scale_max))
            trial_M = self._scale_transform_about_point(M_pose, c, s_val)
            trial = source_mesh.copy()
            trial.apply_transform(trial_M)
            ratio, oinfo = self._compute_inlay_ai_overlap_ratio(
                inlay_mesh,
                trial,
                shank_mesh=shank_mesh,
                setting_mesh=setting_mesh,
                frame=frame,
                full_ring=full_ring,
            )
            tried.append({"scale": s_val, "ratio": ratio})
            if ratio > best_ratio + 1e-6:
                best_ratio = ratio
                best_s = s_val
                best_info = oinfo

        return best_s, {
            "scale_source": "overlap_pick",
            "overlap_ratio": best_ratio,
            "overlap": best_info,
            "candidates": tried,
        }

    def _refine_alignment_inlay_overlap(
        self,
        source_mesh,
        inlay_mesh,
        shank_mesh,
        setting_mesh,
        frame: Dict[str, Any],
        init_M: np.ndarray,
        *,
        full_ring: bool = False,
        target_ratio: Optional[float] = None,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Iteratively adjust uniform scale + axial translation to raise inlay overlap.
        """
        cfg = self._get_alignment_config()
        target = float(
            target_ratio
            if target_ratio is not None
            else cfg.casa_min_inlay_overlap_ratio
        )
        c = np.asarray(frame["center"], dtype=np.float64)
        up = np.asarray(frame["up"], dtype=np.float64)
        diam = float(frame["diameter"])

        best_M = np.asarray(init_M, dtype=np.float64).copy()
        aligned = source_mesh.copy()
        aligned.apply_transform(best_M)
        best_ratio, best_info = self._compute_inlay_ai_overlap_ratio(
            inlay_mesh,
            aligned,
            shank_mesh=shank_mesh,
            setting_mesh=setting_mesh,
            frame=frame,
            full_ring=full_ring,
        )
        initial_ratio = best_ratio

        if best_ratio >= target:
            return best_M, {
                "refined": False,
                "overlap_before": initial_ratio,
                "overlap_after": best_ratio,
                "overlap": best_info,
                "meets_target": True,
            }

        for s_mult in np.linspace(0.50, 2.00, 31):
            trial_M = self._scale_transform_about_point(best_M, c, float(s_mult))
            trial = source_mesh.copy()
            trial.apply_transform(trial_M)
            ratio, oinfo = self._compute_inlay_ai_overlap_ratio(
                inlay_mesh,
                trial,
                shank_mesh=shank_mesh,
                setting_mesh=setting_mesh,
                frame=frame,
                full_ring=full_ring,
            )
            if ratio > best_ratio + 1e-6:
                best_ratio = ratio
                best_M = trial_M
                best_info = oinfo

        if best_ratio < target:
            base_M = best_M.copy()
            for du in np.linspace(-0.18 * diam, 0.18 * diam, 15):
                trial_M = base_M.copy()
                trial_M[:3, 3] = trial_M[:3, 3] + up * float(du)
                trial = source_mesh.copy()
                trial.apply_transform(trial_M)
                ratio, oinfo = self._compute_inlay_ai_overlap_ratio(
                    inlay_mesh,
                    trial,
                    shank_mesh=shank_mesh,
                    setting_mesh=setting_mesh,
                    frame=frame,
                    full_ring=full_ring,
                )
                if ratio > best_ratio + 1e-6:
                    best_ratio = ratio
                    best_M = trial_M
                    best_info = oinfo

        if best_ratio < target:
            base_M = best_M.copy()
            for s_mult in np.linspace(0.85, 1.15, 13):
                trial_M = self._scale_transform_about_point(base_M, c, float(s_mult))
                trial = source_mesh.copy()
                trial.apply_transform(trial_M)
                ratio, oinfo = self._compute_inlay_ai_overlap_ratio(
                    inlay_mesh,
                    trial,
                    shank_mesh=shank_mesh,
                    setting_mesh=setting_mesh,
                    frame=frame,
                    full_ring=full_ring,
                )
                if ratio > best_ratio + 1e-6:
                    best_ratio = ratio
                    best_M = trial_M
                    best_info = oinfo

        return best_M, {
            "refined": best_ratio > initial_ratio + 1e-6,
            "overlap_before": initial_ratio,
            "overlap_after": best_ratio,
            "overlap": best_info,
            "meets_target": best_ratio >= target,
        }

    def _planar_procrustes_delta(
        self,
        src: np.ndarray,
        dst: np.ndarray,
        center: np.ndarray,
        axis: np.ndarray,
    ) -> np.ndarray:
        """2D rigid transform in ring plane: rotation about axis + in-plane translation."""
        axis = np.asarray(axis, dtype=np.float64)
        axis = axis / (np.linalg.norm(axis) + 1e-12)
        c = np.asarray(center, dtype=np.float64)
        tmp = np.array([1.0, 0.0, 0.0]) if abs(axis[0]) < 0.9 else np.array([0.0, 1.0, 0.0])
        e1 = np.cross(axis, tmp)
        e1 = e1 / (np.linalg.norm(e1) + 1e-12)
        e2 = np.cross(axis, e1)
        basis = np.column_stack([e1, e2, axis])

        def to_local(p: np.ndarray) -> np.ndarray:
            v = np.asarray(p, dtype=np.float64) - c
            if v.ndim == 1:
                return basis.T @ v
            return v @ basis

        A = to_local(src)[:, :2]
        B = to_local(dst)[:, :2]
        Ac = A.mean(axis=0)
        Bc = B.mean(axis=0)
        A0 = A - Ac
        B0 = B - Bc
        H = A0.T @ B0
        U, _, Vt = np.linalg.svd(H)
        R2 = Vt.T @ U.T
        if np.linalg.det(R2) < 0:
            Vt[-1, :] *= -1
            R2 = Vt.T @ U.T
        t2 = Bc - R2 @ Ac
        R3 = basis @ np.block(
            [[R2, np.zeros((2, 1))], [np.zeros((1, 2)), np.array([[1.0]])]]
        ) @ basis.T
        t3 = basis @ np.array([t2[0], t2[1], 0.0])
        M = np.eye(4, dtype=np.float64)
        M[:3, :3] = R3
        M[:3, 3] = t3 + c - R3 @ c
        return M

    def _procrustes_shank_band_align(
        self,
        source_mesh,
        shank_mesh,
        frame: Dict[str, Any],
        init_M: np.ndarray,
        clearance_mm: float = 0.05e-3,
        iterations: int = 6,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Rigid ICP on shank-band samples (rotation about axis + in-plane shift)."""
        try:
            from scipy.spatial import cKDTree
        except ImportError:
            return init_M, {"skipped": True, "reason": "no_scipy"}

        M = np.asarray(init_M, dtype=np.float64).copy()
        c = np.asarray(frame["center"], dtype=np.float64)
        axis = np.asarray(frame["axis"], dtype=np.float64)
        inlay_pts = self._sample_inlay_inner_wall_points(shank_mesh, frame)
        info: Dict[str, Any] = {"iterations_run": 0}
        for it in range(iterations):
            aligned = source_mesh.copy()
            aligned.apply_transform(M)
            ai_pts = np.asarray(aligned.vertices, dtype=np.float64)
            tree = cKDTree(ai_pts)
            dist, idx = tree.query(inlay_pts, k=1)
            matched = ai_pts[idx]
            radial = (inlay_pts - c) - np.outer((inlay_pts - c) @ axis, axis)
            rn = np.linalg.norm(radial, axis=1, keepdims=True)
            inward = -radial / np.maximum(rn, 1e-9)
            tgt = inlay_pts + clearance_mm * inward
            delta = self._planar_procrustes_delta(matched, tgt, c, axis)
            M = delta @ M
            info["iterations_run"] = it + 1
            info["last_median_dist"] = float(np.median(dist))
        return M, info

    def _balance_angular_gap_rotation(
        self,
        source_mesh,
        shank_mesh,
        frame: Dict[str, Any],
        init_M: np.ndarray,
        clearance_mm: float = 0.05e-3,
        steps: int = 24,
        max_deg: float = 8.0,
        setting_mesh=None,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Small rotation about ring axis; also checks ±180° when setting exists."""
        c = np.asarray(frame["center"], dtype=np.float64)
        axis = np.asarray(frame["axis"], dtype=np.float64)
        axis = axis / (np.linalg.norm(axis) + 1e-12)
        M0 = np.asarray(init_M, dtype=np.float64)
        best_M = M0.copy()
        aligned = source_mesh.copy()
        aligned.apply_transform(best_M)
        best_prof = self._angular_shank_gap_profile(aligned, shank_mesh, frame)
        init_up = self._ai_up_alignment(aligned, frame)
        best_score = float(
            best_prof.get("max_protrusion_mm", 1e9)
            + 0.25 * abs(best_prof.get("gap_mean", 0.0))
        )
        if setting_mesh is not None:
            best_score += 0.15 * float(frame["diameter"]) * max(0.0, 1.0 - init_up)
        best_ang = 0.0
        scan_degs = list(np.linspace(-max_deg, max_deg, steps))
        if setting_mesh is not None:
            scan_degs.extend([90.0, 180.0, 270.0])
        for deg in scan_degs:
            ang = np.radians(float(deg))
            T = self._rotation_about_axis_matrix(axis, c, ang)
            trial_M = T @ M0
            trial = source_mesh.copy()
            trial.apply_transform(trial_M)
            prof = self._angular_shank_gap_profile(trial, shank_mesh, frame)
            protr = float(prof.get("max_protrusion_mm", 1e9))
            score = protr + 0.25 * abs(float(prof.get("gap_mean", 0.0)))
            if setting_mesh is not None:
                up_c = self._ai_up_alignment(trial, frame)
                score += 0.15 * float(frame["diameter"]) * max(0.0, 1.0 - up_c)
                score += 0.08 * float(
                    self._setting_surface_distance(trial, setting_mesh, frame)["median"]
                )
            if score < best_score - 1e-6:
                best_score = score
                best_M = trial_M
                best_prof = prof
                best_ang = float(deg)
        return best_M, {
            "best_rot_deg": best_ang,
            "score": best_score,
            "gap_after": {k: best_prof[k] for k in best_prof if k != "gaps"},
        }

    def _refine_full_ring_envelope_alignment(
        self,
        source_mesh,
        shank_mesh,
        frame: Dict[str, Any],
        init_M: np.ndarray,
        clearance_mm: float = 0.05e-3,
        setting_mesh=None,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Envelope fit: uniform shrink + Procrustes + angular balance for full-ring inlay."""
        M = np.asarray(init_M, dtype=np.float64).copy()
        info: Dict[str, Any] = {"clearance_mm": float(clearance_mm)}
        aligned = source_mesh.copy()
        aligned.apply_transform(M)
        gap_before = self._angular_shank_gap_profile(aligned, shank_mesh, frame)
        info["angular_gap_before"] = {
            k: gap_before[k] for k in gap_before if k != "gaps"
        }

        inner_p = self._inlay_inner_envelope_profile(shank_mesh, frame)
        outer_p = self._ai_outer_envelope_profile(aligned, frame)
        env_scale = self._envelope_uniform_scale_factor(inner_p, outer_p, clearance_mm)
        info["envelope_scale"] = env_scale
        # Defer envelope shrink to band-limited vertex scaling (align_generated_to_base)
        # so uniform scale does not shrink the finger-hole bore.

        M, proc_info = self._procrustes_shank_band_align(
            source_mesh, shank_mesh, frame, M, clearance_mm=clearance_mm
        )
        info["procrustes"] = proc_info

        M, rot_info = self._balance_angular_gap_rotation(
            source_mesh,
            shank_mesh,
            frame,
            M,
            clearance_mm=clearance_mm,
            setting_mesh=setting_mesh,
        )
        info["angular_balance"] = rot_info

        aligned = source_mesh.copy()
        aligned.apply_transform(M)
        gap_after = self._angular_shank_gap_profile(aligned, shank_mesh, frame)
        info["angular_gap_after"] = {
            k: gap_after[k] for k in gap_after if k != "gaps"
        }
        return M, info

    def _radially_constrain_to_inlay_envelope(
        self,
        ai_mesh,
        shank_mesh,
        frame: Dict[str, Any],
        clearance_mm: float = 0.05e-3,
        preview_shrink_mm: float = 0.0,
        include_setting: bool = False,
    ):
        """
        Push AI vertices inward where they exceed the per-angle inlay inner envelope.
        preview_shrink_mm adds extra inward bias so inlay color covers AI in preview.
        """
        inner_p = self._inlay_inner_envelope_profile(shank_mesh, frame, bins=36)
        if int(inner_p["valid"].sum()) < 6:
            return ai_mesh, {"skipped": True}

        mesh = ai_mesh.copy()
        verts = np.asarray(mesh.vertices, dtype=np.float64)
        rm = float(frame["r_med"])
        thick = float(frame.get("thick", rm * 0.25))
        inlay_bore_r = self._inlay_inner_hole_radius(shank_mesh, frame, percentile=10.0)
        d_ax, r, ang, ang_cos = self._ring_cylindrical_coords(verts, frame)
        c = np.asarray(frame["center"], dtype=np.float64)
        axis = np.asarray(frame["axis"], dtype=np.float64)
        bins = int(inner_p["bins"])
        inner_r = inner_p["inner_r"]
        total_clear = float(clearance_mm) + float(preview_shrink_mm)

        bin_idx = np.floor((ang + np.pi) / (2.0 * np.pi) * bins).astype(np.int64)
        bin_idx = np.clip(bin_idx, 0, bins - 1)
        limit_r = inner_r[bin_idx] - total_clear
        valid_limit = inner_p["valid"][bin_idx]

        bore_guard = max(inlay_bore_r * 1.08, rm * 0.22)
        in_band = (r > bore_guard) & (np.abs(d_ax) < max(thick * 1.8, rm * 0.48))
        if include_setting:
            active = in_band & valid_limit
        else:
            active = in_band & valid_limit & (ang_cos < 0.62)

        protrude = active & (r > limit_r) & np.isfinite(limit_r)
        n_fixed = int(protrude.sum())
        if n_fixed > 0:
            scale = (limit_r[protrude] / np.maximum(r[protrude], 1e-9)).reshape(-1, 1)
            radial = verts[protrude] - c - np.outer(d_ax[protrude], axis)
            verts[protrude] = c + np.outer(d_ax[protrude], axis) + radial * scale

        mesh.vertices = verts
        stats = {
            "vertices_constrained": n_fixed,
            "clearance_mm": float(clearance_mm),
            "preview_shrink_mm": float(preview_shrink_mm),
        }
        return mesh, stats

    def _apply_full_ring_preview_cover(
        self,
        ai_mesh_path: str,
        inlay_mesh_path: str,
        output_path: str,
        clearance_mm: float = 0.05e-3,
        z_fight_offset_mm: float = 0.03e-3,
    ) -> Tuple[str, Dict[str, Any]]:
        """Radial envelope constrain + tiny inward offset for colored preview (no z-fight)."""
        inlay = self._load_trimesh_mesh(inlay_mesh_path)
        ai = self._load_trimesh_mesh(ai_mesh_path)
        shank, setting = self._split_shank_and_setting(inlay)
        fi0 = self._estimate_ring_frame(shank)
        up_q = self._geometric_setting_up(fi0, setting)
        if up_q is None:
            up_q = self._detect_setting_up(inlay, fi0)
        frame = self._frame_with_up(fi0, up_q)

        gap_before = self._angular_shank_gap_profile(ai, shank, frame)
        constrained, cstats = self._radially_constrain_to_inlay_envelope(
            ai,
            shank,
            frame,
            clearance_mm=clearance_mm,
            preview_shrink_mm=z_fight_offset_mm,
            include_setting=True,
        )
        gap_after = self._angular_shank_gap_profile(constrained, shank, frame)
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        ext = os.path.splitext(output_path)[1].lstrip(".").lower() or "glb"
        constrained.export(output_path, file_type=ext)
        return output_path, {
            "constrain": cstats,
            "angular_gap_before": {k: gap_before[k] for k in gap_before if k != "gaps"},
            "angular_gap_after": {k: gap_after[k] for k in gap_after if k != "gaps"},
        }

    def _shank_surface_distance(
        self,
        ai_mesh,
        shank_mesh,
        shank_frame: Dict[str, Any],
        max_samples: int = 4000,
    ) -> Dict[str, float]:
        """Median/mean distance from inlay inner-wall samples to AI surface."""
        try:
            from scipy.spatial import cKDTree
        except ImportError:
            # Fallback: use trimesh nearest
            cKDTree = None

        pts = np.asarray(shank_mesh.vertices, dtype=np.float64)
        c = np.asarray(shank_frame["center"], dtype=np.float64)
        axis = np.asarray(shank_frame["axis"], dtype=np.float64)
        rm = float(shank_frame["r_med"])
        up = np.asarray(shank_frame.get("up", axis), dtype=np.float64)
        d = (pts - c) @ axis
        radial = pts - c - np.outer(d, axis)
        r = np.linalg.norm(radial, axis=1)
        ang_cos = (radial @ up) / np.maximum(r, 1e-9)
        thick = float(shank_frame.get("thick", rm * 0.25))
        inner_r = self._inlay_inner_hole_radius(shank_mesh, shank_frame, percentile=20.0)
        keep = (
            (r >= inner_r * 0.92)
            & (r <= inner_r * 1.18)
            & (np.abs(d) < max(thick * 1.6, rm * 0.38))
        )
        # Prefer non-setting sector when up is known
        if "up" in shank_frame:
            keep = keep & (ang_cos < 0.55)
        if int(keep.sum()) < 120:
            keep = (
                (r > rm * 0.32)
                & (r < rm * 0.88)
                & (np.abs(d) < max(thick * 1.8, rm * 0.42))
            )
            if "up" in shank_frame:
                keep = keep & (ang_cos < 0.55)
        si = pts[keep]
        if len(si) == 0:
            si = pts
        if len(si) > max_samples:
            si = si[np.random.default_rng(0).choice(len(si), max_samples, replace=False)]

        ai_pts = np.asarray(ai_mesh.vertices, dtype=np.float64)
        if cKDTree is not None:
            dist, _ = cKDTree(ai_pts).query(si, k=1)
        else:
            # brute chunked
            dist = np.empty(len(si), dtype=np.float64)
            for i in range(0, len(si), 256):
                chunk = si[i : i + 256]
                dmat = ((chunk[:, None, :] - ai_pts[None, :, :]) ** 2).sum(axis=2)
                dist[i : i + 256] = np.sqrt(dmat.min(axis=1))
        return {
            "median": float(np.median(dist)),
            "mean": float(np.mean(dist)),
            "p90": float(np.percentile(dist, 90)),
            "n": float(len(si)),
        }

    def _setting_surface_distance(
        self,
        ai_mesh,
        setting_mesh,
        ring_frame: Dict[str, Any],
        max_samples: int = 3500,
    ) -> Dict[str, float]:
        """
        Distance from AI setting-sector samples to inlay prong/setting mesh.
        Used so angle search seats the opening into the head, not just the band.
        """
        if setting_mesh is None or self._mesh_vertex_count(setting_mesh) == 0:
            return {"median": 0.0, "mean": 0.0, "p90": 0.0, "n": 0.0}

        try:
            from scipy.spatial import cKDTree
        except ImportError:
            cKDTree = None

        pts = np.asarray(ai_mesh.vertices, dtype=np.float64)
        c = np.asarray(ring_frame["center"], dtype=np.float64)
        axis = np.asarray(ring_frame["axis"], dtype=np.float64)
        up = np.asarray(ring_frame.get("up", axis), dtype=np.float64)
        rm = float(ring_frame["r_med"])
        d = (pts - c) @ axis
        radial = pts - c - np.outer(d, axis)
        r = np.linalg.norm(radial, axis=1)
        ang_cos = (radial @ up) / np.maximum(r, 1e-9)
        # AI opening / head: upper sector, preferably outer rim
        keep = (ang_cos > 0.35) & (r > rm * 0.35)
        if int(keep.sum()) < 80:
            proj = (pts - c) @ up
            keep = proj >= np.percentile(proj, 70)
        si = pts[keep]
        if len(si) == 0:
            si = pts
        if len(si) > max_samples:
            si = si[np.random.default_rng(1).choice(len(si), max_samples, replace=False)]

        set_pts = np.asarray(setting_mesh.vertices, dtype=np.float64)
        if cKDTree is not None:
            dist, _ = cKDTree(set_pts).query(si, k=1)
        else:
            dist = np.empty(len(si), dtype=np.float64)
            for i in range(0, len(si), 256):
                chunk = si[i : i + 256]
                dmat = ((chunk[:, None, :] - set_pts[None, :, :]) ** 2).sum(axis=2)
                dist[i : i + 256] = np.sqrt(dmat.min(axis=1))
        return {
            "median": float(np.median(dist)),
            "mean": float(np.mean(dist)),
            "p90": float(np.percentile(dist, 90)),
            "n": float(len(si)),
        }

    def _ai_up_alignment(
        self,
        ai_mesh,
        target_frame: Dict[str, Any],
    ) -> float:
        """Cosine of AI detected-up vs target up (higher = better seating direction)."""
        try:
            fa = self._estimate_ring_frame(ai_mesh)
            up = self._detect_setting_up(ai_mesh, fa)
            tu = np.asarray(target_frame["up"], dtype=np.float64)
            return float(np.dot(up, tu))
        except Exception:
            return 0.0

    def _ai_up_mass(
        self,
        ai_mesh,
        ring_frame: Dict[str, Any],
    ) -> float:
        """
        Cheap seating orientation score in [-1, 1]:
        mean radial·up of outer AI vertices. Positive => mass toward setting.
        """
        pts = np.asarray(ai_mesh.vertices, dtype=np.float64)
        if len(pts) == 0:
            return 0.0
        c = np.asarray(ring_frame["center"], dtype=np.float64)
        axis = np.asarray(ring_frame["axis"], dtype=np.float64)
        up = np.asarray(ring_frame["up"], dtype=np.float64)
        rm = float(ring_frame["r_med"])
        radial = pts - c - np.outer((pts - c) @ axis, axis)
        r = np.linalg.norm(radial, axis=1)
        ang_cos = (radial @ up) / np.maximum(r, 1e-9)
        outer = r > rm * 0.5
        if int(outer.sum()) < 40:
            outer = r > rm * 0.35
        if int(outer.sum()) < 10:
            return 0.0
        return float(np.mean(ang_cos[outer]))

    @staticmethod
    def _rotation_about_axis_matrix(
        axis: np.ndarray,
        center: np.ndarray,
        angle_rad: float,
    ) -> np.ndarray:
        """4x4 rotation about axis through center."""
        axis = np.asarray(axis, dtype=np.float64)
        axis = axis / (np.linalg.norm(axis) + 1e-12)
        c = np.asarray(center, dtype=np.float64)
        ca, sa = float(np.cos(angle_rad)), float(np.sin(angle_rad))
        K = np.array(
            [
                [0.0, -axis[2], axis[1]],
                [axis[2], 0.0, -axis[0]],
                [-axis[1], axis[0], 0.0],
            ],
            dtype=np.float64,
        )
        R = np.eye(3, dtype=np.float64) + sa * K + (1.0 - ca) * (K @ K)
        T = np.eye(4, dtype=np.float64)
        T[:3, :3] = R
        T[:3, 3] = c - R @ c
        return T

    def _score_ring_alignment_pose(
        self,
        source_mesh,
        shank_mesh,
        setting_mesh,
        frame: Dict[str, Any],
        M: np.ndarray,
        *,
        w_up: float = 0.42,
        w_up_mass: float = 0.18,
        w_set: float = 0.30,
    ) -> Dict[str, Any]:
        """
        Score a ring alignment pose. Rewards setting/prong coincidence, not just shank fit.
        Negative up_cos (180° flip) is heavily penalized.
        """
        aligned = source_mesh.copy()
        aligned.apply_transform(M)
        dist = self._shank_surface_distance(aligned, shank_mesh, frame)
        set_d = self._setting_surface_distance(aligned, setting_mesh, frame)
        um = self._ai_up_mass(aligned, frame)
        up_cos = self._ai_up_alignment(aligned, frame)
        diam = float(frame["diameter"])
        w_set_eff = w_set if setting_mesh is not None else 0.0
        # up_cos in [-1,1]: reward positive (head toward prongs), punish inverted
        up_pen = max(0.0, 1.0 - up_cos)
        flip_pen = max(0.0, -up_cos) * 2.5
        score = (
            float(dist["median"])
            + w_up * diam * up_pen
            + w_up * diam * flip_pen
            + w_up_mass * diam * (1.0 - um)
            + w_set_eff * float(set_d["median"])
        )
        return {
            "score": score,
            "shank_median": float(dist["median"]),
            "shank_mean": float(dist["mean"]),
            "shank_p90": float(dist["p90"]),
            "setting_median": float(set_d["median"]),
            "setting_mean": float(set_d["mean"]),
            "up_mass": um,
            "up_cos": up_cos,
        }

    def _resolve_ring_axis_half_turn(
        self,
        source_mesh,
        shank_mesh,
        setting_mesh,
        frame: Dict[str, Any],
        init_M: np.ndarray,
        init_rec: Dict[str, Any],
        *,
        extra_degs: Tuple[float, ...] = (0.0, 90.0, 180.0, 270.0),
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Resolve ring-axis symmetry: always compare 0°/180° (and ±90°) about the ring axis.
        Picks the pose with best setting/prong alignment, not just shank distance.
        """
        c = np.asarray(frame["center"], dtype=np.float64)
        axis = np.asarray(frame["axis"], dtype=np.float64)
        best_M = np.asarray(init_M, dtype=np.float64).copy()
        best_rec = dict(init_rec)
        best_score = float(best_rec.get("score", 1e18))
        tried: List[float] = []
        for deg in extra_degs:
            if abs(float(deg)) < 1e-6:
                continue
            tried.append(float(deg))
            T = self._rotation_about_axis_matrix(axis, c, np.radians(float(deg)))
            trial_M = T @ np.asarray(init_M, dtype=np.float64)
            scored = self._score_ring_alignment_pose(
                source_mesh, shank_mesh, setting_mesh, frame, trial_M
            )
            rec = dict(init_rec)
            rec.update(scored)
            rec["axis_resolve_deg"] = float(deg)
            if scored["score"] < best_score - 1e-6:
                best_score = scored["score"]
                best_M = trial_M
                best_rec = rec
        best_rec["axis_half_turn_tried"] = tried
        return best_M, best_rec

    def _refine_seating_micro_search(
        self,
        source_mesh,
        base_M: np.ndarray,
        shank,
        setting,
        frame: Dict[str, Any],
        best: Dict[str, Any],
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Small translation search along ring up + radial toward setting tip.
        Improves flush seating when ring-frame rotation is correct but head gap remains.
        """
        if setting is None:
            return base_M, best

        d = float(frame["diameter"])
        up = np.asarray(frame["up"], dtype=np.float64)
        axis = np.asarray(frame["axis"], dtype=np.float64)
        center = np.asarray(frame["center"], dtype=np.float64)
        tip = np.asarray(setting.vertices, dtype=np.float64).mean(axis=0)
        radial = tip - center - axis * float(np.dot(tip - center, axis))
        rn = float(np.linalg.norm(radial))
        radial_dir = radial / max(rn, 1e-9) if rn > 1e-6 else up

        best_M = np.asarray(base_M, dtype=np.float64).copy()
        best_set = float(best.get("setting_median", 1e9))
        best_shank = float(best.get("shank_median", 1e9))
        best_score = best_set + 0.22 * best_shank

        for du in np.linspace(-0.10 * d, 0.26 * d, 13):
            for dr in np.linspace(-0.05 * d, 0.08 * d, 6):
                shift = up * float(du) + radial_dir * float(dr)
                trial_M = best_M.copy()
                trial_M[:3, 3] = trial_M[:3, 3] + shift
                trial = source_mesh.copy()
                trial.apply_transform(trial_M)
                sd = float(self._setting_surface_distance(trial, setting, frame)["median"])
                sh = float(self._shank_surface_distance(trial, shank, frame)["median"])
                if sh > max(best_shank * 1.14, d * 0.24):
                    continue
                score = sd + 0.22 * sh
                if score < best_score - 1e-6:
                    best_score = score
                    best_set = sd
                    best_shank = sh
                    best_M = trial_M

        out = dict(best)
        out["setting_median"] = best_set
        out["shank_median"] = best_shank
        out["micro_seat_applied"] = True
        return best_M, out

    def _get_alignment_config(self):
        from app.config import get_config

        return get_config().alignment

    def _normalize_mesh_to_unit_ring(
        self,
        mesh,
        frame: Dict[str, Any],
    ) -> Tuple[Any, float, np.ndarray]:
        """Scale mesh about ring center so diameter becomes 1.0 (pose search only)."""
        mesh_copy = mesh.copy()
        diam = float(frame["diameter"])
        if diam < 1e-9:
            return mesh_copy, 1.0, np.eye(4, dtype=np.float64)
        inv_diam = 1.0 / diam
        c = np.asarray(frame["center"], dtype=np.float64)
        T = self._scale_transform_about_point(np.eye(4, dtype=np.float64), c, inv_diam)
        mesh_copy.apply_transform(T)
        return mesh_copy, inv_diam, T

    def _angular_profile_cross_correlation(
        self,
        inner_profile: Dict[str, Any],
        outer_profile: Dict[str, Any],
    ) -> Tuple[float, float, np.ndarray]:
        """
        Scale-invariant angular cross-correlation between inlay inner and AI outer profiles.
        Returns (roll_deg, peak_ratio, corr_array).
        """
        bins = int(inner_profile["bins"])
        both = inner_profile["valid"] & outer_profile["valid"]
        corr = np.zeros(bins, dtype=np.float64)
        if int(both.sum()) < 6:
            return 0.0, 0.0, corr

        inner = inner_profile["inner_r"].astype(np.float64)
        outer = outer_profile["outer_r"].astype(np.float64)
        inner_med = float(np.median(inner[both]))
        outer_med = float(np.median(outer[both]))
        inner_n = inner / max(inner_med, 1e-9)
        outer_n = outer / max(outer_med, 1e-9)

        for k in range(bins):
            acc = 0.0
            n = 0
            for b in range(bins):
                bb = (b + k) % bins
                if not both[b] or not both[bb]:
                    continue
                acc += inner_n[b] * outer_n[bb]
                n += 1
            corr[k] = acc / max(n, 1)

        peak_idx = int(np.argmax(corr))
        peak_val = float(corr[peak_idx])
        sorted_vals = np.sort(corr)[::-1]
        second_val = float(sorted_vals[1]) if len(sorted_vals) > 1 else 0.0
        peak_ratio = (peak_val - second_val) / max(abs(peak_val), 1e-9)
        roll_deg = 360.0 * peak_idx / bins
        return roll_deg, float(peak_ratio), corr

    def _mesh_mean_angular_position(
        self,
        mesh,
        frame: Dict[str, Any],
        *,
        vertex_mask: Optional[np.ndarray] = None,
    ) -> Optional[float]:
        """Mean angular position (radians) of mesh vertices in ring frame."""
        if mesh is None or self._mesh_vertex_count(mesh) == 0:
            return None
        pts = np.asarray(mesh.vertices, dtype=np.float64)
        if vertex_mask is not None and len(vertex_mask) == len(pts):
            pts = pts[vertex_mask]
        if len(pts) < 8:
            return None
        _, _, ang, _ = self._ring_cylindrical_coords(pts, frame)
        return float(np.arctan2(np.mean(np.sin(ang)), np.mean(np.cos(ang))))

    def _estimate_setting_angular_anchor(
        self,
        source_mesh,
        setting_mesh,
        fa: Dict[str, Any],
        fi: Dict[str, Any],
    ) -> Tuple[Optional[float], float]:
        """
        Roll hint (degrees) from setting/head angular positions.
        Returns (roll_hint_deg, confidence in [0,1]).
        """
        ang_inlay = (
            self._mesh_mean_angular_position(setting_mesh, fi) if setting_mesh else None
        )
        fa_use = fa if "up" in fa else self._frame_with_up(
            fa, self._detect_setting_up(source_mesh, fa)
        )
        _, src_setting = self._split_shank_and_setting(source_mesh)
        ang_ai: Optional[float] = None
        if src_setting is not None and self._mesh_vertex_count(src_setting) > 0:
            ang_ai = self._mesh_mean_angular_position(src_setting, fa_use)
        if ang_ai is None:
            ang_ai = self._angular_position_of_head(source_mesh, fa_use)

        if ang_inlay is None or ang_ai is None:
            return None, 0.0

        roll_deg = float(np.degrees(float(ang_inlay - ang_ai)))
        confidence = 0.55 if setting_mesh is not None else 0.35
        return roll_deg, confidence

    def _angular_position_of_head(
        self,
        source_mesh,
        fa: Dict[str, Any],
    ) -> Optional[float]:
        """Angular anchor from AI head region when no separate setting mesh on source."""
        if "up" not in fa:
            fa = self._frame_with_up(fa, self._detect_setting_up(source_mesh, fa))
        pts = np.asarray(source_mesh.vertices, dtype=np.float64)
        c = np.asarray(fa["center"], dtype=np.float64)
        up = np.asarray(fa["up"], dtype=np.float64)
        proj = (pts - c) @ up
        head_mask = proj >= np.percentile(proj, 78)
        return self._mesh_mean_angular_position(source_mesh, fa, vertex_mask=head_mask)

    def _compute_contour_anchored_pose(
        self,
        source_mesh,
        shank_mesh,
        setting_mesh,
        fa0: Dict[str, Any],
        fi0: Dict[str, Any],
    ) -> Tuple[Optional[np.ndarray], Dict[str, Any]]:
        """
        Phase 1: scale-invariant contour + setting anchor pose (rotation + translation only).
        """
        cfg = self._get_alignment_config()
        info: Dict[str, Any] = {
            "src_ring_score": float(fa0["score"]),
            "tgt_ring_score": float(fi0["score"]),
        }

        up_src = self._detect_setting_up(source_mesh, fa0)
        up_tgt = self._geometric_setting_up(fi0, setting_mesh)
        if up_tgt is None:
            up_tgt = self._detect_setting_up(shank_mesh, fi0)
        fi = self._frame_with_up(fi0, up_tgt)

        src_norm, norm_inv, T_norm = self._normalize_mesh_to_unit_ring(source_mesh, fa0)

        inner_p = self._inlay_inner_envelope_profile(shank_mesh, fi)
        roll_set, set_conf = self._estimate_setting_angular_anchor(
            source_mesh, setting_mesh, fa0, fi
        )
        info["setting_roll_hint_deg"] = roll_set
        info["setting_anchor_confidence"] = set_conf

        best_M: Optional[np.ndarray] = None
        best_rec: Optional[Dict[str, Any]] = None

        for flip in (1.0, -1.0):
            fa = self._frame_with_up(fa0, up_src * flip)
            for s_axis in (1.0, -1.0):
                fa2 = dict(fa)
                fa2["axis"] = np.asarray(fa["axis"], dtype=np.float64) * s_axis
                fa2 = self._frame_with_up(fa2, fa["up"])
                R_base = fi["R"] @ fa2["R"].T
                M_base = np.eye(4, dtype=np.float64)
                M_base[:3, :3] = R_base
                M_base[:3, 3] = fi["center"] - R_base @ fa["center"]

                aligned_unit = src_norm.copy()
                aligned_unit.apply_transform(M_base)
                outer_p = self._ai_outer_envelope_profile(aligned_unit, fi)
                roll_corr, peak_ratio, corr = self._angular_profile_cross_correlation(
                    inner_p, outer_p
                )

                roll_deg = roll_corr
                if roll_set is not None and set_conf > 0.1:
                    w_set = min(0.65, set_conf)
                    w_corr = 1.0 - w_set
                    roll_deg = w_corr * roll_corr + w_set * roll_set

                roll_rad = np.radians(float(roll_deg))
                T_roll = self._rotation_about_axis_matrix(fi["axis"], fi["center"], roll_rad)
                M_pose = T_roll @ M_base @ T_norm

                scored = self._score_ring_alignment_pose(
                    source_mesh, shank_mesh, setting_mesh, fi, M_pose
                )
                contour_pen = max(0.0, 1.0 - peak_ratio) * float(fi["diameter"]) * 0.08
                score = float(scored["score"]) + contour_pen
                rec = {
                    **scored,
                    "score": score,
                    "pose_score": float(scored["score"]),
                    "up_flip": float(flip),
                    "s_axis": float(s_axis),
                    "roll_corr_deg": float(roll_corr),
                    "roll_fused_deg": float(roll_deg),
                    "peak_ratio": float(peak_ratio),
                    "corr_peak": float(np.max(corr)) if len(corr) else 0.0,
                }
                if best_rec is None or score < best_rec["score"]:
                    best_rec = rec
                    best_M = M_pose

        if best_M is None or best_rec is None:
            info["reason"] = "pose_search_failed"
            return None, info

        best_M, best_rec = self._resolve_ring_axis_half_turn(
            source_mesh, shank_mesh, setting_mesh, fi, best_M, best_rec
        )

        peak_ratio = float(best_rec.get("peak_ratio", 0.0))
        set_conf = float(info.get("setting_anchor_confidence", 0.0))
        pose_confidence = max(peak_ratio, set_conf * 0.85)
        # Require weak contour AND weak setting anchor before marking ambiguous
        ambiguous_pose = (
            peak_ratio < cfg.casa_min_peak_ratio
            and set_conf < 0.28
            and pose_confidence < max(cfg.casa_min_pose_confidence, 0.10)
        )

        info.update(best_rec)
        info.update(
            {
                "pose_confidence": float(pose_confidence),
                "peak_ratio": peak_ratio,
                "ambiguous_pose": bool(ambiguous_pose),
                "norm_inv_scale": float(norm_inv),
            }
        )
        return best_M, info

    def _compute_ring_frame_scale(
        self,
        source_mesh,
        shank_mesh,
        frame: Dict[str, Any],
    ) -> Tuple[float, Dict[str, Any]]:
        """Ring diameter + contact scale (same as ring-frame alignment phase-1 scale)."""
        fa0 = self._estimate_ring_frame(source_mesh)
        scale_base = float(frame["diameter"] / max(fa0["diameter"], 1e-9))
        inlay_inner_r = self._inlay_inner_hole_radius(shank_mesh, frame)
        ai_outer_src = self._ai_shank_outer_radius(source_mesh, fa0)
        est_outer = ai_outer_src * scale_base
        target_outer = inlay_inner_r - max(float(frame["diameter"]) * 0.006, 0.05e-3)
        scale_contact = float(
            np.clip(target_outer / max(est_outer, 1e-9), 0.98, 1.15)
        )
        scale = scale_base * scale_contact
        return scale, {
            "scale_base": scale_base,
            "scale_contact": scale_contact,
            "inlay_inner_r": inlay_inner_r,
            "ai_outer_r_src": ai_outer_src,
            "src_diameter": float(fa0["diameter"]),
            "tgt_diameter": float(frame["diameter"]),
        }

    def _compute_casa_envelope_scale(
        self,
        source_mesh,
        shank_mesh,
        frame: Dict[str, Any],
        M_pose: np.ndarray,
        clearance_mm: float,
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Phase 2: uniform scale so AI outer envelope fits inlay inner wall (inlay locked).
        """
        cfg = self._get_alignment_config()
        info: Dict[str, Any] = {"clearance_mm": float(clearance_mm)}

        posed = source_mesh.copy()
        posed.apply_transform(M_pose)
        inner_p = self._inlay_inner_envelope_profile(shank_mesh, frame)
        outer_p = self._ai_outer_envelope_profile(posed, frame)
        both = inner_p["valid"] & outer_p["valid"]
        info["n_valid_sectors"] = int(both.sum())

        if int(both.sum()) < 6:
            # Use posed diameter: M_pose may include unit-ring normalization (T_norm).
            fa_posed = self._estimate_ring_frame(posed)
            posed_d = float(fa_posed["diameter"])
            raw_d = float(self._estimate_ring_frame(source_mesh)["diameter"])
            src_d = posed_d if posed_d > 1e-6 else raw_d
            diam_ratio = float(frame["diameter"]) / max(src_d, 1e-9)
            contact = 1.0
            if float(fa_posed.get("score", 0.0)) >= 0.20:
                inlay_inner_r = self._inlay_inner_hole_radius(shank_mesh, frame)
                ai_outer = self._ai_shank_outer_radius(posed, fa_posed)
                if ai_outer > 1e-9:
                    target_outer = inlay_inner_r - float(clearance_mm)
                    contact = float(
                        np.clip(target_outer / ai_outer, 0.92, 1.18)
                    )
            s = diam_ratio * contact
            info["fallback"] = "diameter_ratio"
            info["scale_source"] = "posed_diameter_ratio"
            info["src_diameter_posed"] = posed_d
            info["src_diameter_raw"] = raw_d
            info["contact_factor"] = contact
            info["extreme_scale"] = not (
                cfg.casa_scale_min <= s <= cfg.casa_scale_max
            )
            return float(np.clip(s, cfg.casa_scale_min, cfg.casa_scale_max)), info

        targets = inner_p["inner_r"][both] - float(clearance_mm)
        outers = outer_p["outer_r"][both]
        ratios = targets / np.maximum(outers, 1e-9)
        s_uniform = float(np.median(ratios))
        s_robust = float(np.percentile(ratios, 25))
        ratio_std = float(np.std(ratios))

        info["s_uniform"] = s_uniform
        info["s_robust"] = s_robust
        info["ratio_std"] = ratio_std
        info["non_uniform_warning"] = ratio_std > cfg.casa_ratio_std_max

        s = s_robust if info["non_uniform_warning"] else s_uniform
        raw_s = s
        extreme = raw_s < cfg.casa_scale_min or raw_s > cfg.casa_scale_max
        info["extreme_scale"] = bool(extreme)
        if extreme:
            s = float(np.clip(s, cfg.casa_scale_min, cfg.casa_scale_max))
        return s, info

    def _compute_pca_rotation_only_transform(
        self,
        source_mesh,
        target_mesh,
    ) -> Tuple[np.ndarray, float]:
        """PCA orientation + centroid align without AABB scale (CASA fallback)."""
        sc, sa = self._pca_axes(source_mesh)
        tc, ta = self._pca_axes(target_mesh)

        best_iou = -1.0
        best_m = np.eye(4, dtype=np.float64)
        for s1 in (1.0, -1.0):
            for s2 in (1.0, -1.0):
                sa2 = sa.copy()
                sa2[:, 1] *= s1
                sa2[:, 2] *= s2
                if np.linalg.det(sa2) < 0:
                    sa2[:, 2] *= -1
                R = ta @ sa2.T
                T1 = np.eye(4, dtype=np.float64)
                T1[:3, 3] = -sc
                TR = np.eye(4, dtype=np.float64)
                TR[:3, :3] = R
                T2 = np.eye(4, dtype=np.float64)
                T2[:3, 3] = tc
                M = T2 @ TR @ T1
                bmin, bmax = source_mesh.bounds
                corners = np.array(
                    [
                        [x, y, z, 1.0]
                        for x in (bmin[0], bmax[0])
                        for y in (bmin[1], bmax[1])
                        for z in (bmin[2], bmax[2])
                    ],
                    dtype=np.float64,
                )
                tcors = (M @ corners.T).T[:, :3]
                ab = np.array([tcors.min(0), tcors.max(0)])
                ib = np.asarray(target_mesh.bounds, dtype=np.float64)
                inter = np.maximum(
                    0.0, np.minimum(ib[1], ab[1]) - np.maximum(ib[0], ab[0])
                )
                union = np.maximum(ib[1], ab[1]) - np.minimum(ib[0], ab[0])
                iou = float(np.prod(inter) / max(float(np.prod(union)), 1e-12))
                if iou > best_iou:
                    best_iou = iou
                    best_m = M
        return best_m, best_iou

    def _compute_casa_alignment_transform(
        self,
        source_mesh,
        target_mesh,
        angle_steps: int = 36,
    ) -> Tuple[Optional[np.ndarray], Dict[str, Any]]:
        """
        CASA: Contour-Anchored Scale-decoupled Alignment.
        Phase1 contour pose → Phase2 envelope scale → Phase3 ring refinements.
        """
        cfg = self._get_alignment_config()
        shank, setting = self._split_shank_and_setting(target_mesh)
        fa0 = self._estimate_ring_frame(source_mesh)
        fi0 = self._estimate_ring_frame(shank)
        info: Dict[str, Any] = {
            "method": "casa",
            "src_ring_score": float(fa0["score"]),
            "tgt_ring_score": float(fi0["score"]),
            "src_diameter": float(fa0["diameter"]),
            "tgt_diameter": float(fi0["diameter"]),
            "has_setting_parts": setting is not None,
        }

        if fa0["score"] < 0.28 or fi0["score"] < 0.28:
            info["ok"] = False
            info["reason"] = "low_ring_score"
            return None, info

        M_pose, p1 = self._compute_contour_anchored_pose(
            source_mesh, shank, setting, fa0, fi0
        )
        info["phase1"] = p1
        if M_pose is None:
            info["ok"] = False
            info["reason"] = p1.get("reason", "phase1_failed")
            return None, info

        ambiguous = bool(p1.get("ambiguous_pose"))
        pose_conf = float(p1.get("pose_confidence", 0.0))
        info["ambiguous_pose"] = ambiguous
        if ambiguous:
            info["ambiguous_pose_note"] = (
                f"low pose confidence ({pose_conf:.3f}); continuing envelope scale"
            )
            logger.info(
                "CASA phase1 ambiguous_pose (conf=%.3f peak=%.3f); "
                "continuing to envelope scale",
                pose_conf,
                float(p1.get("peak_ratio", 0.0)),
            )

        up_tgt = self._geometric_setting_up(fi0, setting)
        if up_tgt is None:
            up_tgt = self._detect_setting_up(target_mesh, fi0)
        fi = self._frame_with_up(fi0, up_tgt)
        clearance_mm = max(float(fi["diameter"]) * 0.006, 0.05e-3)

        s, p2 = self._compute_casa_envelope_scale(
            source_mesh, shank, fi, M_pose, clearance_mm
        )
        info["phase2"] = p2
        scale_candidates = [float(s)]
        if p2.get("s_uniform") is not None:
            scale_candidates.append(float(p2["s_uniform"]))
        if p2.get("s_robust") is not None:
            scale_candidates.append(float(p2["s_robust"]))
        s_ring, ring_scale_info = self._compute_ring_frame_scale(source_mesh, shank, fi)
        scale_candidates.append(float(s_ring))
        info["ring_frame_scale"] = ring_scale_info

        full_ring_pre, _ = self._detect_full_ring_inlay_mode(target_mesh, fi)
        s, overlap_pick = self._pick_casa_scale_by_overlap(
            source_mesh,
            target_mesh,
            shank,
            setting,
            fi,
            M_pose,
            scale_candidates,
            full_ring_pre,
        )
        p2.update(overlap_pick)
        info["phase2"] = p2
        info["scale"] = float(s)
        if p2.get("extreme_scale") and not cfg.casa_soft_accept:
            raw_s = float(p2.get("s_uniform", s))
            if raw_s < cfg.casa_scale_min or raw_s > cfg.casa_scale_max:
                info["ok"] = False
                info["reason"] = "extreme_scale"
                return None, info

        best_M = self._scale_transform_about_point(M_pose, fi["center"], s)
        best = dict(p1)
        best["scale"] = float(s)

        best_M, best = self._resolve_ring_axis_half_turn(
            source_mesh, shank, setting, fi, best_M, best
        )

        aligned = source_mesh.copy()
        aligned.apply_transform(best_M)
        best["up_cos"] = self._ai_up_alignment(aligned, fi)

        if setting is not None:
            try:
                tip = np.asarray(setting.vertices, dtype=np.float64).mean(axis=0)
                ai_pts = np.asarray(aligned.vertices, dtype=np.float64)
                proj = (ai_pts - fi["center"]) @ fi["up"]
                head = ai_pts[proj >= np.percentile(proj, 80)]
                if len(head) >= 20:
                    head_c = head.mean(axis=0)
                    delta = tip - head_c
                    along = float(delta @ fi["up"]) * fi["up"]
                    before = float(best.get("setting_median", 1e9))
                    max_shift = float(fi["diameter"]) * 0.42
                    shift = along
                    sn = float(np.linalg.norm(shift))
                    if sn > max_shift:
                        shift = shift * (max_shift / sn)
                    trial_M = best_M.copy()
                    trial_M[:3, 3] = trial_M[:3, 3] + shift
                    trial = source_mesh.copy()
                    trial.apply_transform(trial_M)
                    after = self._setting_surface_distance(trial, setting, fi)["median"]
                    shank_after = self._shank_surface_distance(trial, shank, fi)["median"]
                    if after <= before * 1.05 and shank_after <= max(
                        best.get("shank_median", 1e9) * 1.25, fi["diameter"] * 0.08
                    ):
                        best_M = trial_M
                        aligned = trial
                        best["setting_median"] = after
                        best["shank_median"] = shank_after
                        best["seat_shift"] = float(np.linalg.norm(shift))
                        best["up_cos"] = self._ai_up_alignment(aligned, fi)
            except Exception as e:
                logger.debug("CASA seat shift skipped: %s", e)

        best_M, best = self._refine_seating_micro_search(
            source_mesh, best_M, shank, setting, fi, best
        )

        full_ring, fr_reason = self._detect_full_ring_inlay_mode(target_mesh, fi)
        info["full_ring_inlay"] = full_ring
        info["full_ring_reason"] = fr_reason
        if full_ring:
            best_M, env_info = self._refine_full_ring_envelope_alignment(
                source_mesh,
                shank,
                fi,
                best_M,
                clearance_mm=clearance_mm,
                setting_mesh=setting,
            )
            info["envelope"] = env_info

        best_M, overlap_refine = self._refine_alignment_inlay_overlap(
            source_mesh,
            target_mesh,
            shank,
            setting,
            fi,
            best_M,
            full_ring=full_ring,
        )
        info["overlap_refine"] = overlap_refine
        overlap_ratio = float(overlap_refine.get("overlap_after", 0.0))
        info["inlay_overlap_ratio"] = overlap_ratio
        info["inlay_overlap"] = overlap_refine.get("overlap") or {}

        aligned = source_mesh.copy()
        aligned.apply_transform(best_M)
        if full_ring:
            best["shank_median"] = float(
                self._shank_surface_distance(aligned, shank, fi)["median"]
            )
            if setting is not None:
                best["setting_median"] = float(
                    self._setting_surface_distance(aligned, setting, fi)["median"]
                )

        fa_a = self._estimate_ring_frame(aligned)
        axis_dot = abs(float(np.dot(fa_a["axis"], fi["axis"])))
        axis_ang = float(np.degrees(np.arccos(np.clip(axis_dot, -1.0, 1.0))))
        diam_ratio = float(fa_a["diameter"] / max(fi["diameter"], 1e-9))
        shank_annular_gap = self._shank_annular_gap_mm(aligned, shank, fi)
        ang_gap = self._angular_shank_gap_profile(aligned, shank, fi)
        info["angular_gap"] = {k: ang_gap[k] for k in ang_gap if k != "gaps"}

        if full_ring:
            max_prot = float(ang_gap.get("max_protrusion_mm", 999.0))
            gap_ok = max_prot <= max(fi["diameter"] * 0.012, 0.18)
        else:
            gap_ok = shank_annular_gap <= max(fi["diameter"] * 0.025, 0.35)

        ambiguous_fail = (
            ambiguous
            and pose_conf < cfg.casa_min_pose_confidence * 0.65
            and best.get("shank_median", 999.0) > fi["diameter"] * 0.14
        )
        overlap_ok = overlap_ratio >= cfg.casa_min_inlay_overlap_ratio
        ok = (
            axis_ang <= 25.0
            and 0.7 <= diam_ratio <= 1.35
            and best.get("shank_median", 999.0) <= fi["diameter"] * 0.20
            and gap_ok
            and (setting is None or best.get("up_cos", 1.0) >= 0.25)
            and not ambiguous_fail
            and overlap_ok
        )
        soft_ok = (
            cfg.casa_soft_accept
            and not ok
            and axis_ang <= 25.0
            and 0.65 <= diam_ratio <= 1.45
            and (setting is None or best.get("up_cos", -1.0) >= 0.40)
            and overlap_ratio >= max(cfg.casa_min_inlay_overlap_ratio - 0.04, 0.90)
        )

        info.update(best)
        info.update(
            {
                "ok": bool(ok),
                "soft_accept": bool(soft_ok),
                "axis_ang_deg": axis_ang,
                "diam_ratio": diam_ratio,
                "shank_annular_gap_mm": shank_annular_gap,
                "ambiguous_pose": ambiguous,
                "pose_confidence": pose_conf,
                "overlap_ok": bool(overlap_ok),
            }
        )
        if not ok and not soft_ok:
            if not overlap_ok:
                info["reason"] = "inlay_overlap_gate_failed"
                info["overlap_required"] = float(cfg.casa_min_inlay_overlap_ratio)
            else:
                info["reason"] = "quality_gate_failed"
            return None, info
        if soft_ok and not ok:
            info["reason"] = "quality_gate_soft_accept"
        return best_M, info

    def _compute_ring_alignment_transform(
        self,
        source_mesh,
        target_mesh,
        angle_steps: int = 36,
    ) -> Tuple[Optional[np.ndarray], Dict[str, Any]]:
        """
        Jewelry ring alignment:
        - Estimate ring frame on AI body and on inlay SHANK (largest component)
        - Scale by shank ring diameter (not whole AABB / setting height)
        - Align torus axes + search rotation about axis so setting/up matches
        - Score by shank + setting proximity (reject inverted seating); gate quality
        """
        shank, setting = self._split_shank_and_setting(target_mesh)
        fa0 = self._estimate_ring_frame(source_mesh)
        fi0 = self._estimate_ring_frame(shank)
        info: Dict[str, Any] = {
            "src_ring_score": float(fa0["score"]),
            "tgt_ring_score": float(fi0["score"]),
            "src_diameter": float(fa0["diameter"]),
            "tgt_diameter": float(fi0["diameter"]),
            "shank_faces": int(len(shank.faces)),
            "has_setting_parts": setting is not None,
        }
        # Need clear annular structure on both sides
        if fa0["score"] < 0.28 or fi0["score"] < 0.28:
            info["ok"] = False
            info["reason"] = "low_ring_score"
            return None, info

        up_src = self._detect_setting_up(source_mesh, fa0)
        # Prefer geometric shank→prong up when setting parts exist
        up_tgt = self._geometric_setting_up(fi0, setting)
        if up_tgt is None:
            up_tgt = self._detect_setting_up(target_mesh, fi0)
        fi = self._frame_with_up(fi0, up_tgt)

        inlay_inner_r = self._inlay_inner_hole_radius(shank, fi)
        ai_outer_src = self._ai_shank_outer_radius(source_mesh, fa0)
        scale_base = float(fi["diameter"] / max(fa0["diameter"], 1e-9))
        est_outer = ai_outer_src * scale_base
        target_outer = inlay_inner_r - max(fi["diameter"] * 0.006, 0.05e-3)
        scale_contact = float(
            np.clip(target_outer / max(est_outer, 1e-9), 0.98, 1.15)
        )
        scale = scale_base * scale_contact
        info["scale_base"] = scale_base
        info["scale_contact"] = scale_contact
        info["inlay_inner_r"] = inlay_inner_r
        info["ai_outer_r_src"] = ai_outer_src
        info["target_outer_r"] = target_outer
        info["est_outer_scaled"] = est_outer
        best: Optional[Dict[str, Any]] = None
        best_M: Optional[np.ndarray] = None

        for flip in (1.0, -1.0):
            fa = self._frame_with_up(fa0, up_src * flip)
            for s_axis in (1.0, -1.0):
                for k in range(angle_steps):
                    ang = 2.0 * np.pi * k / angle_steps
                    a = fa["axis"]
                    u = fa["up"]
                    ca, sa = float(np.cos(ang)), float(np.sin(ang))
                    up_rot = u * ca + np.cross(a, u) * sa + a * (a @ u) * (1.0 - ca)
                    fa2 = self._frame_with_up({**fa, "axis": a * s_axis}, up_rot)
                    R = fi["R"] @ fa2["R"].T
                    M = np.eye(4, dtype=np.float64)
                    M[:3, :3] = scale * R
                    M[:3, 3] = fi["center"] - scale * (R @ fa["center"])
                    scored = self._score_ring_alignment_pose(
                        source_mesh, shank, setting, fi, M
                    )
                    rec = {
                        **scored,
                        "up_flip": float(flip),
                        "s_axis": float(s_axis),
                        "ang_deg": float(360.0 * k / angle_steps),
                        "scale": scale,
                    }
                    if best is None or scored["score"] < best["score"]:
                        best = rec
                        best_M = M

        assert best is not None and best_M is not None

        # Explicit 0°/180° (±90°) axis resolution — fixes head/shank swap
        best_M, best = self._resolve_ring_axis_half_turn(
            source_mesh, shank, setting, fi, best_M, best
        )

        # Fine seat: translate along target up so AI head approaches setting tip
        aligned = source_mesh.copy()
        aligned.apply_transform(best_M)
        best["up_cos"] = self._ai_up_alignment(aligned, fi)
        if setting is not None:
            try:
                tip = np.asarray(setting.vertices, dtype=np.float64).mean(axis=0)
                ai_pts = np.asarray(aligned.vertices, dtype=np.float64)
                proj = (ai_pts - fi["center"]) @ fi["up"]
                head = ai_pts[proj >= np.percentile(proj, 80)]
                if len(head) >= 20:
                    head_c = head.mean(axis=0)
                    # Move mainly along up toward setting tip
                    delta = tip - head_c
                    along = float(delta @ fi["up"]) * fi["up"]
                    # Cap translation to avoid yanking off the shank
                    before = float(best["setting_median"])
                    max_shift = float(fi["diameter"]) * 0.42
                    if before > float(fi["diameter"]) * 0.09:
                        max_shift = float(fi["diameter"]) * 0.48
                    shift = along
                    sn = float(np.linalg.norm(shift))
                    if sn > max_shift:
                        shift = shift * (max_shift / sn)
                    # Only apply if it reduces setting distance without wrecking band
                    trial_M = best_M.copy()
                    trial_M[:3, 3] = trial_M[:3, 3] + shift
                    trial = source_mesh.copy()
                    trial.apply_transform(trial_M)
                    after = self._setting_surface_distance(trial, setting, fi)["median"]
                    shank_after = self._shank_surface_distance(trial, shank, fi)["median"]
                    if after <= before * 1.05 and shank_after <= max(
                        best["shank_median"] * 1.25, fi["diameter"] * 0.08
                    ):
                        best_M = trial_M
                        aligned = trial
                        best["setting_median"] = after
                        best["shank_median"] = shank_after
                        best["seat_shift"] = float(np.linalg.norm(shift))
                        best["up_cos"] = self._ai_up_alignment(aligned, fi)
                        best["up_mass"] = self._ai_up_mass(aligned, fi)
            except Exception as e:
                logger.debug("setting seat shift skipped: %s", e)

        best_M, best = self._refine_seating_micro_search(
            source_mesh, best_M, shank, setting, fi, best
        )

        full_ring, fr_reason = self._detect_full_ring_inlay_mode(target_mesh, fi)
        info["full_ring_inlay"] = full_ring
        info["full_ring_reason"] = fr_reason
        clearance_mm = max(float(fi["diameter"]) * 0.006, 0.05e-3)
        if full_ring:
            best_M, env_info = self._refine_full_ring_envelope_alignment(
                source_mesh,
                shank,
                fi,
                best_M,
                clearance_mm=clearance_mm,
                setting_mesh=setting,
            )
            info["envelope"] = env_info
            info["method"] = "ring_frame+envelope"

        aligned = source_mesh.copy()
        aligned.apply_transform(best_M)
        if full_ring:
            best["shank_median"] = float(
                self._shank_surface_distance(aligned, shank, fi)["median"]
            )
            if setting is not None:
                best["setting_median"] = float(
                    self._setting_surface_distance(aligned, setting, fi)["median"]
                )

        fa_a = self._estimate_ring_frame(aligned)
        axis_dot = abs(float(np.dot(fa_a["axis"], fi["axis"])))
        axis_ang = float(np.degrees(np.arccos(np.clip(axis_dot, -1.0, 1.0))))
        diam_ratio = float(fa_a["diameter"] / max(fi["diameter"], 1e-9))
        shank_annular_gap = self._shank_annular_gap_mm(aligned, shank, fi)
        ang_gap = self._angular_shank_gap_profile(aligned, shank, fi)
        info["angular_gap"] = {k: ang_gap[k] for k in ang_gap if k != "gaps"}
        cdist = float(np.linalg.norm(fa_a["center"] - fi["center"]))
        if full_ring:
            max_prot = float(ang_gap.get("max_protrusion_mm", 999.0))
            gap_ok = max_prot <= max(fi["diameter"] * 0.012, 0.18)
        else:
            gap_ok = shank_annular_gap <= max(fi["diameter"] * 0.025, 0.35)
        ok = (
            axis_ang <= 25.0
            and 0.7 <= diam_ratio <= 1.35
            and best["shank_median"] <= fi["diameter"] * 0.20
            and gap_ok
            and (setting is None or best.get("up_cos", 1.0) >= 0.25)
        )
        soft_ok = (
            not ok
            and axis_ang <= 25.0
            and 0.65 <= diam_ratio <= 1.45
            and (setting is None or best.get("up_cos", -1.0) >= 0.40)
        )
        info.update(best)
        info.update(
            {
                "ok": bool(ok),
                "soft_accept": bool(soft_ok),
                "method": "ring_frame",
                "axis_ang_deg": axis_ang,
                "diam_ratio": diam_ratio,
                "shank_annular_gap_mm": shank_annular_gap,
                "center_dist": cdist,
            }
        )
        if not ok and not soft_ok:
            info["reason"] = "quality_gate_failed"
            return None, info
        if soft_ok and not ok:
            info["reason"] = "quality_gate_soft_accept"
            logger.info(
                "ring-frame soft-accepted (up_cos=%.2f shank_med=%.4f set_med=%.4f "
                "max_prot=%.3f)",
                best.get("up_cos", -1),
                best.get("shank_median", -1),
                best.get("setting_median", -1),
                float(ang_gap.get("max_protrusion_mm", -1)),
            )
        return best_M, info


    @staticmethod
    def _pca_axes(mesh) -> Tuple[np.ndarray, np.ndarray]:
        pts = np.asarray(mesh.vertices, dtype=np.float64)
        center = pts.mean(axis=0)
        cov = np.cov((pts - center).T)
        eigval, eigvec = np.linalg.eigh(cov)
        order = np.argsort(eigval)[::-1]
        axes = eigvec[:, order]
        if np.linalg.det(axes) < 0:
            axes[:, 2] *= -1
        return center, axes

    def _compute_pca_alignment_transform(self, source_mesh, target_mesh) -> Tuple[np.ndarray, float, float]:
        """
        Robust scale + PCA orientation + centroid align.
        Tries principal-axis sign flips and picks best AABB IoU.
        Returns (transform, scale, iou).
        """
        sc, sa = self._pca_axes(source_mesh)
        tc, ta = self._pca_axes(target_mesh)
        src_extent = float(np.max(source_mesh.bounds[1] - source_mesh.bounds[0]))
        tgt_extent = float(np.max(target_mesh.bounds[1] - target_mesh.bounds[0]))
        scale = float(tgt_extent / max(src_extent, 1e-9))

        best_iou = -1.0
        best_m = np.eye(4, dtype=np.float64)
        for s1 in (1.0, -1.0):
            for s2 in (1.0, -1.0):
                sa2 = sa.copy()
                sa2[:, 1] *= s1
                sa2[:, 2] *= s2
                if np.linalg.det(sa2) < 0:
                    sa2[:, 2] *= -1
                R = ta @ sa2.T
                T1 = np.eye(4, dtype=np.float64)
                T1[:3, 3] = -sc
                TR = np.eye(4, dtype=np.float64)
                TR[:3, :3] = R
                TS = np.eye(4, dtype=np.float64)
                TS[:3, :3] *= scale
                T2 = np.eye(4, dtype=np.float64)
                T2[:3, 3] = tc
                M = T2 @ TS @ TR @ T1
                bmin, bmax = source_mesh.bounds
                corners = np.array(
                    [
                        [x, y, z, 1.0]
                        for x in (bmin[0], bmax[0])
                        for y in (bmin[1], bmax[1])
                        for z in (bmin[2], bmax[2])
                    ],
                    dtype=np.float64,
                )
                tcors = (M @ corners.T).T[:, :3]
                ab = np.array([tcors.min(0), tcors.max(0)])
                ib = np.asarray(target_mesh.bounds, dtype=np.float64)
                inter = np.maximum(0.0, np.minimum(ib[1], ab[1]) - np.maximum(ib[0], ab[0]))
                union = np.maximum(ib[1], ab[1]) - np.minimum(ib[0], ab[0])
                iou = float(np.prod(inter) / max(float(np.prod(union)), 1e-12))
                if iou > best_iou:
                    best_iou = iou
                    best_m = M
        return best_m, scale, best_iou

    def _fix_alignment_axis_ambiguity(
        self,
        source_mesh,
        target_mesh,
        transform: np.ndarray,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        After PCA/ICP fallback, try 0°/180° (±90°) about ring axis and pick the pose
        where AI setting head matches inlay prongs (up_cos + setting distance).
        """
        shank, setting = self._split_shank_and_setting(target_mesh)
        if setting is None or self._mesh_vertex_count(setting) == 0:
            return transform, {"skipped": True, "reason": "no_setting"}
        fi0 = self._estimate_ring_frame(shank)
        up = self._geometric_setting_up(fi0, setting)
        if up is None:
            up = self._detect_setting_up(target_mesh, fi0)
        frame = self._frame_with_up(fi0, up)
        M = np.asarray(transform, dtype=np.float64)
        init = self._score_ring_alignment_pose(source_mesh, shank, setting, frame, M)
        init_rec = {**init, "method": "pca_pre_resolve"}
        best_M, best = self._resolve_ring_axis_half_turn(
            source_mesh, shank, setting, frame, M, init_rec
        )
        info = {
            "before_up_cos": init.get("up_cos"),
            "after_up_cos": best.get("up_cos"),
            "before_setting_median": init.get("setting_median"),
            "after_setting_median": best.get("setting_median"),
            "axis_half_turn_tried": best.get("axis_half_turn_tried"),
            "applied": bool(best.get("up_cos", -2) > init.get("up_cos", -2) + 0.15
                            or best.get("setting_median", 1e9) < init.get("setting_median", 1e9) * 0.85),
        }
        if info["applied"]:
            logger.info(
                "PCA axis ambiguity resolved: up_cos %.2f -> %.2f set_med %.3f -> %.3f",
                init.get("up_cos", 0),
                best.get("up_cos", 0),
                init.get("setting_median", 0),
                best.get("setting_median", 0),
            )
            return best_M, info
        return transform, info

    def _compute_setting_region_transform(self, source_mesh, target_mesh) -> np.ndarray:
        """
        Option C fallback: align using top setting AABB only (upper 35% along
        the axis of greatest target extent), then uniform scale + center.
        """
        tgt_bounds = np.asarray(target_mesh.bounds, dtype=np.float64)
        tgt_ext = np.maximum(tgt_bounds[1] - tgt_bounds[0], 1e-9)
        axis = int(np.argmax(tgt_ext))
        # Prefer the end farther from overall centroid as "setting top"
        tgt_pts = np.asarray(target_mesh.vertices, dtype=np.float64)
        tgt_center = tgt_pts.mean(axis=0)
        lo = tgt_bounds[0, axis]
        hi = tgt_bounds[1, axis]
        cut = lo + 0.65 * (hi - lo)
        top_mask = tgt_pts[:, axis] >= cut
        if int(top_mask.sum()) < 32:
            top_mask = tgt_pts[:, axis] >= (lo + 0.5 * (hi - lo))
        top_tgt = tgt_pts[top_mask]
        top_tgt_bounds = np.array([top_tgt.min(0), top_tgt.max(0)], dtype=np.float64)

        src_bounds = np.asarray(source_mesh.bounds, dtype=np.float64)
        src_pts = np.asarray(source_mesh.vertices, dtype=np.float64)
        src_ext = np.maximum(src_bounds[1] - src_bounds[0], 1e-9)
        src_axis = int(np.argmax(src_ext))
        s_lo = src_bounds[0, src_axis]
        s_hi = src_bounds[1, src_axis]
        s_cut = s_lo + 0.65 * (s_hi - s_lo)
        top_src = src_pts[src_pts[:, src_axis] >= s_cut]
        if len(top_src) < 32:
            top_src = src_pts
        top_src_bounds = np.array([top_src.min(0), top_src.max(0)], dtype=np.float64)

        src_c = (top_src_bounds[0] + top_src_bounds[1]) * 0.5
        tgt_c = (top_tgt_bounds[0] + top_tgt_bounds[1]) * 0.5
        src_e = float(np.max(top_src_bounds[1] - top_src_bounds[0]))
        tgt_e = float(np.max(top_tgt_bounds[1] - top_tgt_bounds[0]))
        scale = float(tgt_e / max(src_e, 1e-9))
        # Prefer global extent scale if setting regions are tiny/noisy
        global_scale = float(
            np.max(tgt_bounds[1] - tgt_bounds[0])
            / max(float(np.max(src_bounds[1] - src_bounds[0])), 1e-9)
        )
        if scale < global_scale * 0.3 or scale > global_scale * 3.0:
            scale = global_scale
            src_c = (src_bounds[0] + src_bounds[1]) * 0.5
            tgt_c = (tgt_bounds[0] + tgt_bounds[1]) * 0.5

        transform = np.eye(4, dtype=np.float64)
        transform[:3, :3] *= scale
        transform[:3, 3] = tgt_c - scale * src_c
        return transform

    def _compute_bbox_alignment_transform(self, source_mesh, target_mesh) -> np.ndarray:
        """将 AI 归一化网格对齐到镶嵌底座坐标系（质心 + 统一尺度）。"""
        src_bounds = np.asarray(source_mesh.bounds, dtype=np.float64)
        tgt_bounds = np.asarray(target_mesh.bounds, dtype=np.float64)
        src_center = (src_bounds[0] + src_bounds[1]) * 0.5
        tgt_center = (tgt_bounds[0] + tgt_bounds[1]) * 0.5
        src_extent = np.maximum(src_bounds[1] - src_bounds[0], 1e-9)
        tgt_extent = np.maximum(tgt_bounds[1] - tgt_bounds[0], 1e-9)
        scale = float(np.max(tgt_extent) / max(float(np.max(src_extent)), 1e-9))

        transform = np.eye(4, dtype=np.float64)
        transform[:3, :3] *= scale
        transform[:3, 3] = tgt_center - scale * src_center
        return transform

    def _apply_trimesh_transform(
        self,
        mesh_path: str,
        transformation: np.ndarray,
        output_path: str,
    ) -> str:
        """使用 Trimesh 应用 4x4 变换并导出（比 Open3D 写 STL 更稳）。"""
        mesh = self._load_trimesh_mesh(mesh_path)
        if self._mesh_vertex_count(mesh) == 0:
            raise ValueError(f"网格为空，无法变换: {mesh_path}")

        mesh = mesh.copy()
        mesh.apply_transform(transformation)
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        ext = os.path.splitext(output_path)[1].lstrip(".").lower()
        mesh.export(output_path, file_type=ext or None)
        if not self._is_valid_output_file(output_path):
            raise ValueError(f"变换后输出无效: {output_path}")
        return output_path


    def align_generated_to_base(
        self,
        generated_mesh_path: str,
        base_mesh_path: str,
        output_path: str,
        enable_icp: bool = True,
        max_iterations: int = 50,
        cleaned_base_path: Optional[str] = None,
    ) -> Tuple[str, np.ndarray, Dict[str, Any]]:
        """
        Align AI body to cleaned inlay for jewelry replacement.

        Prefer ring-aware alignment (shank torus axis + diameter + setting/up
        search). Fall back to PCA→ICP→setting-region only if ring frame fails.
        Reject ICP refinements that worsen shank proximity.
        """
        source = self._load_trimesh_mesh(generated_mesh_path)
        # Prefer pre-sanitized inlay; otherwise sanitize in-memory
        if cleaned_base_path and self._is_valid_output_file(cleaned_base_path):
            target = self._load_trimesh_mesh(cleaned_base_path)
            info_sanitize: Dict[str, Any] = {"cleaned_base_path": cleaned_base_path}
        else:
            target_raw = self._load_trimesh_mesh(base_mesh_path)
            filtered, junk_stats = self._filter_junk_components(target_raw)
            target, cluster_stats = self._select_primary_assembly(filtered)
            info_sanitize = {"junk_filter": junk_stats, "primary_assembly": cluster_stats}

        # Also drop tiny floaters on AI body
        try:
            src_filtered, src_junk = self._filter_junk_components(source)
            if isinstance(src_filtered, list):
                import trimesh

                source = (
                    trimesh.util.concatenate(src_filtered)
                    if len(src_filtered) > 1
                    else src_filtered[0]
                )
            else:
                source = src_filtered
            info_sanitize["source_junk_filter"] = src_junk
        except Exception as e:
            logger.debug("AI junk filter skipped: %s", e)

        if self._mesh_vertex_count(source) == 0:
            raise ValueError(f"source mesh empty: {generated_mesh_path}")
        if self._mesh_vertex_count(target) == 0:
            raise ValueError(f"target mesh empty: {base_mesh_path}")

        self._log_mesh_extents("align/source_before", source)
        self._log_mesh_extents("align/target_cleaned", target)

        # Export cleaned target for downstream crop/merge if requested path given
        target_path_for_icp = cleaned_base_path
        if not target_path_for_icp:
            target_path_for_icp = output_path + ".inlay_clean.tmp.glb"
            os.makedirs(os.path.dirname(target_path_for_icp) or ".", exist_ok=True)
            target.export(target_path_for_icp, file_type="glb")

        # Export shank-only target for ICP refine (avoid locking onto prongs)
        shank = self._largest_component(target)
        shank_tmp = output_path + ".shank.tmp.glb"
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        shank.export(shank_tmp, file_type="glb")

        src_tmp = output_path + ".src_clean.tmp.glb"
        source.export(src_tmp, file_type="glb")

        info: Dict[str, Any] = {"sanitize": info_sanitize}
        transform: Optional[np.ndarray] = None
        scale = 1.0
        align_cfg = self._get_alignment_config()

        # ---- Primary: CASA or ring-frame alignment ----
        if align_cfg.alignment_mode == "casa":
            try:
                casa_M, casa_info = self._compute_casa_alignment_transform(source, target)
                info["casa"] = casa_info
                if casa_M is not None and (
                    casa_info.get("ok")
                    or (align_cfg.casa_soft_accept and casa_info.get("soft_accept"))
                ):
                    transform = casa_M
                    scale = float(casa_info.get("scale", 1.0))
                    info["method"] = "casa"
                    info["scale"] = scale
                    logger.info(
                        "CASA alignment accepted: scale=%.4f shank_med=%.4f "
                        "set_med=%.4f up_cos=%.2f axis_ang=%.2f diam_ratio=%.3f "
                        "pose_conf=%.2f peak_ratio=%.2f soft=%s",
                        scale,
                        casa_info.get("shank_median", -1),
                        casa_info.get("setting_median", -1),
                        casa_info.get("up_cos", -1),
                        casa_info.get("axis_ang_deg", -1),
                        casa_info.get("diam_ratio", -1),
                        casa_info.get("pose_confidence", -1),
                        casa_info.get("peak_ratio", -1),
                        bool(casa_info.get("soft_accept")),
                    )
                else:
                    logger.warning(
                        "CASA alignment rejected (%s); falling back to ring-frame/PCA",
                        casa_info.get("reason", "unknown"),
                    )
            except Exception as e:
                logger.warning("CASA alignment failed (%s); falling back to PCA/envelope", e)
                info["casa"] = {"ok": False, "reason": f"exception:{e}"}
        else:
            try:
                ring_M, ring_info = self._compute_ring_alignment_transform(source, target)
                info["ring"] = ring_info
                if ring_M is not None and (
                    ring_info.get("ok") or ring_info.get("soft_accept")
                ):
                    transform = ring_M
                    scale = float(ring_info.get("scale", 1.0))
                    info["method"] = "ring_frame"
                    info["scale"] = scale
                    logger.info(
                        "ring-frame alignment accepted: scale=%.4f shank_med=%.4f "
                        "set_med=%.4f up_cos=%.2f axis_ang=%.2f diam_ratio=%.3f ang=%.1f "
                        "soft=%s",
                        scale,
                        ring_info.get("shank_median", -1),
                        ring_info.get("setting_median", -1),
                        ring_info.get("up_cos", -1),
                        ring_info.get("axis_ang_deg", -1),
                        ring_info.get("diam_ratio", -1),
                        ring_info.get("ang_deg", -1),
                        bool(ring_info.get("soft_accept")),
                    )
                else:
                    logger.warning(
                        "ring-frame alignment rejected (%s); falling back to PCA/ICP",
                        ring_info.get("reason", "unknown"),
                    )
            except Exception as e:
                logger.warning("ring-frame alignment failed (%s); falling back to PCA/ICP", e)
                info["ring"] = {"ok": False, "reason": f"exception:{e}"}

        # ---- Fallback: ring-frame then PCA (+ optional ICP / setting-region) ----
        if transform is None and align_cfg.alignment_mode == "casa":
            try:
                ring_M, ring_info = self._compute_ring_alignment_transform(source, target)
                info["ring_fallback"] = ring_info
                if ring_M is not None and (
                    ring_info.get("ok") or ring_info.get("soft_accept")
                ):
                    transform = ring_M
                    scale = float(ring_info.get("scale", 1.0))
                    info["method"] = "ring_frame_fallback"
                    info["scale"] = scale
                    logger.info(
                        "CASA rejected; ring-frame fallback accepted: scale=%.4f "
                        "shank_med=%.4f set_med=%.4f diam_ratio=%.3f",
                        scale,
                        ring_info.get("shank_median", -1),
                        ring_info.get("setting_median", -1),
                        ring_info.get("diam_ratio", -1),
                    )
            except Exception as e:
                logger.warning(
                    "ring-frame fallback failed (%s); continuing to PCA/envelope",
                    e,
                )
                info["ring_fallback"] = {"ok": False, "reason": f"exception:{e}"}

        if transform is None:
            if align_cfg.alignment_mode == "casa":
                transform_rot, pca_iou = self._compute_pca_rotation_only_transform(
                    source, target
                )
                transform_rot, amb_info = self._fix_alignment_axis_ambiguity(
                    source, target, transform_rot
                )
                info["pca_axis_resolve"] = amb_info
                shank_fb, setting_fb = self._split_shank_and_setting(target)
                fi0_fb = self._estimate_ring_frame(shank_fb)
                up_fb = self._geometric_setting_up(fi0_fb, setting_fb)
                if up_fb is None:
                    up_fb = self._detect_setting_up(target, fi0_fb)
                fi_fb = self._frame_with_up(fi0_fb, up_fb)
                clearance_fb = max(float(fi_fb["diameter"]) * 0.006, 0.05e-3)
                s_fb, scale_info = self._compute_casa_envelope_scale(
                    source, shank_fb, fi_fb, transform_rot, clearance_fb
                )
                s_ring, ring_scale_info = self._compute_ring_frame_scale(
                    source, shank_fb, fi_fb
                )
                scale_info["ring_frame_scale"] = s_ring
                scale_info["ring_scale_detail"] = ring_scale_info
                if (
                    scale_info.get("fallback") == "diameter_ratio"
                    or int(scale_info.get("n_valid_sectors", 0)) < 6
                    or scale_info.get("extreme_scale")
                ):
                    s_fb = s_ring
                    scale_info["scale_source"] = "ring_frame_diameter"
                    scale_info["envelope_scale_rejected"] = True
                transform = self._scale_transform_about_point(
                    transform_rot, fi_fb["center"], s_fb
                )
                scale = float(s_fb)
                info["casa_fallback"] = scale_info
                info.update(
                    {
                        "method": "casa_pca_fallback",
                        "scale": scale,
                        "pca_iou": float(pca_iou),
                    }
                )
            else:
                transform, scale, pca_iou = self._compute_pca_alignment_transform(
                    source, target
                )
                transform, amb_info = self._fix_alignment_axis_ambiguity(
                    source, target, transform
                )
                info["pca_axis_resolve"] = amb_info
                info.update(
                    {
                        "method": "pca",
                        "scale": scale,
                        "pca_iou": float(pca_iou),
                    }
                )

        if scale < 0.01 or scale > 1000:
            logger.warning(
                "alignment scale is extreme (%.6g); continuing but result may be wrong",
                scale,
            )

        pre_icp_path = output_path + ".pre_icp.tmp.glb"
        self._apply_trimesh_transform(src_tmp, transform, pre_icp_path)

        # Optional ICP refine against SHANK only; keep only if it improves proximity
        # without destroying setting seating (prior bug: shank-only ICP flipped the head).
        if enable_icp and self._open3d_available:
            try:
                fi0_icp = self._estimate_ring_frame(shank)
                _, setting_for_icp = self._split_shank_and_setting(target)
                up_icp = self._geometric_setting_up(fi0_icp, setting_for_icp)
                if up_icp is None:
                    up_icp = self._detect_setting_up(target, fi0_icp)
                shank_frame = self._frame_with_up(fi0_icp, up_icp)
                pre_mesh = self._load_trimesh_mesh(pre_icp_path)
                before = self._shank_surface_distance(pre_mesh, shank, shank_frame)
                set_before = self._setting_surface_distance(
                    pre_mesh, setting_for_icp, shank_frame
                )
                up_before = self._ai_up_alignment(pre_mesh, shank_frame)

                icp_transform, rmse, fitness = self.icp_align(
                    pre_icp_path,
                    shank_tmp,
                    max_iterations=max_iterations,
                    init_transform=np.eye(4),
                )
                info["icp_rmse"] = float(rmse)
                info["icp_fitness"] = float(fitness)

                # Stricter gate: jewelry needs real overlap; 0.15 was too weak
                if fitness >= 0.25:
                    trial = icp_transform @ transform
                    trial_path = output_path + ".icp_trial.tmp.glb"
                    self._apply_trimesh_transform(src_tmp, trial, trial_path)
                    trial_mesh = self._load_trimesh_mesh(trial_path)
                    after = self._shank_surface_distance(trial_mesh, shank, shank_frame)
                    set_after = self._setting_surface_distance(
                        trial_mesh, setting_for_icp, shank_frame
                    )
                    up_after = self._ai_up_alignment(trial_mesh, shank_frame)
                    info["icp_shank_before"] = before
                    info["icp_shank_after"] = after
                    info["icp_setting_before"] = set_before
                    info["icp_setting_after"] = set_after
                    info["icp_up_before"] = up_before
                    info["icp_up_after"] = up_after
                    improved = after["median"] <= before["median"] * 1.05
                    setting_ok = (
                        setting_for_icp is None
                        or set_after["median"] <= set_before["median"] * 1.08
                    )
                    up_ok = up_after >= min(up_before - 0.12, 0.25) or (
                        setting_for_icp is None
                    )
                    # Also reject if ring axis is destroyed
                    fa_t = self._estimate_ring_frame(trial_mesh)
                    axis_ang = float(
                        np.degrees(
                            np.arccos(
                                np.clip(
                                    abs(float(np.dot(fa_t["axis"], shank_frame["axis"]))),
                                    -1.0,
                                    1.0,
                                )
                            )
                        )
                    )
                    info["icp_axis_ang_deg"] = axis_ang
                    if improved and setting_ok and up_ok and axis_ang <= 30.0:
                        transform = trial
                        info["method"] = info.get("method", "pca") + "+icp"
                        logger.info(
                            "ICP refine accepted: fitness=%.3f shank_med %.4f -> %.4f "
                            "set_med %.4f -> %.4f up %.2f -> %.2f",
                            fitness,
                            before["median"],
                            after["median"],
                            set_before["median"],
                            set_after["median"],
                            up_before,
                            up_after,
                        )
                    else:
                        logger.warning(
                            "ICP refine rejected (fitness=%.3f shank_ok=%s set_ok=%s "
                            "up_ok=%s axis_ang=%.1f); keeping pre-ICP",
                            fitness,
                            improved,
                            setting_ok,
                            up_ok,
                            axis_ang,
                        )
                        # Translation-only: shank ICP often rotates the head; try shift only.
                        if not setting_ok and fitness >= 0.5:
                            trans_only = np.eye(4, dtype=np.float64)
                            trans_only[:3, 3] = np.asarray(
                                icp_transform[:3, 3], dtype=np.float64
                            )
                            trial_t = trans_only @ transform
                            trial_path = output_path + ".icp_trans.tmp.glb"
                            self._apply_trimesh_transform(src_tmp, trial_t, trial_path)
                            trial_mesh = self._load_trimesh_mesh(trial_path)
                            set_t = self._setting_surface_distance(
                                trial_mesh, setting_for_icp, shank_frame
                            )
                            sh_t = self._shank_surface_distance(
                                trial_mesh, shank, shank_frame
                            )
                            up_t = self._ai_up_alignment(trial_mesh, shank_frame)
                            trans_ok = (
                                set_t["median"] <= set_before["median"] * 1.02
                                and sh_t["median"]
                                <= max(before["median"] * 1.08, shank_frame["diameter"] * 0.22)
                                and up_t >= min(up_before - 0.08, 0.3)
                            )
                            info["icp_translation_only"] = {
                                "accepted": bool(trans_ok),
                                "set_after": set_t,
                                "shank_after": sh_t,
                            }
                            if trans_ok:
                                transform = trial_t
                                info["method"] = info.get("method", "pca") + "+icp_trans"
                                logger.info(
                                    "ICP translation-only accepted: set_med %.4f -> %.4f "
                                    "shank_med %.4f -> %.4f",
                                    set_before["median"],
                                    set_t["median"],
                                    before["median"],
                                    sh_t["median"],
                                )
                            try:
                                if os.path.isfile(trial_path):
                                    os.remove(trial_path)
                            except OSError:
                                pass
                    try:
                        if os.path.isfile(trial_path):
                            os.remove(trial_path)
                    except OSError:
                        pass
                else:
                    logger.warning(
                        "ICP refine skipped (fitness=%.4f < 0.25)",
                        fitness,
                    )
                    # PCA-only path: try setting-region recentering if no ring frame
                    if info.get("method") == "pca":
                        try:
                            pre = self._load_trimesh_mesh(pre_icp_path)
                            setting_t = self._compute_setting_region_transform(pre, target)
                            transform = setting_t @ transform
                            info["method"] = "pca+setting_region"
                            info["setting_region_fallback"] = True
                        except Exception as e:
                            logger.warning("setting-region fallback failed: %s", e)
            except Exception as e:
                logger.warning("ICP refine failed: %s", e)
                if info.get("method") == "pca":
                    try:
                        pre = self._load_trimesh_mesh(pre_icp_path)
                        setting_t = self._compute_setting_region_transform(pre, target)
                        transform = setting_t @ transform
                        info["method"] = "pca+setting_region"
                        info["setting_region_fallback"] = True
                    except Exception as e2:
                        logger.warning("setting-region fallback failed: %s", e2)

        self._apply_trimesh_transform(src_tmp, transform, output_path)

        if not self._is_valid_output_file(output_path, min_bytes=128):
            raise RuntimeError(f"aligned output invalid or too small: {output_path}")
        aligned = self._load_trimesh_mesh(output_path)
        if self._mesh_vertex_count(aligned) == 0:
            raise RuntimeError(f"aligned output has 0 vertices: {output_path}")

        # Post-ICP overlap refinement before bore edits (all alignment methods)
        try:
            shank_ov, setting_ov = self._split_shank_and_setting(target)
            fi_ov = self._estimate_ring_frame(shank_ov)
            up_ov = self._geometric_setting_up(fi_ov, setting_ov)
            if up_ov is None:
                up_ov = self._detect_setting_up(target, fi_ov)
            frame_ov = self._frame_with_up(fi_ov, up_ov)
            full_ring_ov, _ = self._detect_full_ring_inlay_mode(target, frame_ov)
            ratio_pre, overlap_pre = self._compute_inlay_ai_overlap_ratio(
                target,
                aligned,
                shank_mesh=shank_ov,
                setting_mesh=setting_ov,
                frame=frame_ov,
                full_ring=full_ring_ov,
            )
            info["inlay_overlap_pre_bore"] = overlap_pre
            info["inlay_overlap_ratio_pre_bore"] = ratio_pre
            if ratio_pre < align_cfg.casa_min_inlay_overlap_ratio:
                refined_M, refine_info = self._refine_alignment_inlay_overlap(
                    source,
                    target,
                    shank_ov,
                    setting_ov,
                    frame_ov,
                    transform,
                    full_ring=full_ring_ov,
                )
                info["overlap_refine_post_icp"] = refine_info
                if refine_info.get("refined") or refine_info.get("meets_target"):
                    transform = refined_M
                    self._apply_trimesh_transform(src_tmp, transform, output_path)
                    aligned = self._load_trimesh_mesh(output_path)
        except Exception as e:
            logger.warning("overlap refinement post-ICP skipped: %s", e)

        # Final quality report (needed before reliability gate and bore edits)
        try:
            shank2, setting2 = self._split_shank_and_setting(target)
            fi0q = self._estimate_ring_frame(shank2)
            up_q = self._geometric_setting_up(fi0q, setting2)
            if up_q is None:
                up_q = self._detect_setting_up(target, fi0q)
            sf = self._frame_with_up(fi0q, up_q)
            q = self._shank_surface_distance(aligned, shank2, sf)
            qs = self._setting_surface_distance(aligned, setting2, sf)
            up_c = self._ai_up_alignment(aligned, sf)
            fa = self._estimate_ring_frame(aligned)
            axis_ang = float(
                np.degrees(
                    np.arccos(
                        np.clip(abs(float(np.dot(fa["axis"], sf["axis"]))), -1.0, 1.0)
                    )
                )
            )
            info["final_quality"] = {
                "shank_median": q["median"],
                "shank_mean": q["mean"],
                "setting_median": qs["median"],
                "up_cos": up_c,
                "axis_ang_deg": axis_ang,
                "diam_ratio": float(fa["diameter"] / max(sf["diameter"], 1e-9)),
            }
            if (
                axis_ang > 35
                or q["median"] > sf["diameter"] * 0.25
                or (setting2 is not None and up_c < 0.2)
            ):
                logger.warning(
                    "alignment quality still poor after all stages: %s",
                    info["final_quality"],
                )
                info["quality_warning"] = True
        except Exception as e:
            logger.debug("final quality check skipped: %s", e)

        for tmp in (src_tmp, pre_icp_path, shank_tmp):
            try:
                if tmp and os.path.isfile(tmp):
                    os.remove(tmp)
            except OSError:
                pass
        if not cleaned_base_path:
            try:
                if target_path_for_icp and os.path.isfile(target_path_for_icp):
                    os.remove(target_path_for_icp)
            except OSError:
                pass

        # Full-ring: band-limited envelope shrink + bore restoration (contact vs bore)
        ring_info_post = info.get("casa") or info.get("ring") or {}
        ring_accepted = bool(ring_info_post.get("ok") or ring_info_post.get("soft_accept"))
        if ring_accepted:
            try:
                shank_bore, setting_bore = self._split_shank_and_setting(target)
                fi_bore = self._estimate_ring_frame(shank_bore)
                up_bore = self._geometric_setting_up(fi_bore, setting_bore)
                if up_bore is None:
                    up_bore = self._detect_setting_up(target, fi_bore)
                frame_bore = self._frame_with_up(fi_bore, up_bore)
                full_ring_bore, _ = self._detect_full_ring_inlay_mode(target, frame_bore)
                ring_info_post = info.get("casa") or info.get("ring") or {}
                env_info = ring_info_post.get("envelope") or {}
                env_scale = float(env_info.get("envelope_scale", 1.0))
                bore_adjusted = False
                if full_ring_bore and env_scale < 0.999:
                    aligned, band_stats = self._apply_band_limited_radial_scale(
                        aligned, shank_bore, frame_bore, env_scale
                    )
                    info["envelope_band_scale"] = band_stats
                    bore_adjusted = True
                if full_ring_bore or ring_info_post.get("ok"):
                    aligned, bore_stats = self._preserve_ring_bore_radius(
                        aligned, shank_bore, frame_bore
                    )
                    info["bore_preservation"] = bore_stats
                    bore_adjusted = True
                if bore_adjusted:
                    ext = os.path.splitext(output_path)[1].lstrip(".").lower() or "glb"
                    aligned.export(output_path, file_type=ext)
                    self._log_mesh_extents("align/bore_preserved", aligned)
            except Exception as e:
                logger.warning("bore preservation skipped: %s", e)
        else:
            info["bore_preservation"] = {"skipped": True, "reason": "ring_frame_not_accepted"}

        # Hard gate: inlay volume must overlap aligned AI by >= 98% (sampled)
        shank_gate, setting_gate = self._split_shank_and_setting(target)
        fi_gate = self._estimate_ring_frame(shank_gate)
        up_gate = self._geometric_setting_up(fi_gate, setting_gate)
        if up_gate is None:
            up_gate = self._detect_setting_up(target, fi_gate)
        frame_gate = self._frame_with_up(fi_gate, up_gate)
        full_ring_gate, _ = self._detect_full_ring_inlay_mode(target, frame_gate)
        ratio_final, overlap_final = self._compute_inlay_ai_overlap_ratio(
            target,
            aligned,
            shank_mesh=shank_gate,
            setting_mesh=setting_gate,
            frame=frame_gate,
            full_ring=full_ring_gate,
        )
        info["inlay_overlap_final"] = overlap_final
        info["inlay_overlap_ratio"] = ratio_final
        if ratio_final < align_cfg.casa_min_inlay_overlap_ratio:
            raise ValueError(
                f"inlay-AI overlap gate failed: {ratio_final:.4f} < "
                f"{align_cfg.casa_min_inlay_overlap_ratio:.4f} "
                f"(region={overlap_final.get('region')}, method={info.get('method')})"
            )

        self._log_mesh_extents("align/source_after", aligned)

        logger.info(
            "alignment done: %s -> %s (method=%s scale=%.6g icp_fitness=%s)",
            generated_mesh_path,
            output_path,
            info.get("method"),
            info.get("scale", scale),
            info.get("icp_fitness"),
        )
        return output_path, transform, info

    @staticmethod
    def _apply_trimesh_transform_mesh(mesh, transform: np.ndarray):
        out = mesh.copy()
        out.apply_transform(np.asarray(transform, dtype=np.float64))
        return out


    # ============================================================
    # ICP 点云对齐
    # ============================================================

    def icp_align(
        self,
        source_mesh_path: str,
        target_mesh_path: str,
        max_iterations: int = 50,
        max_correspondence_distance: float = 0.05,
        init_transform: Optional[np.ndarray] = None,
    ) -> Tuple[np.ndarray, float, float]:
        """
        ICP点云对齐

        将源网格对齐到目标网格的坐标系

        Returns:
            Tuple[变换矩阵(4x4), 适配误差, fitness]
        """
        if not self._open3d_available:
            logger.error("Open3D 不可用，无法执行ICP对齐")
            return np.eye(4), float("inf"), 0.0

        import open3d as o3d

        # 加载网格并转为点云
        source_mesh = o3d.io.read_triangle_mesh(source_mesh_path)
        target_mesh = o3d.io.read_triangle_mesh(target_mesh_path)

        if not source_mesh.has_vertices():
            raise ValueError(f"源网格为空: {source_mesh_path}")
        if not target_mesh.has_vertices():
            raise ValueError(f"目标网格为空: {target_mesh_path}")

        # 网格表面采样为点云
        source_pcd = source_mesh.sample_points_uniformly(number_of_points=5000)
        target_pcd = target_mesh.sample_points_uniformly(number_of_points=5000)

        # 估计法线
        source_pcd.estimate_normals()
        target_pcd.estimate_normals()

        tgt_bounds = target_mesh.get_axis_aligned_bounding_box()
        tgt_extent = np.asarray(tgt_bounds.get_extent(), dtype=np.float64)
        adaptive_distance = max(
            float(np.max(tgt_extent) * 0.08),
            float(max_correspondence_distance),
            0.5,
        )

        # 初始变换：bbox 对齐（AI 网格常为归一化尺度，直接 ICP 会 fitness=0）
        if init_transform is not None:
            trans_init = init_transform
        else:
            import trimesh

            src_tm = self._load_trimesh_mesh(source_mesh_path)
            tgt_tm = self._load_trimesh_mesh(target_mesh_path)
            trans_init = self._compute_bbox_alignment_transform(src_tm, tgt_tm)

        logger.info(
            "开始ICP对齐: 最大迭代=%s, 对应距离=%.4f",
            max_iterations,
            adaptive_distance,
        )

        reg_p2l = o3d.pipelines.registration.registration_icp(
            source_pcd,
            target_pcd,
            adaptive_distance,
            trans_init,
            o3d.pipelines.registration.TransformationEstimationPointToPlane(),
            o3d.pipelines.registration.ICPConvergenceCriteria(
                relative_fitness=1e-6,
                relative_rmse=1e-6,
                max_iteration=max_iterations,
            ),
        )

        transformation = reg_p2l.transformation
        fitness = reg_p2l.fitness
        rmse = reg_p2l.inlier_rmse

        logger.info(
            "ICP对齐完成: fitness=%.4f, RMSE=%.6f",
            fitness,
            rmse,
        )

        return transformation, rmse, fitness

    def apply_icp_transform(
        self,
        mesh_path: str,
        transformation: np.ndarray,
        output_path: str,
    ) -> str:
        """
        将ICP变换应用到网格并保存

        Args:
            mesh_path: 输入网格路径
            transformation: 4x4变换矩阵
            output_path: 输出路径

        Returns:
            输出文件路径
        """
        if not self._open3d_available:
            logger.error("Open3D 不可用")
            return mesh_path

        import open3d as o3d

        mesh = o3d.io.read_triangle_mesh(mesh_path)
        if len(mesh.vertices) == 0:
            raise ValueError(f"输入网格为空: {mesh_path}")

        mesh.transform(transformation)
        if not mesh.has_vertex_normals():
            mesh.compute_vertex_normals()
        if not mesh.has_triangle_normals():
            mesh.compute_triangle_normals()

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        if not o3d.io.write_triangle_mesh(output_path, mesh):
            raise RuntimeError(f"Open3D 写入失败: {output_path}")
        if not self._is_valid_output_file(output_path):
            raise RuntimeError(f"变换输出文件无效: {output_path}")

        logger.info("变换已应用并保存: %s", output_path)
        return output_path

    # ============================================================
    # SDF 布尔融合
    # ============================================================

    def boolean_union(
        self,
        mesh_a_path: str,
        mesh_b_path: str,
        output_path: str,
    ) -> str:
        """
        Boolean union of two meshes into a single body.
        Tries manifold/blender engines; may fall back to simple merge with a flag.
        """
        if not self._trimesh_available:
            raise RuntimeError("Trimesh unavailable; cannot perform boolean union")

        import trimesh

        mesh_a = trimesh.load(mesh_a_path)
        mesh_b = trimesh.load(mesh_b_path)

        if isinstance(mesh_a, trimesh.Scene):
            mesh_a = mesh_a.dump(concatenate=True)
        if isinstance(mesh_b, trimesh.Scene):
            mesh_b = mesh_b.dump(concatenate=True)

        self._log_mesh_extents("boolean/A", mesh_a)
        self._log_mesh_extents("boolean/B", mesh_b)
        logger.info(
            "boolean union: A(%s verts) + B(%s verts)",
            mesh_a.vertices.shape[0],
            mesh_b.vertices.shape[0],
        )

        used_simple_merge = False
        try:
            result = self._boolean_union_manifold(mesh_a, mesh_b)
            if result is not None:
                os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
                result.export(output_path)
                logger.info("boolean union succeeded: %s", output_path)
                return output_path
        except Exception as e:
            logger.warning("boolean union engines failed, falling back to simple merge: %s", e)

        result = self._simple_merge(mesh_a, mesh_b)
        used_simple_merge = True
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        result.export(output_path)
        logger.warning(
            "boolean union fell back to simple_merge (dual body risk): %s [flag=used_simple_merge=%s]",
            output_path,
            used_simple_merge,
        )
        return output_path

    def _boolean_union_manifold(self, mesh_a, mesh_b):
        """
        Boolean union preferring trimesh.boolean.union engines, then manifold3d API.
        Returns a Trimesh or None if all engines fail.
        """
        import trimesh

        # 1) trimesh.boolean.union with manifold engine
        try:
            result = trimesh.boolean.union([mesh_a, mesh_b], engine="manifold")
            if result is not None and self._mesh_vertex_count(result) > 0:
                logger.info("boolean union via trimesh engine=manifold")
                return result
        except Exception as e:
            logger.debug("trimesh boolean engine=manifold failed: %s", e)

        # 2) blender engine if available
        try:
            result = trimesh.boolean.union([mesh_a, mesh_b], engine="blender")
            if result is not None and self._mesh_vertex_count(result) > 0:
                logger.info("boolean union via trimesh engine=blender")
                return result
        except Exception as e:
            logger.debug("trimesh boolean engine=blender failed: %s", e)

        # 3) manifold3d Manifold API (correct usage)
        try:
            import manifold3d

            def _to_manifold(mesh):
                verts = np.asarray(mesh.vertices, dtype=np.float64)
                faces = np.asarray(mesh.faces, dtype=np.int32)
                if hasattr(manifold3d, "Manifold") and hasattr(manifold3d.Manifold, "from_mesh"):
                    mmesh = manifold3d.Mesh(vert_properties=verts, tri_verts=faces)
                    return manifold3d.Manifold.from_mesh(mmesh)
                if hasattr(manifold3d, "Manifold"):
                    try:
                        mmesh = manifold3d.Mesh(vert_properties=verts, tri_verts=faces)
                        return manifold3d.Manifold(mesh=mmesh)
                    except TypeError:
                        pass
                raise RuntimeError("unsupported manifold3d API")

            ma = _to_manifold(mesh_a)
            mb = _to_manifold(mesh_b)
            merged = ma + mb  # union
            out_mesh = merged.to_mesh() if hasattr(merged, "to_mesh") else merged

            if hasattr(out_mesh, "vert_properties"):
                vertices = np.asarray(out_mesh.vert_properties)[:, :3]
                faces = np.asarray(out_mesh.tri_verts)
            elif hasattr(out_mesh, "vertices"):
                vertices = np.asarray(out_mesh.vertices)
                faces = np.asarray(getattr(out_mesh, "triangles", getattr(out_mesh, "faces")))
            else:
                raise RuntimeError("cannot read manifold3d result mesh")

            result = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
            if self._mesh_vertex_count(result) > 0:
                logger.info("boolean union via manifold3d Manifold API")
                return result
        except ImportError:
            logger.debug("manifold3d not installed")
        except Exception as e:
            logger.debug("manifold3d Manifold API failed: %s", e)

        return None

    def boolean_difference(
        self,
        mesh_a_path: str,
        mesh_b_path: str,
        output_path: str,
    ) -> str:
        """Boolean A − B (cut B volume out of A)."""
        if not self._trimesh_available:
            raise RuntimeError("Trimesh unavailable; cannot perform boolean difference")

        import trimesh

        mesh_a = self._load_trimesh_mesh(mesh_a_path)
        mesh_b = self._load_trimesh_mesh(mesh_b_path)
        self._log_mesh_extents("difference/A", mesh_a)
        self._log_mesh_extents("difference/B", mesh_b)

        result = None
        for engine in ("manifold", "blender"):
            try:
                result = trimesh.boolean.difference([mesh_a, mesh_b], engine=engine)
                if result is not None and self._mesh_vertex_count(result) > 0:
                    logger.info("boolean difference via engine=%s", engine)
                    break
            except Exception as e:
                logger.debug("boolean difference engine=%s failed: %s", engine, e)
                result = None

        if result is None or self._mesh_vertex_count(result) == 0:
            raise RuntimeError("boolean difference failed with all engines")

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        result.export(output_path)
        return output_path

    def crop_overlapping_ai_body(
        self,
        ai_mesh_path: str,
        inlay_mesh_path: str,
        output_path: str,
        proximity_frac: float = 0.045,
        min_keep_face_frac: float = 0.12,
        setting_median_hint: Optional[float] = None,
        inlay_diameter_hint: Optional[float] = None,
        overlap_only: bool = False,
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Option B replacement: remove AI faces that sit on/inside the inlay setting
        so dual-color preview is spatially coincident without double geometry.
        """
        import trimesh

        ai = self._load_trimesh_mesh(ai_mesh_path)
        inlay = self._load_trimesh_mesh(inlay_mesh_path)
        if self._mesh_vertex_count(ai) == 0 or self._mesh_vertex_count(inlay) == 0:
            raise ValueError("crop requires non-empty AI and inlay meshes")

        ext = float(np.max(inlay.bounds[1] - inlay.bounds[0]))
        # Setting/prongs: carve overlap. When alignment already leaves a gap (high
        # setting_median), crop LESS so the blue body keeps a contact shell for gap-close.
        setting_boost = 1.0
        contact_padding = 1.0
        if overlap_only:
            # After pre-gap close: peel only a thin double-skin, do not reopen the seat gap.
            thresh_setting = max(ext * 0.0055, 0.11e-3)
            thresh_shank = max(ext * proximity_frac * 0.30, 1e-3)
            thresh_setting_inner = thresh_setting * 0.72
            info_overlap_only = True
        else:
            info_overlap_only = False
            if setting_median_hint is not None and inlay_diameter_hint is not None:
                d_hint = max(float(inlay_diameter_hint), 1e-3)
                gap_ratio = float(setting_median_hint) / d_hint
                if gap_ratio > 0.07:
                    setting_boost = 0.78
                    contact_padding = 0.68
                elif gap_ratio > 0.05:
                    setting_boost = 0.88
                    contact_padding = 0.78
                elif gap_ratio > 0.035:
                    setting_boost = 0.96
                    contact_padding = 0.88
                elif gap_ratio < 0.025:
                    setting_boost = 1.12
                    contact_padding = 1.0
            thresh_setting = max(
                ext * proximity_frac * setting_boost * contact_padding, 1e-3
            )
            thresh_shank = max(ext * proximity_frac * 0.35, 1e-3)
            thresh_setting_inner = thresh_setting * 0.55

        try:
            from scipy.spatial import cKDTree

            comps = self._split_components(inlay)
            face_centroids = np.asarray(ai.vertices[ai.faces], dtype=np.float64).mean(axis=1)
            if len(comps) >= 2:
                shank = max(comps, key=lambda c: len(c.faces))
                setting_parts = [c for c in comps if c is not shank]
                import trimesh

                setting = (
                    trimesh.util.concatenate(setting_parts)
                    if len(setting_parts) > 1
                    else setting_parts[0]
                )
                d_set, _ = cKDTree(np.asarray(setting.vertices, dtype=np.float64)).query(
                    face_centroids, k=1
                )
                d_shank, _ = cKDTree(np.asarray(shank.vertices, dtype=np.float64)).query(
                    face_centroids, k=1
                )
                # Remove AI near prongs/seat; only remove near shank if almost coincident
                if info_overlap_only:
                    keep = d_set >= thresh_setting
                else:
                    keep = (d_set >= thresh_setting) & (d_shank >= thresh_shank)
                # Transition band: peel faces that sit inside setting shell
                if not info_overlap_only:
                    keep &= ~(
                        (d_set < thresh_setting_inner) & (d_shank >= thresh_shank * 1.5)
                    )
                else:
                    keep &= ~(d_set < thresh_setting_inner)
                info_thresh = {
                    "proximity_thresh_setting": float(thresh_setting),
                    "proximity_thresh_shank": float(thresh_shank),
                    "setting_carve_boost": float(setting_boost),
                    "contact_padding": float(contact_padding),
                    "overlap_only": info_overlap_only,
                    "crop_mode": "overlap_skin_only"
                    if info_overlap_only
                    else "setting_plus_shank_skin",
                }
                try:
                    fn = np.asarray(ai.face_normals, dtype=np.float64)
                    set_pts = np.asarray(setting.vertices, dtype=np.float64)
                    _, nn_idx = cKDTree(set_pts).query(face_centroids, k=1)
                    toward = set_pts[nn_idx] - face_centroids
                    tn = np.linalg.norm(toward, axis=1, keepdims=True)
                    toward = toward / np.maximum(tn, 1e-9)
                    facing = (fn * toward).sum(axis=1)
                    spill = (d_set < thresh_setting * 1.35) & (facing > 0.15)
                    if info_overlap_only:
                        spill = (d_set < thresh_setting * 1.05) & (facing > 0.22)
                    keep &= ~spill
                    info_thresh["faces_spill_removed"] = int(spill.sum())
                except Exception as e:
                    logger.debug("normal-aware crop skipped: %s", e)
                dists = np.minimum(d_set, d_shank)
            else:
                tree = cKDTree(np.asarray(inlay.vertices, dtype=np.float64))
                dists, _ = tree.query(face_centroids, k=1)
                keep = dists >= thresh_setting
                info_thresh = {
                    "proximity_thresh": float(thresh_setting),
                    "crop_mode": "full_inlay",
                }
        except Exception as e:
            logger.warning("KDTree proximity crop failed (%s); using AABB crop", e)
            expand = ext * 0.02
            bb = np.asarray(inlay.bounds, dtype=np.float64)
            face_centroids = np.asarray(ai.vertices[ai.faces], dtype=np.float64).mean(axis=1)
            inside = np.all(face_centroids >= (bb[0] - expand), axis=1) & np.all(
                face_centroids <= (bb[1] + expand), axis=1
            )
            keep = ~inside
            dists = None
            info_thresh = {"crop_mode": "aabb_fallback"}

        n_faces = len(ai.faces)
        n_keep = int(keep.sum())
        info = {
            "faces_in": n_faces,
            "faces_kept": n_keep,
            "faces_removed": n_faces - n_keep,
            **info_thresh,
        }

        if n_keep < max(4, int(n_faces * min_keep_face_frac)):
            logger.warning(
                "crop would remove too much AI body (keep=%s/%s); skipping crop",
                n_keep,
                n_faces,
            )
            info["skipped"] = True
            os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
            if os.path.abspath(ai_mesh_path) != os.path.abspath(output_path):
                import shutil
                shutil.copy2(ai_mesh_path, output_path)
            return output_path, info

        cropped = ai.copy()
        cropped.update_faces(keep)
        cropped.remove_unreferenced_vertices()
        if self._mesh_vertex_count(cropped) == 0:
            logger.warning("crop produced empty mesh; keeping original AI")
            info["skipped"] = True
            os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
            if os.path.abspath(ai_mesh_path) != os.path.abspath(output_path):
                import shutil
                shutil.copy2(ai_mesh_path, output_path)
            return output_path, info

        # Drop floaters left after proximity crop — keep dominant AI body only.
        # Misaligned crops often leave medium fragments near prongs; discard any
        # component smaller than 15% of the largest remaining piece.
        try:
            comps = self._split_components(cropped)
            info["post_crop_components_in"] = len(comps)
            if comps:
                comps_sorted = sorted(comps, key=lambda m: -len(m.faces))
                largest_faces = max(len(comps_sorted[0].faces), 1)
                min_faces = max(48, int(largest_faces * 0.15))
                inl_c = (inlay.bounds[0] + inlay.bounds[1]) * 0.5
                max_d = ext * 1.25
                kept = []
                for m in comps_sorted:
                    if len(m.faces) < min_faces:
                        continue
                    mc = (m.bounds[0] + m.bounds[1]) * 0.5
                    if float(np.linalg.norm(mc - inl_c)) > max_d:
                        continue
                    kept.append(m)
                if not kept:
                    kept = [comps_sorted[0]]
                # Prefer single dominant body; only merge extras that are >=40% of largest
                primary = kept[0]
                extras = [
                    m for m in kept[1:]
                    if len(m.faces) >= max(int(largest_faces * 0.40), min_faces)
                ]
                use = [primary] + extras
                cropped = (
                    trimesh.util.concatenate(use) if len(use) > 1 else use[0]
                )
                info["post_crop_components_kept"] = len(use)
                info["post_crop_faces"] = int(len(cropped.faces))
        except Exception as e:
            logger.debug("post-crop component cleanup skipped: %s", e)

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        ext_out = os.path.splitext(output_path)[1].lstrip(".").lower() or "glb"
        cropped.export(output_path, file_type=ext_out)
        self._log_mesh_extents("crop/ai_after", cropped)
        logger.info(
            "AI overlap crop: removed %s/%s faces (mode=%s) -> %s",
            info["faces_removed"],
            n_faces,
            info.get("crop_mode"),
            output_path,
        )
        return output_path, info

    def close_ai_inlay_interface_gap(
        self,
        ai_mesh_path: str,
        inlay_mesh_path: str,
        output_path: str,
        setting_median_hint: Optional[float] = None,
        inlay_diameter_hint: Optional[float] = None,
        target_clearance_mm: Optional[float] = None,
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Move AI vertices in the setting/shank contact band toward the inlay inner
        surface to close visible orange/blue gaps after proximity crop (local
        non-rigid expand along nearest-surface direction + slight radial push).
        """
        import trimesh
        from scipy.spatial import cKDTree

        stats: Dict[str, Any] = {"success": False}
        if not self._trimesh_available:
            stats["skipped"] = True
            return ai_mesh_path, stats

        ai = self._load_trimesh_mesh(ai_mesh_path)
        inlay = self._load_trimesh_mesh(inlay_mesh_path)
        if self._mesh_vertex_count(ai) == 0 or self._mesh_vertex_count(inlay) == 0:
            stats["error"] = "empty_mesh"
            return ai_mesh_path, stats

        shank, setting = self._split_shank_and_setting(inlay)
        fi0 = self._estimate_ring_frame(shank)
        up_q = self._geometric_setting_up(fi0, setting)
        if up_q is None:
            up_q = self._detect_setting_up(inlay, fi0)
        frame = self._frame_with_up(fi0, up_q)
        full_ring, fr_reason = self._detect_full_ring_inlay_mode(inlay, frame)
        stats["full_ring_inlay"] = full_ring
        stats["full_ring_reason"] = fr_reason

        ext = float(np.max(inlay.bounds[1] - inlay.bounds[0]))
        d_hint = max(float(inlay_diameter_hint or frame.get("diameter", ext)), 1e-3)
        if target_clearance_mm is not None:
            target_set = max(float(target_clearance_mm), 0.05e-3)
        else:
            target_set = max(d_hint * 0.016, ext * 0.014, 0.28e-3)
        target_shank = float(
            np.clip(
                max(d_hint * 0.006, ext * 0.005, 0.05e-3),
                0.05e-3,
                0.15e-3,
            )
        )

        before_set = self._setting_surface_distance(ai, setting, frame)
        before_shank = self._shank_surface_distance(ai, shank, frame)
        before_annular = self._shank_annular_gap_mm(ai, shank, frame)
        ang_before = self._angular_shank_gap_profile(ai, shank, frame)
        stats["angular_gap_before"] = {k: ang_before[k] for k in ang_before if k != "gaps"}
        stats["setting_median_before"] = before_set["median"]
        stats["shank_median_before"] = before_shank["median"]
        stats["shank_annular_gap_before"] = before_annular

        setting_pts = np.asarray(
            setting.vertices if setting is not None else inlay.vertices,
            dtype=np.float64,
        )
        shank_pts = np.asarray(shank.vertices, dtype=np.float64)
        tree_set = cKDTree(setting_pts)
        tree_shank = cKDTree(shank_pts)

        set_sample = setting_pts
        if len(set_sample) > 4000:
            set_sample = set_sample[
                np.random.default_rng(2).choice(len(set_sample), 4000, replace=False)
            ]
        try:
            d_proxy_in, _ = cKDTree(np.asarray(ai.vertices, dtype=np.float64)).query(
                set_sample, k=1
            )
            stats["gap_proxy_in"] = float(np.median(d_proxy_in))
        except Exception:
            d_proxy_in = None

        hint = float(setting_median_hint) if setting_median_hint is not None else before_set["median"]
        band_set = max(
            ext * 0.17,
            hint * 1.55,
            before_set["median"] * 1.4,
            target_set * 6.0,
            4.5e-3,
        )
        band_shank = max(
            ext * 0.14,
            before_shank["median"] * 2.2,
            target_shank * 8.0,
            3.5e-3,
        )
        max_step = max(ext * 0.006, hint * 0.22, 0.45e-3)

        center = np.asarray(frame["center"], dtype=np.float64)
        axis = np.asarray(frame["axis"], dtype=np.float64)
        up = np.asarray(frame["up"], dtype=np.float64)
        rm = float(frame.get("r_med", d_hint * 0.5))

        mesh = ai.copy()
        verts = np.asarray(mesh.vertices, dtype=np.float64)

        boundary_verts: set = set()
        try:
            from trimesh import grouping

            edge_groups = grouping.group_rows(mesh.edges_sorted, require_count=True)
            b_edges = mesh.edges_sorted[edge_groups == 1]
            if len(b_edges) > 0:
                boundary_verts = set(int(v) for v in b_edges.flatten())
        except Exception:
            pass

        # Pass 0a: radial expand in setting head (closes under-fill on smooth curves)
        expand_frac = float(np.clip(hint / max(d_hint, 1e-3) * 0.42, 0.015, 0.09))
        d_ax = (verts - center) @ axis
        radial = verts - center - np.outer(d_ax, axis)
        r = np.linalg.norm(radial, axis=1)
        ang_cos = (radial @ up) / np.maximum(r, 1e-9)
        in_head = (ang_cos > 0.12) & (r > rm * 0.32) & (r < rm * 1.22)
        in_head &= ang_cos > 0.28
        if int(in_head.sum()) >= 20 and expand_frac > 0.01:
            radial_h = radial[in_head] * (1.0 + expand_frac)
            verts[in_head] = center + np.outer(d_ax[in_head], axis) + radial_h
            stats["radial_expand_frac"] = expand_frac
            stats["radial_expand_verts"] = int(in_head.sum())

        # Pass 0b: whole-shank radial expand so AI outer meets inlay inner wall
        inlay_inner_r = self._inlay_inner_hole_radius(shank, frame, percentile=15.0)
        ai_outer_r = self._ai_shank_outer_radius(mesh, frame, percentile=85.0)
        target_outer_r = inlay_inner_r - target_shank
        shank_gap_r = float(target_outer_r - ai_outer_r)
        stats["inlay_inner_r"] = inlay_inner_r
        stats["ai_outer_r_before"] = ai_outer_r
        stats["shank_radial_gap_mm"] = shank_gap_r
        expand_from_annular = max(shank_gap_r, 0.0) / max(ai_outer_r, 1e-9)
        expand_from_dist = max(before_shank["median"] - target_shank, 0.0) / max(
            ai_outer_r, 1e-9
        )
        expand_shank = float(
            np.clip(max(expand_from_annular, expand_from_dist * 0.92), 0.0, 0.085)
        )
        ai_protruding = float(ang_before.get("pct_ai_outside", 0.0)) > 15.0
        if full_ring and ai_protruding:
            expand_shank = 0.0
            stats["shank_radial_expand_skipped"] = "full_ring_ai_protruding"
        if expand_shank > 0.012:
            in_shank = (
                (ang_cos < 0.55)
                & (r > rm * 0.30)
                & (r < rm * 1.22)
                & (np.abs(d_ax) < max(float(frame.get("thick", rm * 0.25)) * 1.6, rm * 0.42))
            )
            if int(in_shank.sum()) >= 40:
                radial_s = radial[in_shank] * (1.0 + expand_shank)
                verts[in_shank] = center + np.outer(d_ax[in_shank], axis) + radial_s
                stats["shank_radial_expand_frac"] = expand_shank
                stats["shank_radial_expand_verts"] = int(in_shank.sum())
                r_after = np.linalg.norm(
                    verts[in_shank] - center - np.outer(d_ax[in_shank], axis), axis=1
                )
                stats["ai_outer_r_after_pass0"] = float(np.percentile(r_after, 85))

        n_moved = 0
        iterations = 12
        if hint > d_hint * 0.04:
            iterations = 18
            max_step = max(ext * 0.0075, hint * 0.28, 0.55e-3)

        tree_ai = cKDTree(verts)

        for it in range(iterations):
            d_ax = (verts - center) @ axis
            radial = verts - center - np.outer(d_ax, axis)
            r = np.linalg.norm(radial, axis=1)
            ang_cos = (radial @ up) / np.maximum(r, 1e-9)
            d_set, idx_set = tree_set.query(verts, k=1)
            d_shank, idx_shank = tree_shank.query(verts, k=1)
            use_shank = (d_shank + 0.12e-3 < d_set) & (ang_cos < 0.35)
            target = np.where(use_shank, target_shank, target_set)
            band = np.where(use_shank, band_shank, band_set)
            d_nearest = np.where(use_shank, d_shank, d_set)
            nearest = (
                shank_pts[idx_shank] * use_shank[:, None]
                + setting_pts[idx_set] * (~use_shank)[:, None]
            )
            gap = d_nearest - target
            active = (gap > 0.02e-3) & (d_nearest < band)
            if not np.any(active):
                break
            is_bnd = np.array([i in boundary_verts for i in range(len(verts))], dtype=bool)
            step = np.where(is_bnd & active, gap, np.minimum(gap, max_step))
            direction = nearest - verts
            dn = np.linalg.norm(direction, axis=1, keepdims=True)
            direction = direction / np.maximum(dn, 1e-9)
            radial_n = radial / np.maximum(r.reshape(-1, 1), 1e-9)
            toward_up = radial_n * np.sign(radial_n @ up.reshape(3, 1))
            blend = np.where(use_shank, 0.42, 0.28)
            move = direction * step[:, None] + toward_up * (step * blend)[:, None]
            verts[active] = verts[active] + move[active]
            n_moved = int(active.sum())
            tree_ai = cKDTree(verts)

        mesh.vertices = verts
        mesh.remove_unreferenced_vertices()

        if full_ring:
            mesh, env_stats = self._radially_constrain_to_inlay_envelope(
                mesh,
                shank,
                frame,
                clearance_mm=target_shank,
                preview_shrink_mm=0.0,
                include_setting=True,
            )
            stats["envelope_constrain"] = env_stats

        try:
            mesh.fix_normals()
        except Exception:
            pass

        after_set = self._setting_surface_distance(mesh, setting, frame)
        after_shank = self._shank_surface_distance(mesh, shank, frame)
        after_annular = self._shank_annular_gap_mm(mesh, shank, frame)
        ang_after = self._angular_shank_gap_profile(mesh, shank, frame)
        stats["angular_gap_after"] = {k: ang_after[k] for k in ang_after if k != "gaps"}
        try:
            d_proxy_out, _ = cKDTree(np.asarray(mesh.vertices, dtype=np.float64)).query(
                set_sample, k=1
            )
            stats["gap_proxy_out"] = float(np.median(d_proxy_out))
            if d_proxy_in is not None:
                stats["gap_proxy_delta"] = float(np.median(d_proxy_in) - np.median(d_proxy_out))
        except Exception:
            pass
        stats.update(
            {
                "success": True,
                "vertices_nudged_last_iter": n_moved,
                "iterations": iterations,
                "target_setting_clearance": float(target_set),
                "target_shank_clearance": float(target_shank),
                "setting_median_after": after_set["median"],
                "shank_median_after": after_shank["median"],
                "shank_annular_gap_after": after_annular,
                "shank_annular_gap_delta": float(before_annular - after_annular),
                "ai_outer_r_after": self._ai_shank_outer_radius(mesh, frame, percentile=85.0),
                "setting_median_delta": float(before_set["median"] - after_set["median"]),
                "band_setting": float(band_set),
                "band_shank": float(band_shank),
            }
        )

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        ext_out = os.path.splitext(output_path)[1].lstrip(".").lower() or "glb"
        mesh.export(output_path, file_type=ext_out)
        self._log_mesh_extents("gap_close/ai_after", mesh)
        logger.info(
            "interface gap close: setting median %.4f -> %.4f (shank %.4f -> %.4f) -> %s",
            before_set["median"],
            after_set["median"],
            before_shank["median"],
            after_shank["median"],
            output_path,
        )
        return output_path, stats

    def repair_ai_after_crop(
        self,
        mesh_path: str,
        output_path: str,
        inlay_mesh_path: Optional[str] = None,
        interface_band_hint: Optional[float] = None,
        generation_config=None,
    ) -> Dict[str, Any]:
        """
        Light repair on AI mesh after proximity crop: degenerate/spike cleanup and
        localized smoothing on open crop boundaries (reduces jagged orange/blue interface).
        """
        import trimesh

        if not self._trimesh_available:
            return {"success": False, "skipped": True}

        mesh = self._load_trimesh_mesh(mesh_path)
        stats: Dict[str, Any] = {
            "success": True,
            "faces_in": int(len(mesh.faces)),
            "vertices_in": int(len(mesh.vertices)),
        }

        was_watertight = self._mesh_is_watertight(mesh)
        gen_cfg = self._get_generation_smooth_config(generation_config)
        min_area_ratio = gen_cfg.jewelry_min_face_area_ratio if gen_cfg else 0.0015
        max_aspect = gen_cfg.jewelry_spike_aspect_ratio if gen_cfg else 40.0
        self._cleanup_mesh_topology(mesh)
        # 裁剪后网格通常非水密；若仍水密则跳过尖刺剔除，避免打出网眼孔洞
        if not was_watertight:
            mesh = self._remove_spike_faces(mesh, min_area_ratio, max_aspect)

        interface_smoothed = False
        if inlay_mesh_path and os.path.isfile(inlay_mesh_path):
            try:
                from scipy.spatial import cKDTree

                inlay = self._load_trimesh_mesh(inlay_mesh_path)
                ext = float(np.max(inlay.bounds[1] - inlay.bounds[0]))
                comps = self._split_components(inlay)
                if len(comps) >= 2:
                    shank_c = max(comps, key=lambda c: len(c.faces))
                    setting_parts = [c for c in comps if c is not shank_c]
                    import trimesh

                    ref = (
                        trimesh.util.concatenate(setting_parts)
                        if len(setting_parts) > 1
                        else setting_parts[0]
                    )
                    ref_pts = np.asarray(ref.vertices, dtype=np.float64)
                else:
                    ref_pts = np.asarray(inlay.vertices, dtype=np.float64)
                band = max(ext * 0.044, 0.95e-3)
                if interface_band_hint is not None and float(interface_band_hint) > 0:
                    band = max(float(interface_band_hint) * 1.12, band)
                d_v, _ = cKDTree(ref_pts).query(
                    np.asarray(mesh.vertices, dtype=np.float64), k=1
                )
                mask_arr = d_v <= band
                if int(mask_arr.sum()) >= 12:
                    for _ in range(2):
                        expanded = mask_arr.copy()
                        for v in np.where(mask_arr)[0]:
                            for n in mesh.vertex_neighbors[v]:
                                expanded[int(n)] = True
                        mask_arr = expanded
                    verts = np.asarray(mesh.vertices, dtype=np.float64)
                    for _ in range(5):
                        new_v = verts.copy()
                        for v in np.where(mask_arr)[0]:
                            nbs = mesh.vertex_neighbors[v]
                            if not nbs:
                                continue
                            nb = verts[np.asarray(nbs, dtype=np.int64)]
                            new_v[v] = verts[v] * 0.62 + nb.mean(axis=0) * 0.38
                        verts = new_v
                    mesh.vertices = verts
                    interface_smoothed = True
                    stats["interface_band"] = float(band)
                    stats["interface_verts"] = int(mask_arr.sum())
            except Exception as e:
                logger.debug("interface band smooth skipped: %s", e)

        try:
            from trimesh import grouping

            edge_groups = grouping.group_rows(mesh.edges_sorted, require_count=True)
            boundary = np.asarray(mesh.edges_sorted[edge_groups == 1], dtype=np.int64).flatten()
            if len(boundary) == 0:
                boundary = np.asarray(getattr(mesh, "edges_boundary", []), dtype=np.int64).flatten()
            if len(boundary) > 0:
                mask = set(int(v) for v in boundary)
                for _ in range(2):
                    expanded = set(mask)
                    for v in mask:
                        expanded.update(int(n) for n in mesh.vertex_neighbors[v])
                    mask = expanded
                mask_arr = np.zeros(len(mesh.vertices), dtype=bool)
                mask_arr[list(mask)] = True
                verts = np.asarray(mesh.vertices, dtype=np.float64)
                for _ in range(6):
                    new_v = verts.copy()
                    idxs = np.where(mask_arr)[0]
                    for v in idxs:
                        nbs = mesh.vertex_neighbors[v]
                        if not nbs:
                            continue
                        nb = verts[np.asarray(nbs, dtype=np.int64)]
                        new_v[v] = verts[v] * 0.5 + nb.mean(axis=0) * 0.5
                    verts = new_v
                mesh.vertices = verts
                stats["boundary_smooth"] = True
                stats["boundary_verts"] = int(len(boundary))
        except Exception as e:
            logger.debug("boundary smooth skipped: %s", e)
            stats["boundary_smooth"] = False

        stats["interface_smooth"] = interface_smoothed
        taubin_iter = min(3, gen_cfg.jewelry_taubin_iterations if gen_cfg else 3)
        if taubin_iter > 0 and len(mesh.faces) < 120_000:
            try:
                import trimesh.smoothing as smoothing

                smoothed = smoothing.filter_taubin(
                    mesh,
                    lamb=0.42,
                    nu=-0.48,
                    iterations=taubin_iter,
                )
                if isinstance(smoothed, trimesh.Trimesh):
                    mesh = self._normalize_trimesh(smoothed)
                stats["taubin_iter"] = taubin_iter
            except Exception as e:
                logger.debug("post-crop taubin skipped: %s", e)

        if not was_watertight:
            mesh = self._remove_spike_faces(
                mesh, min_area_ratio * 0.5, max_aspect * 1.25
            )
        mesh = self._normalize_trimesh(mesh)
        self._cleanup_mesh_topology(mesh)
        try:
            mesh, wt_stats = self._enforce_watertight_mesh(mesh)
            stats["watertight_repair"] = wt_stats
        except Exception as e:
            logger.warning("post-crop watertight repair failed: %s", e)
        try:
            mesh.fix_normals()
        except Exception:
            pass

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        ext = os.path.splitext(output_path)[1].lstrip(".").lower() or "glb"
        mesh.export(output_path, file_type=ext)
        stats["faces_out"] = int(len(mesh.faces))
        stats["vertices_out"] = int(len(mesh.vertices))
        logger.info(
            "AI post-crop repair: %s verts %s->%s faces %s->%s -> %s",
            mesh_path,
            stats["vertices_in"],
            stats["vertices_out"],
            stats["faces_in"],
            stats["faces_out"],
            output_path,
        )
        return stats

    def _simple_merge(self, mesh_a, mesh_b):
        """
        简单网格合并（不做布尔运算）
        将两个网格的顶点和面合并为一个网格
        """
        import trimesh

        # 合并顶点和面
        vertices = np.vstack([mesh_a.vertices, mesh_b.vertices])
        faces = np.vstack([
            mesh_a.faces,
            mesh_b.faces + len(mesh_a.vertices),
        ])

        merged = trimesh.Trimesh(vertices=vertices, faces=faces)
        return merged

    def _load_trimesh_mesh(self, mesh_path: str):
        """加载单个 Trimesh 网格（Scene 时合并为单一 Trimesh）"""
        import trimesh

        from app.utils.file_utils import sniff_mesh_file_type

        load_kwargs = {"force": "mesh", "process": False}
        sniffed = sniff_mesh_file_type(mesh_path)
        if sniffed:
            load_kwargs["file_type"] = sniffed
        loaded = trimesh.load(mesh_path, **load_kwargs)
        if isinstance(loaded, trimesh.Scene):
            meshes = [
                g for g in loaded.geometry.values()
                if isinstance(g, trimesh.Trimesh)
            ]
            if not meshes:
                raise ValueError(f"文件不包含有效网格: {mesh_path}")
            mesh = trimesh.util.concatenate(meshes) if len(meshes) > 1 else meshes[0]
        else:
            mesh = loaded
        if self._mesh_vertex_count(mesh) == 0:
            raise ValueError(f"网格无顶点: {mesh_path}")
        return mesh

    def _prepare_mesh_for_region_paint(self, mesh):
        """复制几何并剥离旧 visual，避免 face/vertex colors 形状不一致。"""
        import trimesh

        if self._mesh_vertex_count(mesh) == 0:
            raise ValueError("网格无顶点，无法准备分色")
        return trimesh.Trimesh(
            vertices=np.asarray(mesh.vertices, dtype=np.float64),
            faces=np.asarray(mesh.faces, dtype=np.int64),
            process=False,
        )

    def _paint_region_visual(self, mesh, rgba: Tuple[int, int, int, int], material_name: str):
        """
        为网格设置分区外观：优先 ColorVisuals 顶点色（GLB COLOR_0），
        并尽量挂上命名 PBR 材质（baseColorFactor），二者择一即可被前端识别。
        """
        import trimesh

        if self._mesh_vertex_count(mesh) == 0:
            raise ValueError(f"无法为空网格上色: {material_name}")

        colors = np.tile(np.array(rgba, dtype=np.uint8), (len(mesh.vertices), 1))
        # 清除 face_colors，避免 GLB 导出时出现 face colors incorrect shape
        if hasattr(mesh, "visual") and mesh.visual is not None:
            if hasattr(mesh.visual, "face_colors"):
                mesh.visual.face_colors = None
        mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, vertex_colors=colors)
        try:
            from trimesh.visual.material import PBRMaterial

            mesh.visual.material = PBRMaterial(
                name=material_name,
                baseColorFactor=[
                    rgba[0] / 255.0,
                    rgba[1] / 255.0,
                    rgba[2] / 255.0,
                    rgba[3] / 255.0,
                ],
                metallicFactor=0.0,
                roughnessFactor=0.85,
            )
        except Exception as e:
            logger.debug("PBRMaterial for region paint skipped: %s", e)
        mesh.metadata = dict(getattr(mesh, "metadata", None) or {})
        mesh.metadata["name"] = material_name
        mesh.metadata["region"] = material_name
        return mesh

    def export_colored_dual_mesh(
        self,
        inlay_mesh_path: str,
        generated_mesh_path: str,
        output_path: str,
        output_format: str = "glb",
    ) -> str:
        """
        Export dual-mesh colored model (inlay + AI generated) with region vertex colors.
        Keeps COLOR_0 via ColorVisuals; metadata names set for frontend region fallback.
        """
        if not self._trimesh_available:
            raise RuntimeError("Trimesh unavailable; cannot export colored mesh")

        import trimesh

        inlay_mesh = self._prepare_mesh_for_region_paint(
            self._load_trimesh_mesh(inlay_mesh_path)
        )
        generated_mesh = self._prepare_mesh_for_region_paint(
            self._load_trimesh_mesh(generated_mesh_path)
        )

        self._log_mesh_extents("colored/inlay", inlay_mesh)
        self._log_mesh_extents("colored/generated", generated_mesh)
        try:
            inlay_ext = float(np.max(inlay_mesh.bounds[1] - inlay_mesh.bounds[0]))
            gen_ext = float(np.max(generated_mesh.bounds[1] - generated_mesh.bounds[0]))
            ratio = max(inlay_ext, gen_ext) / max(min(inlay_ext, gen_ext), 1e-9)
            logger.info(
                "colored dual mesh bbox max-extent: inlay=%.6g generated=%.6g ratio=%.3g",
                inlay_ext,
                gen_ext,
                ratio,
            )
            if gen_ext < inlay_ext * 0.015:
                raise ValueError(
                    f"generated mesh too small for colored preview "
                    f"(gen_ext={gen_ext:.6g} inlay_ext={inlay_ext:.6g}); "
                    "alignment or crop may have collapsed the AI body"
                )
            if ratio > 50:
                logger.warning(
                    "colored dual mesh scale mismatch is large (ratio=%.3g); preview may look wrong",
                    ratio,
                )
        except Exception as e:
            logger.warning("failed comparing colored mesh extents: %s", e)

        self._paint_region_visual(inlay_mesh, INLAY_REGION_COLOR, "inlay_structure")
        self._paint_region_visual(generated_mesh, GENERATED_REGION_COLOR, "ai_generated")

        # Keep vertex colors only (PBR baseColorFactor can strip COLOR_0 on some exporters).
        # Region names in metadata / node_name remain for frontend solid-color fallback.
        scene = trimesh.Scene()
        scene.add_geometry(inlay_mesh, node_name="inlay_structure", geom_name="inlay_structure")
        scene.add_geometry(generated_mesh, node_name="ai_generated", geom_name="ai_generated")

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        fmt = (output_format or os.path.splitext(output_path)[1].lstrip(".")).lower()
        scene.export(output_path, file_type=fmt)
        logger.info(
            "colored dual mesh exported: inlay=%s generated=%s -> %s",
            inlay_mesh_path,
            generated_mesh_path,
            output_path,
        )
        return output_path

    def _export_preserving_scene(
        self,
        input_path: str,
        output_path: str,
        output_format: Optional[str] = None,
    ) -> str:
        """复制/导出时保留 Scene 多子网格与顶点色/材质（不 force 合并为单 mesh）。"""
        import shutil
        import trimesh

        if not os.path.isfile(input_path):
            raise FileNotFoundError(f"输入文件不存在: {input_path}")

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        fmt = (output_format or os.path.splitext(output_path)[1].lstrip(".")).lower()
        src_ext = os.path.splitext(input_path)[1].lstrip(".").lower()

        if src_ext == fmt:
            if os.path.abspath(input_path) != os.path.abspath(output_path):
                shutil.copy2(input_path, output_path)
            return output_path

        loaded = trimesh.load(input_path, process=False)
        loaded.export(output_path, file_type=fmt)
        logger.info("保留 Scene 结构的格式导出: %s -> %s (%s)", input_path, output_path, fmt)
        return output_path

    # ============================================================
    # 拓扑修复
    # ============================================================

    def repair_mesh(
        self,
        mesh_path: str,
        output_path: str,
        remove_duplicate_faces: bool = True,
        remove_degenerate_faces: bool = True,
        fill_holes: bool = True,
        fix_normals: bool = True,
        merge_close_vertices: bool = True,
        apply_jewelry_smooth: bool = True,
        generation_config=None,
    ) -> Dict[str, Any]:
        """
        网格拓扑修复

        Args:
            mesh_path: 输入网格路径
            output_path: 输出路径
            remove_duplicate_faces: 是否移除重复面
            remove_degenerate_faces: 是否移除退化面
            fill_holes: 是否填充孔洞
            fix_normals: 是否修复法线方向
            merge_close_vertices: 是否合并距离过近的顶点

        Returns:
            修复统计信息
        """
        if not self._trimesh_available:
            logger.error("Trimesh 不可用，无法执行拓扑修复")
            return {"success": False, "message": "Trimesh不可用"}

        import trimesh

        mesh = trimesh.load(mesh_path)
        if isinstance(mesh, trimesh.Scene):
            mesh = mesh.dump(concatenate=True)

        if self._mesh_vertex_count(mesh) == 0:
            logger.warning("跳过空网格修复: %s", mesh_path)
            return {"success": False, "message": "网格为空，跳过修复"}

        stats = {
            "success": True,
            "original_vertices": len(mesh.vertices),
            "original_faces": len(mesh.faces),
            "repairs": [],
        }

        logger.info(f"开始网格修复: {len(mesh.vertices)}顶点, {len(mesh.faces)}面")

        # 1. 移除重复面（兼容新旧 trimesh API）
        if remove_duplicate_faces:
            before = len(mesh.faces)
            if hasattr(mesh, "remove_duplicate_faces"):
                mesh.remove_duplicate_faces()
            elif hasattr(mesh, "unique_faces"):
                mesh.update_faces(mesh.unique_faces())
            removed = before - len(mesh.faces)
            if removed > 0:
                stats["repairs"].append(f"移除了 {removed} 个重复面")
                logger.info(f"移除重复面: {removed}个")

        # 2. 移除退化面（面积为0的面）
        if remove_degenerate_faces:
            before = len(mesh.faces)
            if hasattr(mesh, "remove_degenerate_faces"):
                mesh.remove_degenerate_faces()
            elif hasattr(mesh, "nondegenerate_faces"):
                mesh.update_faces(mesh.nondegenerate_faces())
            removed = before - len(mesh.faces)
            if removed > 0:
                stats["repairs"].append(f"移除了 {removed} 个退化面")
                logger.info(f"移除退化面: {removed}个")

        # 3. 合并距离过近的顶点
        if merge_close_vertices:
            before = len(mesh.vertices)
            mesh.merge_vertices()
            merged = before - len(mesh.vertices)
            if merged > 0:
                stats["repairs"].append(f"合并了 {merged} 个重复顶点")
                logger.info(f"合并重复顶点: {merged}个")

        # 4. 修复法线方向
        if fix_normals:
            try:
                # 确保面法线一致朝外
                mesh.fix_normals()
                stats["repairs"].append("法线方向已修复")
                logger.info("法线方向已修复")
            except Exception as e:
                logger.warning(f"修复法线失败: {e}")

        # 5. 珠宝曲面轻度平滑（须在孔洞填充之前；平滑会破坏水密性）
        if apply_jewelry_smooth:
            try:
                mesh = self._apply_jewelry_surface_smooth(mesh, generation_config)
                stats["repairs"].append("珠宝曲面平滑")
            except Exception as e:
                logger.warning(f"珠宝曲面平滑失败: {e}")

        # 6. 孔洞填充 + 水密修复（必须在平滑 / spike 剔除之后）
        if fill_holes:
            try:
                mesh, wt_stats = self._enforce_watertight_mesh(mesh)
                stats["watertight_repair"] = wt_stats
                if wt_stats.get("fill_passes") or wt_stats.get("pymeshfix"):
                    stats["repairs"].append("孔洞已填充/水密修复")
                    logger.info(
                        "水密修复: was=%s now=%s passes=%d pymeshfix=%s open3d=%s",
                        wt_stats.get("was_watertight"),
                        wt_stats.get("is_watertight"),
                        wt_stats.get("fill_passes", 0),
                        wt_stats.get("pymeshfix"),
                        wt_stats.get("open3d_cleanup"),
                    )
            except Exception as e:
                logger.warning(f"水密修复失败: {e}")

        try:
            stats["is_watertight"] = bool(mesh.is_watertight)
            if not stats["is_watertight"]:
                logger.warning("网格修复后仍非水密，可能影响 CAD 导出质量")
        except Exception:
            stats["is_watertight"] = False

        # 保存修复后的网格
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        mesh.export(output_path)

        stats["final_vertices"] = len(mesh.vertices)
        stats["final_faces"] = len(mesh.faces)

        logger.info(
            f"网格修复完成: {stats['original_vertices']}->{stats['final_vertices']}顶点, "
            f"{stats['original_faces']}->{stats['final_faces']}面"
        )

        return stats

    def _get_generation_smooth_config(self, generation_config=None):
        if generation_config is not None:
            return generation_config
        try:
            from app.config import get_config
            return get_config().generation
        except Exception:
            return None

    def _normalize_trimesh(self, mesh):
        """将 filter_taubin 等返回的轻量 Trimesh 规范化为带完整 API 的网格。"""
        import trimesh

        if not isinstance(mesh, trimesh.Trimesh) or len(mesh.faces) < 4:
            return mesh
        try:
            return trimesh.Trimesh(
                vertices=np.asarray(mesh.vertices, dtype=np.float64),
                faces=np.asarray(mesh.faces, dtype=np.int64),
                process=False,
            )
        except Exception:
            return mesh

    def _remove_degenerate_faces_compat(self, mesh):
        if hasattr(mesh, "remove_degenerate_faces"):
            mesh.remove_degenerate_faces()
        elif hasattr(mesh, "nondegenerate_faces"):
            mesh.update_faces(mesh.nondegenerate_faces())
        return mesh

    def _remove_duplicate_faces_compat(self, mesh):
        if hasattr(mesh, "remove_duplicate_faces"):
            mesh.remove_duplicate_faces()
        elif hasattr(mesh, "unique_faces"):
            mesh.update_faces(mesh.unique_faces())
        return mesh

    def _cleanup_mesh_topology(self, mesh):
        """兼容不同 trimesh 版本的拓扑清理（退化面/重复面/合并顶点）。"""
        self._remove_degenerate_faces_compat(mesh)
        self._remove_duplicate_faces_compat(mesh)
        mesh.merge_vertices()
        if hasattr(mesh, "remove_unreferenced_vertices"):
            mesh.remove_unreferenced_vertices()
        return mesh

    def _mesh_is_watertight(self, mesh) -> bool:
        try:
            return bool(mesh.is_watertight)
        except Exception:
            return False

    def _remove_spike_faces(self, mesh, min_area_ratio: float, max_aspect_ratio: float):
        """剔除面积过小或细长三角面（AI 网格常见尖刺/噪点）"""
        import trimesh

        if not isinstance(mesh, trimesh.Trimesh) or len(mesh.faces) < 8:
            return mesh

        keep = np.ones(len(mesh.faces), dtype=bool)

        try:
            areas = mesh.area_faces
            if len(areas) > 0:
                median = float(np.median(areas))
                min_area = max(median * min_area_ratio, 1e-12)
                keep &= areas >= min_area
        except Exception:
            pass

        try:
            tris = mesh.vertices[mesh.faces]
            e0 = np.linalg.norm(tris[:, 1] - tris[:, 0], axis=1)
            e1 = np.linalg.norm(tris[:, 2] - tris[:, 1], axis=1)
            e2 = np.linalg.norm(tris[:, 0] - tris[:, 2], axis=1)
            max_e = np.maximum(np.maximum(e0, e1), e2)
            min_e = np.minimum(np.minimum(e0, e1), e2)
            aspect = max_e / np.maximum(min_e, 1e-12)
            keep &= aspect <= max_aspect_ratio
        except Exception:
            pass

        if keep.sum() >= 4 and keep.sum() < len(keep):
            mesh.update_faces(keep)
        return mesh

    def _enforce_watertight_mesh(
        self,
        mesh,
        *,
        max_fill_passes: int = 6,
        drop_tiny_components: bool = True,
        min_component_faces: int = 20,
    ) -> Tuple[Any, Dict[str, Any]]:
        """
        填充孔洞并修复非流形边，使网格适合珠宝 CAD 导出。
        应在 Taubin 平滑或 spike 剔除之后调用（这些步骤会破坏水密性）。
        """
        import trimesh

        stats: Dict[str, Any] = {
            "was_watertight": False,
            "is_watertight": False,
            "fill_passes": 0,
            "pymeshfix": False,
            "open3d_cleanup": False,
            "tiny_components_dropped": 0,
        }

        if not isinstance(mesh, trimesh.Trimesh) or len(mesh.faces) < 4:
            return mesh, stats

        try:
            stats["was_watertight"] = bool(mesh.is_watertight)
        except Exception:
            pass

        if drop_tiny_components:
            comps = self._split_components(mesh)
            if len(comps) > 1:
                comps.sort(key=lambda c: len(c.faces), reverse=True)
                kept = [comps[0]]
                for comp in comps[1:]:
                    if len(comp.faces) >= min_component_faces:
                        kept.append(comp)
                    else:
                        stats["tiny_components_dropped"] += 1
                mesh = (
                    kept[0]
                    if len(kept) == 1
                    else trimesh.util.concatenate(kept)
                )

        for _ in range(max_fill_passes):
            try:
                if hasattr(mesh, "remove_degenerate_faces"):
                    mesh.remove_degenerate_faces()
                elif hasattr(mesh, "nondegenerate_faces"):
                    mesh.update_faces(mesh.nondegenerate_faces())
                if hasattr(mesh, "remove_duplicate_faces"):
                    mesh.remove_duplicate_faces()
                elif hasattr(mesh, "unique_faces"):
                    mesh.update_faces(mesh.unique_faces())
                mesh.merge_vertices()
            except Exception:
                pass

            try:
                if mesh.is_watertight:
                    break
            except Exception:
                pass

            filled_any = False
            try:
                filled = trimesh.repair.fill_holes(mesh)
                if isinstance(filled, trimesh.Trimesh):
                    mesh = filled
                    filled_any = True
                elif filled:
                    filled_any = True
            except Exception as e:
                logger.debug("fill_holes pass failed: %s", e)
                break

            stats["fill_passes"] += 1
            if not filled_any:
                break

        try:
            if not mesh.is_watertight:
                import pymeshfix

                v = np.asarray(mesh.vertices, dtype=np.float64)
                f = np.asarray(mesh.faces, dtype=np.int32)
                meshfix = pymeshfix.MeshFix(v, f)
                try:
                    meshfix.repair(joincomp=True, remove_smallest_components=False)
                except TypeError:
                    meshfix.repair()
                v_out = np.asarray(meshfix.points)
                f_out = np.asarray(meshfix.faces)
                if len(f_out) >= 4:
                    mesh = trimesh.Trimesh(vertices=v_out, faces=f_out, process=False)
                    stats["pymeshfix"] = True
        except ImportError:
            logger.debug("pymeshfix 未安装，跳过 MeshFix 修复")
        except Exception as e:
            logger.warning("pymeshfix 修复失败: %s", e)

        if self._open3d_available:
            try:
                if not mesh.is_watertight:
                    import open3d as o3d

                    o3d_mesh = o3d.geometry.TriangleMesh(
                        o3d.utility.Vector3dVector(np.asarray(mesh.vertices)),
                        o3d.utility.Vector3iVector(np.asarray(mesh.faces)),
                    )
                    o3d_mesh.remove_degenerate_triangles()
                    o3d_mesh.remove_duplicated_triangles()
                    o3d_mesh.remove_duplicated_vertices()
                    o3d_mesh.remove_non_manifold_edges()
                    o3d_mesh.remove_unreferenced_vertices()
                    v = np.asarray(o3d_mesh.vertices)
                    f = np.asarray(o3d_mesh.triangles)
                    if len(f) >= 4:
                        mesh = trimesh.Trimesh(vertices=v, faces=f, process=False)
                        stats["open3d_cleanup"] = True
                        try:
                            trimesh.repair.fill_holes(mesh)
                        except Exception:
                            pass
            except Exception as e:
                logger.debug("open3d mesh cleanup skipped: %s", e)

        try:
            mesh.fix_normals()
        except Exception:
            pass

        try:
            stats["is_watertight"] = bool(mesh.is_watertight)
        except Exception:
            stats["is_watertight"] = False

        return mesh, stats

    def _apply_jewelry_surface_smooth(self, mesh, generation_config=None):
        """
        珠宝建模后处理：Taubin 保体积平滑 + 去除尖刺三角面，获得平整顺滑曲面。
        """
        import trimesh

        if not isinstance(mesh, trimesh.Trimesh):
            return mesh

        gen_cfg = self._get_generation_smooth_config(generation_config)
        taubin_iter = gen_cfg.jewelry_taubin_iterations if gen_cfg else 10
        taubin_lambda = gen_cfg.jewelry_taubin_lambda if gen_cfg else 0.5
        taubin_nu = gen_cfg.jewelry_taubin_nu if gen_cfg else -0.53
        min_area_ratio = gen_cfg.jewelry_min_face_area_ratio if gen_cfg else 0.0015
        max_aspect = gen_cfg.jewelry_spike_aspect_ratio if gen_cfg else 40.0

        if taubin_iter <= 0:
            return mesh

        was_watertight = False
        try:
            was_watertight = self._mesh_is_watertight(mesh)
        except Exception:
            pass

        before_faces = len(mesh.faces)
        self._cleanup_mesh_topology(mesh)

        # 删除尖刺三角面会在水密 AI 网格上打出大量非流形孔洞；水密时仅 Taubin 平滑
        if not was_watertight:
            mesh = self._remove_spike_faces(mesh, min_area_ratio, max_aspect)

        if taubin_iter > 0:
            try:
                import trimesh.smoothing as smoothing

                self._cleanup_mesh_topology(mesh)
                smoothed = smoothing.filter_taubin(
                    mesh,
                    lamb=taubin_lambda,
                    nu=taubin_nu,
                    iterations=taubin_iter,
                )
                if isinstance(smoothed, trimesh.Trimesh):
                    mesh = self._normalize_trimesh(smoothed)
            except Exception:
                try:
                    import trimesh.smoothing as smoothing

                    iterations = 2 if len(mesh.faces) < 120_000 else 1
                    smoothed = smoothing.filter_laplacian(
                        mesh, lamb=0.35, iterations=iterations
                    )
                    if isinstance(smoothed, trimesh.Trimesh):
                        mesh = self._normalize_trimesh(smoothed)
                except Exception:
                    pass

        if not was_watertight:
            mesh = self._remove_spike_faces(
                mesh, min_area_ratio * 0.5, max_aspect * 1.25
            )
        mesh = self._normalize_trimesh(mesh)
        self._cleanup_mesh_topology(mesh)
        try:
            mesh.fix_normals()
        except Exception:
            pass

        logger.info(
            "珠宝曲面平滑: %d -> %d 面 (taubin_iter=%d)",
            before_faces,
            len(mesh.faces),
            taubin_iter,
        )
        return mesh

    def jewelry_finish_mesh(
        self,
        mesh_path: str,
        output_path: str,
        generation_config=None,
    ) -> str:
        """对生成网格做珠宝级曲面整理（修复 + 平滑）。"""
        self.repair_mesh(
            mesh_path,
            output_path,
            remove_duplicate_faces=True,
            remove_degenerate_faces=True,
            fill_holes=True,
            fix_normals=True,
            merge_close_vertices=True,
            apply_jewelry_smooth=True,
            generation_config=generation_config,
        )
        return output_path

    # ============================================================
    # 网格分析
    # ============================================================

    def analyze_mesh(self, mesh_path: str) -> Dict[str, Any]:
        """
        分析网格属性

        Args:
            mesh_path: 网格文件路径

        Returns:
            网格属性字典
        """
        if not self._trimesh_available:
            return {"error": "Trimesh不可用"}

        import trimesh

        mesh = trimesh.load(mesh_path)
        if isinstance(mesh, trimesh.Scene):
            mesh = mesh.dump(concatenate=True)

        info = {
            "vertices": len(mesh.vertices),
            "faces": len(mesh.faces),
            "edges": len(mesh.edges_unique),
            "is_watertight": mesh.is_watertight if hasattr(mesh, 'is_watertight') else False,
            "bounds": mesh.bounds.tolist() if hasattr(mesh, 'bounds') else None,
            "volume": float(mesh.volume) if hasattr(mesh, 'volume') else 0,
            "surface_area": float(mesh.area) if hasattr(mesh, 'area') else 0,
            "center_mass": mesh.center_mass.tolist() if hasattr(mesh, 'center_mass') else None,
            "euler_number": mesh.euler_number if hasattr(mesh, 'euler_number') else 0,
        }

        return info

    # ============================================================
    # 格式转换
    # ============================================================

    def convert_format(
        self,
        input_path: str,
        output_path: str,
        output_format: Optional[str] = None,
    ) -> str:
        """
        网格格式转换

        Args:
            input_path: 输入文件路径
            output_path: 输出文件路径
            output_format: 目标格式（obj/glb/stl），默认从 output_path 扩展名推断

        Returns:
            输出文件路径
        """
        if not self._trimesh_available:
            logger.error("Trimesh 不可用，无法转换格式")
            raise RuntimeError("Trimesh 不可用，无法转换格式")

        import trimesh

        if not os.path.isfile(input_path):
            raise FileNotFoundError(f"输入文件不存在: {input_path}")

        loaded = trimesh.load(input_path, force="mesh")
        if isinstance(loaded, trimesh.Scene):
            meshes = [
                g for g in loaded.geometry.values()
                if isinstance(g, trimesh.Trimesh)
            ]
            if not meshes:
                raise ValueError("输入文件不包含有效网格")
            mesh = trimesh.util.concatenate(meshes) if len(meshes) > 1 else meshes[0]
        else:
            mesh = loaded

        fmt = (output_format or os.path.splitext(output_path)[1].lstrip(".")).lower()
        supported = {"obj", "glb", "stl"}
        if fmt not in supported:
            raise ValueError(f"不支持的目标格式: {fmt}，支持: {', '.join(sorted(supported))}")

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        mesh.export(output_path, file_type=fmt)

        logger.info(f"格式转换完成: {input_path} -> {output_path} ({fmt})")
        return output_path

    def _export_aligned_download_mesh(
        self,
        inlay_mesh_path: str,
        generated_mesh_path: str,
        output_path: str,
        output_format: str,
    ) -> str:
        """
        Export aligned dual meshes as a single download body.
        Prefer boolean_union; only fall back to simple_merge with WARNING.
        """
        fmt = (output_format or os.path.splitext(output_path)[1].lstrip(".")).lower()
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        try:
            self.boolean_union(inlay_mesh_path, generated_mesh_path, output_path)
            if self._is_valid_output_file(output_path, min_bytes=128):
                # Ensure requested format
                cur_ext = os.path.splitext(output_path)[1].lstrip(".").lower()
                if cur_ext != fmt:
                    self.convert_format(output_path, output_path)
                logger.info("aligned download mesh via boolean_union: %s", output_path)
                return output_path
        except Exception as e:
            logger.warning(
                "boolean_union for download failed (%s); falling back to simple_merge",
                e,
            )

        mesh_a = self._load_trimesh_mesh(inlay_mesh_path)
        mesh_b = self._load_trimesh_mesh(generated_mesh_path)
        self._log_mesh_extents("download/inlay", mesh_a)
        self._log_mesh_extents("download/generated", mesh_b)
        merged = self._simple_merge(mesh_a, mesh_b)
        merged.export(output_path, file_type=fmt)
        logger.warning(
            "aligned download mesh fell back to simple_merge (may be dual scattered bodies): %s",
            output_path,
        )
        return output_path

    # ============================================================
    # 综合处理流程
    # ============================================================

    def process_generated_mesh(
        self,
        generated_mesh_path: str,
        base_mesh_path: Optional[str] = None,
        output_dir: str = "./outputs/",
        task_id: str = "",
        fusion_method: str = "colored_merge",
        enable_icp: bool = True,
        enable_repair: bool = True,
        output_format: str = "glb",
        apply_jewelry_repair_smooth: bool = True,
        generation_config=None,
    ) -> Dict[str, Any]:
        """
        完整的网格后处理流程

        步骤:
        1. 加载生成的网格
        2. （可选）ICP对齐到底座
        3. （可选）拓扑修复 AI 主体（分色合并前）
        4. （可选）分色合并 / 布尔融合
        5. （非分色）拓扑修复整模
        6. 写出 final（分色路径保留双网格 Scene）

        Args:
            generated_mesh_path: 生成的网格路径
            base_mesh_path: 底座网格路径（可选）
            output_dir: 输出目录
            task_id: 任务ID
            fusion_method: 融合方法
            enable_icp: 是否启用ICP对齐
            enable_repair: 是否启用拓扑修复
            output_format: 输出格式

        Returns:
            处理结果字典
        """
        from app.utils.file_utils import generate_output_path

        result = {
            "success": False,
            "steps_completed": [],
            "output_path": None,
            "error": None,
        }

        try:
            # 步骤1: 加载并验证生成的网格
            if not os.path.exists(generated_mesh_path):
                raise FileNotFoundError(f"生成的网格文件不存在: {generated_mesh_path}")

            result["steps_completed"].append("网格加载验证")

            current_mesh_path = generated_mesh_path
            aligned_mesh_path = generated_mesh_path
            cleaned_inlay_path: Optional[str] = None
            cropped_ai_path: Optional[str] = None
            colored_merge_ok = False
            preview_glb_path: Optional[str] = None
            user_fmt = (output_format or "glb").lower()
            # 分色预览固定 GLB（STL/OBJ 无法可靠保留 COLOR_0 与双节点）
            preview_fmt = "glb" if fusion_method == "colored_merge" else user_fmt

            # Step 1b: sanitize inlay (drop junk + pick primary CAD assembly)
            if base_mesh_path:
                try:
                    cleaned_inlay_path = generate_output_path(
                        output_dir, task_id, "inlay_clean.glb"
                    )
                    cleaned_inlay_path, sanitize_info = self.sanitize_mesh(
                        base_mesh_path,
                        cleaned_inlay_path,
                        select_primary=True,
                    )
                    result["inlay_sanitize"] = sanitize_info
                    result["steps_completed"].append("inlay_sanitize")
                    logger.info(
                        "inlay sanitized for replacement fusion: %s",
                        cleaned_inlay_path,
                    )
                except Exception as e:
                    logger.warning(
                        "inlay sanitize failed (%s); using raw inlay mesh",
                        e,
                    )
                    cleaned_inlay_path = base_mesh_path

            # Step 2: align AI → cleaned inlay (PCA + ICP / setting-region). Abort if fails.
            if base_mesh_path:
                logger.info("Executing mesh alignment (PCA/ICP/setting-region)...")
                try:
                    aligned_path = generate_output_path(
                        output_dir, task_id, f"aligned.{user_fmt}"
                    )
                    aligned_mesh_path, _, align_info = self.align_generated_to_base(
                        generated_mesh_path,
                        base_mesh_path,
                        aligned_path,
                        enable_icp=enable_icp and self._open3d_available,
                        cleaned_base_path=cleaned_inlay_path,
                    )
                    current_mesh_path = aligned_mesh_path
                    result["alignment"] = align_info
                    if align_info.get("icp_rmse") is not None:
                        result["icp_rmse"] = align_info["icp_rmse"]
                    result["steps_completed"].append("mesh_alignment")
                except Exception as e:
                    logger.error(
                        "ALIGNMENT FAILED — aborting fusion: %s",
                        e,
                        exc_info=True,
                    )
                    result["error"] = f"alignment_failed: {e}"
                    result["success"] = False
                    return result

            # Step 2a: pre-crop gap close when alignment leaves visible seat gap
            inlay_for_merge = cleaned_inlay_path or base_mesh_path
            full_ring_inlay = False
            if inlay_for_merge and os.path.isfile(inlay_for_merge):
                try:
                    inlay_probe = self._load_trimesh_mesh(inlay_for_merge)
                    full_ring_inlay, fr_reason = self._detect_full_ring_inlay_mode(inlay_probe)
                    result["full_ring_inlay"] = full_ring_inlay
                    result["full_ring_reason"] = fr_reason
                except Exception as e:
                    logger.debug("full ring detect skipped: %s", e)

            if base_mesh_path and inlay_for_merge and current_mesh_path:
                align_info_pre = result.get("alignment") or {}
                ring_info_pre = align_info_pre.get("ring") or {}
                fq_pre = align_info_pre.get("final_quality") or {}
                set_pre = fq_pre.get("setting_median") or ring_info_pre.get("setting_median")
                diam_pre = ring_info_pre.get("tgt_diameter") or ring_info_pre.get("src_diameter")
                try:
                    skip_pre_gap = full_ring_inlay
                    if (
                        not skip_pre_gap
                        and set_pre is not None
                        and diam_pre is not None
                        and float(set_pre) > float(diam_pre) * 0.028
                    ):
                        pre_gap_path = generate_output_path(
                            output_dir, task_id, f"ai_pre_gap.{user_fmt}"
                        )
                        pre_gap_path, pre_gap_stats = self.close_ai_inlay_interface_gap(
                            current_mesh_path,
                            inlay_for_merge,
                            pre_gap_path,
                            setting_median_hint=set_pre,
                            inlay_diameter_hint=diam_pre,
                        )
                        result["interface_gap_close_pre"] = pre_gap_stats
                        if pre_gap_stats.get("success"):
                            current_mesh_path = pre_gap_path
                            aligned_mesh_path = pre_gap_path
                            result["steps_completed"].append("interface_gap_close_pre")
                except Exception as e:
                    logger.warning("pre-crop interface gap close failed (%s)", e)

            # Step 2b: replacement crop — remove AI faces overlapping inlay setting
            if base_mesh_path and inlay_for_merge:
                if full_ring_inlay:
                    # Full-ring: envelope alignment already seats AI in the bore.
                    # overlap_only crop peels the contact shell and leaves the body
                    # inside solid inlay — invisible in colored preview.
                    cropped_ai_path = current_mesh_path
                    result["replacement_crop"] = {
                        "skipped": True,
                        "reason": "full_ring_envelope_pipeline",
                    }
                    result["interface_gap_close"] = {
                        "skipped": True,
                        "reason": "full_ring_envelope_pipeline",
                    }
                else:
                    try:
                        cropped_ai_path = generate_output_path(
                            output_dir, task_id, f"ai_replaced.{user_fmt}"
                        )
                        align_info = result.get("alignment") or {}
                        ring_info = align_info.get("ring") or {}
                        fq = align_info.get("final_quality") or {}
                        set_hint = fq.get("setting_median") or ring_info.get("setting_median")
                        diam_hint = ring_info.get("tgt_diameter") or ring_info.get("src_diameter")
                        pre_gap = result.get("interface_gap_close_pre") or {}
                        overlap_only = bool(pre_gap.get("success"))
                        if overlap_only and pre_gap.get("setting_median_after") is not None:
                            set_hint = pre_gap.get("setting_median_after")
                        cropped_ai_path, crop_info = self.crop_overlapping_ai_body(
                            current_mesh_path,
                            inlay_for_merge,
                            cropped_ai_path,
                            setting_median_hint=set_hint,
                            inlay_diameter_hint=diam_hint,
                            overlap_only=overlap_only,
                        )
                        result["replacement_crop"] = crop_info
                        if not crop_info.get("skipped"):
                            current_mesh_path = cropped_ai_path
                            aligned_mesh_path = cropped_ai_path
                            result["steps_completed"].append("inlay_replacement_crop")
                            try:
                                skip_post_gap = overlap_only and float(
                                    pre_gap.get("setting_median_after", 1e9)
                                ) < max(float(diam_hint or 0) * 0.022, 0.45)
                                if not skip_post_gap:
                                    gap_closed_path = generate_output_path(
                                        output_dir, task_id, f"ai_gap_closed.{user_fmt}"
                                    )
                                    gap_closed_path, gap_stats = self.close_ai_inlay_interface_gap(
                                        current_mesh_path,
                                        inlay_for_merge,
                                        gap_closed_path,
                                        setting_median_hint=set_hint,
                                        inlay_diameter_hint=diam_hint,
                                    )
                                    result["interface_gap_close"] = gap_stats
                                    if gap_stats.get("success"):
                                        current_mesh_path = gap_closed_path
                                        aligned_mesh_path = gap_closed_path
                                        cropped_ai_path = gap_closed_path
                                        result["steps_completed"].append("interface_gap_close")
                                else:
                                    result["interface_gap_close"] = {
                                        "skipped": True,
                                        "reason": "post_pre_gap_overlap_crop",
                                    }
                            except Exception as e:
                                logger.warning(
                                    "interface gap close failed (%s); continuing with cropped AI",
                                    e,
                                )
                            if apply_jewelry_repair_smooth or enable_repair:
                                repaired_path = generate_output_path(
                                    output_dir, task_id, f"ai_repaired.{user_fmt}"
                                )
                                repair_stats = self.repair_ai_after_crop(
                                    current_mesh_path,
                                    repaired_path,
                                    inlay_mesh_path=inlay_for_merge,
                                    interface_band_hint=crop_info.get("proximity_thresh_setting"),
                                    generation_config=generation_config,
                                )
                                result["ai_post_crop_repair"] = repair_stats
                                if repair_stats.get("success"):
                                    faces_in = int(repair_stats.get("faces_in") or 0)
                                    faces_out = int(repair_stats.get("faces_out") or 0)
                                    if faces_in > 0 and faces_out < faces_in * 0.88:
                                        logger.warning(
                                            "post-crop repair removed %.0f%% faces (%d -> %d); "
                                            "keeping cropped AI to preserve shank fit",
                                            100.0 * (1.0 - faces_out / faces_in),
                                            faces_in,
                                            faces_out,
                                        )
                                        repair_stats["reverted"] = True
                                        repair_stats["revert_reason"] = "excessive_face_loss"
                                    else:
                                        current_mesh_path = repaired_path
                                        aligned_mesh_path = repaired_path
                                        cropped_ai_path = repaired_path
                                        result["steps_completed"].append("ai_post_crop_repair")
                        else:
                            cropped_ai_path = current_mesh_path
                    except Exception as e:
                        logger.warning("inlay replacement crop failed (%s); keeping aligned AI", e)
                        cropped_ai_path = current_mesh_path

            # Step 3: fuse with cleaned inlay (colored dual / boolean)
            if base_mesh_path and fusion_method == "colored_merge":
                logger.info(
                    "Executing inlay replacement colored merge "
                    "(cleaned inlay + cropped AI, preserve region colors)..."
                )
                try:
                    ai_for_preview = current_mesh_path
                    # Do not radially shrink AI inward for preview: it hides the blue
                    # body inside solid full-ring inlay. Z-fighting is handled in
                    # frontend ModelViewer via polygonOffset on region materials.

                    colored_path = generate_output_path(
                        output_dir, task_id, f"colored.{preview_fmt}"
                    )
                    current_mesh_path = self.export_colored_dual_mesh(
                        inlay_mesh_path=inlay_for_merge,
                        generated_mesh_path=ai_for_preview,
                        output_path=colored_path,
                        output_format=preview_fmt,
                    )
                    preview_glb_path = generate_output_path(
                        output_dir, task_id, f"final.{preview_fmt}"
                    )
                    self._export_preserving_scene(
                        current_mesh_path, preview_glb_path, preview_fmt
                    )
                    result["region_colors"] = {
                        "inlay": list(INLAY_REGION_COLOR[:3]),
                        "generated": list(GENERATED_REGION_COLOR[:3]),
                    }
                    result["steps_completed"].append("colored_merge")
                    colored_merge_ok = True
                except Exception as e:
                    logger.error(
                        "colored_merge failed after alignment; retrying export with "
                        "aligned meshes (no unaligned fallback): %s",
                        e,
                        exc_info=True,
                    )
                    try:
                        colored_path = generate_output_path(
                            output_dir, task_id, f"colored.{preview_fmt}"
                        )
                        current_mesh_path = self.export_colored_dual_mesh(
                            inlay_mesh_path=inlay_for_merge or base_mesh_path,
                            generated_mesh_path=aligned_mesh_path,
                            output_path=colored_path,
                            output_format=preview_fmt,
                        )
                        preview_glb_path = generate_output_path(
                            output_dir, task_id, f"final.{preview_fmt}"
                        )
                        self._export_preserving_scene(
                            current_mesh_path, preview_glb_path, preview_fmt
                        )
                        result["region_colors"] = {
                            "inlay": list(INLAY_REGION_COLOR[:3]),
                            "generated": list(GENERATED_REGION_COLOR[:3]),
                        }
                        result["steps_completed"].append("colored_merge_retry")
                        colored_merge_ok = True
                        logger.info("colored_merge retry succeeded with aligned meshes")
                    except Exception as e2:
                        logger.error(
                            "colored_merge retry also failed — aborting "
                            "(no silent unaligned gray merge): %s",
                            e2,
                            exc_info=True,
                        )
                        try:
                            merged_path = generate_output_path(
                                output_dir, task_id, f"merged.{user_fmt}"
                            )
                            self._export_aligned_download_mesh(
                                inlay_for_merge or base_mesh_path,
                                aligned_mesh_path,
                                merged_path,
                                user_fmt,
                            )
                            result["output_path"] = merged_path
                            result["steps_completed"].append("aligned_download_only")
                        except Exception as e3:
                            logger.error(
                                "aligned download mesh also failed: %s", e3, exc_info=True
                            )
                        result["error"] = f"colored_merge_failed: {e2}"
                        result["success"] = False
                        return result
            elif base_mesh_path and fusion_method == "boolean":
                logger.info("执行布尔替换融合 (AI − inlay) ∪ inlay ...")
                try:
                    # Prefer true replacement: difference then union
                    cut_path = generate_output_path(
                        output_dir, task_id, f"ai_cut.{output_format}"
                    )
                    try:
                        self.boolean_difference(
                            current_mesh_path,
                            inlay_for_merge or base_mesh_path,
                            cut_path,
                        )
                        body_for_union = cut_path
                    except Exception as diff_err:
                        logger.warning(
                            "boolean difference unavailable (%s); union cropped AI",
                            diff_err,
                        )
                        body_for_union = current_mesh_path
                    fused_path = generate_output_path(
                        output_dir, task_id, f"fused.{output_format}"
                    )
                    current_mesh_path = self.boolean_union(
                        inlay_for_merge or base_mesh_path,
                        body_for_union,
                        fused_path,
                    )
                    result["steps_completed"].append("布尔替换融合")
                except Exception as e:
                    logger.warning(f"布尔融合失败，使用简单合并: {e}")
                    merged_path = generate_output_path(
                        output_dir, task_id, f"merged.{output_format}"
                    )
                    mesh_a = self._load_trimesh_mesh(inlay_for_merge or base_mesh_path)
                    mesh_b = self._load_trimesh_mesh(current_mesh_path)
                    merged = self._simple_merge(mesh_a, mesh_b)
                    merged.export(merged_path)
                    current_mesh_path = merged_path
                    result["steps_completed"].append("简单合并(回退)")

            # 步骤5: 拓扑修复（分色双网格成功后禁止整模 repair，否则会 concatenate 并丢掉颜色）
            if (
                enable_repair
                and self._trimesh_available
                and not colored_merge_ok
            ):
                logger.info("执行拓扑修复...")
                try:
                    repaired_path = generate_output_path(
                        output_dir, task_id, f"repaired.{output_format}"
                    )
                    repair_stats = self.repair_mesh(
                        current_mesh_path,
                        repaired_path,
                        apply_jewelry_smooth=apply_jewelry_repair_smooth,
                        generation_config=generation_config,
                    )
                    current_mesh_path = repaired_path
                    result["repair_stats"] = repair_stats
                    result["steps_completed"].append("拓扑修复")
                except Exception as e:
                    logger.warning(f"拓扑修复失败，跳过: {e}")
            elif colored_merge_ok:
                logger.info("分色双网格已导出，跳过整模拓扑修复以保留分区颜色")

            # 步骤6: 写出 final（下载格式 + 分色预览 GLB）
            if colored_merge_ok and preview_glb_path:
                result["preview_path"] = preview_glb_path
                download_path = generate_output_path(
                    output_dir, task_id, f"final.{user_fmt}"
                )
                if user_fmt == preview_fmt:
                    current_mesh_path = preview_glb_path
                else:
                    self._export_aligned_download_mesh(
                        inlay_for_merge or base_mesh_path,
                        aligned_mesh_path,
                        download_path,
                        user_fmt,
                    )
                    current_mesh_path = download_path
            else:
                final_path = generate_output_path(
                    output_dir, task_id, f"final.{user_fmt}"
                )
                if current_mesh_path != final_path:
                    if colored_merge_ok:
                        self._export_preserving_scene(
                            current_mesh_path, final_path, user_fmt
                        )
                    else:
                        self.convert_format(current_mesh_path, final_path)
                    current_mesh_path = final_path

            # 步骤7: 分析最终网格
            if self._trimesh_available:
                mesh_info = self.analyze_mesh(current_mesh_path)
                result["mesh_info"] = mesh_info

            result["success"] = True
            result["output_path"] = current_mesh_path

            logger.info(f"网格后处理完成: {current_mesh_path}")
            logger.info(f"完成的步骤: {result['steps_completed']}")

        except Exception as e:
            logger.error(f"网格后处理失败: {e}", exc_info=True)
            result["error"] = str(e)

        return result


# 全局处理器实例
_processor_instance: Optional[MeshProcessor] = None


def get_mesh_processor() -> MeshProcessor:
    """
    获取网格处理器单例
    """
    global _processor_instance
    if _processor_instance is None:
        _processor_instance = MeshProcessor()
    return _processor_instance
