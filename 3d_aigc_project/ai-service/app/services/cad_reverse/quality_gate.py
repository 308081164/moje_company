"""Quality gate for CAD reverse fit."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

import numpy as np


def hausdorff_sample_deviation(
    source_vertices: np.ndarray,
    fitted_sample_points: np.ndarray,
    sample_count: int = 2000,
) -> float:
    if len(source_vertices) == 0 or len(fitted_sample_points) == 0:
        return float("inf")
    n = min(sample_count, len(source_vertices))
    idx = np.linspace(0, len(source_vertices) - 1, n, dtype=int)
    src = source_vertices[idx]
    try:
        from scipy.spatial import cKDTree

        tree = cKDTree(fitted_sample_points)
        dist, _ = tree.query(src, k=1)
        return float(np.max(dist))
    except Exception:
        return float(np.mean(np.linalg.norm(src - fitted_sample_points.mean(axis=0), axis=1)))


def compute_fit_score(
    max_deviation_mm: float,
    tolerance_mm: float,
    surface_count: int,
    max_surfaces: int,
    primitive_ratio: float,
) -> int:
    dev_score = max(0.0, 1.0 - max_deviation_mm / max(tolerance_mm * 3, 1e-6))
    surf_score = max(0.0, 1.0 - surface_count / max(max_surfaces, 1))
    prim_score = min(1.0, primitive_ratio * 1.2)
    score = 100.0 * (0.5 * dev_score + 0.25 * surf_score + 0.25 * prim_score)
    return int(np.clip(score, 0, 100))


def evaluate_fit(
    max_deviation_mm: float,
    tolerance_mm: float,
    surface_count: int,
    max_surfaces: int,
    primitive_count: int,
    seam_gap_mm: float = 0.0,
) -> Tuple[bool, Dict[str, Any]]:
    prim_ratio = primitive_count / max(surface_count, 1)
    score = compute_fit_score(
        max_deviation_mm, tolerance_mm, surface_count, max_surfaces, prim_ratio
    )
    passed = (
        max_deviation_mm <= tolerance_mm * 2.5
        and surface_count <= max_surfaces
        and surface_count >= 1
    )
    report: Dict[str, Any] = {
        "max_deviation_mm": round(max_deviation_mm, 6),
        "surface_count": int(surface_count),
        "seam_gap_mm": round(seam_gap_mm, 6),
        "primitive_count": int(primitive_count),
        "primitive_ratio": round(prim_ratio, 4),
        "score_0_100": score,
        "passed": passed,
    }
    return passed, report
