"""Detect planar / cylindrical primitives in mesh patches."""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

import numpy as np


def _patch_vertices(vertices: np.ndarray, faces: np.ndarray, face_idx: np.ndarray) -> np.ndarray:
    tri = faces[face_idx]
    return vertices[tri.reshape(-1)]


def fit_plane(points: np.ndarray) -> Optional[Dict[str, Any]]:
    if len(points) < 3:
        return None
    centroid = points.mean(axis=0)
    centered = points - centroid
    _, _, vh = np.linalg.svd(centered, full_matrices=False)
    normal = vh[-1]
    normal = normal / max(np.linalg.norm(normal), 1e-12)
    dist = np.abs(centered @ normal)
    rmse = float(np.sqrt(np.mean(dist ** 2)))
    return {
        "type": "plane",
        "centroid": centroid,
        "normal": normal,
        "rmse": rmse,
    }


def fit_cylinder(points: np.ndarray) -> Optional[Dict[str, Any]]:
    if len(points) < 20:
        return None
    centroid = points.mean(axis=0)
    centered = points - centroid
    _, _, vh = np.linalg.svd(centered, full_matrices=False)
    axis = vh[0]
    axis = axis / max(np.linalg.norm(axis), 1e-12)
    # Project to plane perpendicular to axis
    proj = centered - np.outer(centered @ axis, axis)
    radii = np.linalg.norm(proj, axis=1)
    r_mean = float(np.mean(radii))
    r_std = float(np.std(radii))
    if r_mean <= 1e-6:
        return None
    rel_std = r_std / r_mean
    if rel_std > 0.08:
        return None
    return {
        "type": "cylinder",
        "centroid": centroid,
        "axis": axis,
        "radius": r_mean,
        "rel_std": rel_std,
    }


def classify_patch(
    vertices: np.ndarray,
    faces: np.ndarray,
    face_idx: np.ndarray,
    plane_tol: float,
    cyl_rel_std: float = 0.08,
) -> Tuple[str, Optional[Dict[str, Any]]]:
    pts = _patch_vertices(vertices, faces, face_idx)
    plane = fit_plane(pts)
    if plane and plane["rmse"] <= plane_tol:
        return "planar", plane
    cyl = fit_cylinder(pts)
    if cyl and cyl["rel_std"] <= cyl_rel_std:
        return "cylindrical", cyl
    return "freeform", None
