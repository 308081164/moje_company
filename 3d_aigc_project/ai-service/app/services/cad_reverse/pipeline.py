"""Ultra mode CAD reverse pipeline orchestrator."""

from __future__ import annotations

import json
import logging
import os
from dataclasses import asdict
from typing import Any, Dict, Optional

import numpy as np
import trimesh

from app.config import UltraCadConfig
from app.services.cad_reverse.primitives import classify_patch
from app.services.cad_reverse.quality_gate import evaluate_fit, hausdorff_sample_deviation
from app.services.cad_reverse.segmentation import (
    compute_sharp_edges,
    face_normals,
    segment_mesh_patches,
)
from app.services.cad_reverse.step_export import export_step
from app.services.cad_reverse.surface_fit import (
    build_faces_from_patches,
    occ_available,
    sew_shapes,
)

logger = logging.getLogger(__name__)


class CadReverseService:
    def __init__(self) -> None:
        self._occ = occ_available()

    def reverse_mesh_to_step(
        self,
        mesh_path: str,
        output_step_path: str,
        report_path: Optional[str] = None,
        ultra_cad: Optional[UltraCadConfig] = None,
    ) -> Dict[str, Any]:
        cfg = ultra_cad or UltraCadConfig()
        result: Dict[str, Any] = {
            "success": False,
            "step_path": None,
            "report_path": report_path,
            "occ_available": self._occ,
        }

        if not cfg.enabled:
            result["error"] = "cad_reverse_disabled"
            return result

        if not self._occ:
            result["error"] = "pythonocc_not_available"
            result["warning"] = "Install pythonocc-core for STEP export"
            self._write_report(report_path, result)
            return result

        if not os.path.isfile(mesh_path):
            result["error"] = f"mesh_not_found:{mesh_path}"
            return result

        mesh = trimesh.load(mesh_path, force="mesh")
        if isinstance(mesh, trimesh.Scene):
            mesh = mesh.dump(concatenate=True)
        if not isinstance(mesh, trimesh.Trimesh) or len(mesh.faces) < 4:
            result["error"] = "invalid_mesh"
            return result

        vertices = np.asarray(mesh.vertices, dtype=np.float64)
        faces = np.asarray(mesh.faces, dtype=np.int64)
        extents = mesh.bounds[1] - mesh.bounds[0]
        model_scale = float(np.max(extents))
        tol_mm = cfg.fit_tolerance_mm
        if model_scale > 0 and model_scale < 5:
            tol_mm = cfg.fit_tolerance_mm * model_scale

        normals = face_normals(vertices, faces)
        sharp = compute_sharp_edges(faces, normals, cfg.sharp_angle_deg)
        patches = segment_mesh_patches(
            faces, normals, sharp, cfg.planar_merge_angle_deg
        )

        filtered: list = []
        meta: list = []
        for patch in patches:
            if len(patch) < cfg.min_patch_faces:
                continue
            if len(patch) > cfg.max_patch_faces:
                step = max(1, len(patch) // cfg.max_patch_faces)
                patch = patch[::step][: cfg.max_patch_faces]
            ptype, pdata = classify_patch(
                vertices, faces, patch, plane_tol=tol_mm * 2
            )
            filtered.append(patch)
            meta.append((ptype, pdata))
            if len(filtered) >= cfg.max_surfaces:
                break

        if not filtered:
            result["error"] = "no_patches"
            self._write_report(report_path, result)
            return result

        occ_faces, prim_count, free_count = build_faces_from_patches(
            vertices,
            faces,
            filtered,
            meta,
            tol_mm,
            model_scale,
        )
        if not occ_faces:
            result["error"] = "face_build_failed"
            self._write_report(report_path, result)
            return result

        sew_tol = max(tol_mm, model_scale * 0.001)
        shape = sew_shapes(occ_faces, sew_tol)
        if shape is None:
            result["error"] = "sew_failed"
            self._write_report(report_path, result)
            return result

        os.makedirs(os.path.dirname(output_step_path) or ".", exist_ok=True)
        if not export_step(shape, output_step_path, cfg.step_schema):
            result["error"] = "step_export_failed"
            self._write_report(report_path, result)
            return result

        fitted_pts = vertices[:: max(1, len(vertices) // 3000)]
        max_dev = hausdorff_sample_deviation(vertices, fitted_pts)
        passed, report = evaluate_fit(
            max_dev,
            tol_mm,
            len(occ_faces),
            cfg.max_surfaces,
            prim_count,
        )
        report["freeform_count"] = free_count
        report["patch_count"] = len(filtered)
        report["input_faces"] = int(len(faces))
        report["model_scale"] = round(model_scale, 6)

        result.update(report)
        result["success"] = passed or cfg.fallback_on_failure
        result["step_path"] = output_step_path if passed or cfg.fallback_on_failure else None
        result["quality_passed"] = passed
        if not passed and cfg.fallback_on_failure:
            result["warning"] = "cad_fit_below_threshold_mesh_fallback"

        self._write_report(report_path, {**result, "fit_report": report})
        logger.info(
            "CAD reverse: patches=%d surfaces=%d score=%d step=%s",
            len(filtered),
            len(occ_faces),
            report.get("score_0_100", 0),
            output_step_path,
        )
        return result

    @staticmethod
    def _write_report(path: Optional[str], data: Dict[str, Any]) -> None:
        if not path:
            return
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


def cad_reverse_mesh(
    mesh_path: str,
    output_dir: str,
    task_id: str,
    ultra_cad: Optional[UltraCadConfig] = None,
) -> Dict[str, Any]:
    step_path = os.path.join(output_dir, task_id, "final.step")
    report_path = os.path.join(output_dir, task_id, "cad_fit_report.json")
    svc = CadReverseService()
    return svc.reverse_mesh_to_step(
        mesh_path,
        step_path,
        report_path=report_path,
        ultra_cad=ultra_cad,
    )
