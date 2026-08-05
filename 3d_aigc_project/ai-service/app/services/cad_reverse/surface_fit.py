"""OCCT surface fitting from mesh patches."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

_OCC_AVAILABLE = False
try:
    from OCC.Core.BRepBuilderAPI import (
        BRepBuilderAPI_MakeFace,
        BRepBuilderAPI_Sewing,
    )
    from OCC.Core.GeomAPI import GeomAPI_PointsToBSplineSurface
    from OCC.Core.gp import gp_Ax2, gp_Cylinder, gp_Dir, gp_Pln, gp_Pnt
    from OCC.Core.Geom import Geom_CylindricalSurface, Geom_Plane
    from OCC.Core.TColgp import TColgp_Array2OfPnt
    from OCC.Core.TopoDS import TopoDS_Shape

    _OCC_AVAILABLE = True
except ImportError:
    TopoDS_Shape = Any  # type: ignore


def occ_available() -> bool:
    return _OCC_AVAILABLE


def _sample_patch_uv(
    vertices: np.ndarray,
    faces: np.ndarray,
    face_idx: np.ndarray,
    samples: int = 400,
) -> np.ndarray:
    tri = faces[face_idx]
    pts = vertices[tri.reshape(-1)]
    if len(pts) <= samples:
        return pts
    rng = np.random.default_rng(42)
    idx = rng.choice(len(pts), size=samples, replace=False)
    return pts[idx]


def _points_to_bspline_surface(points: np.ndarray, tol: float) -> Optional[Any]:
    n = len(points)
    side = max(4, int(np.ceil(np.sqrt(n))))
    while side * side < n:
        side += 1
    arr = TColgp_Array2OfPnt(1, side, 1, side)
    for i in range(side):
        for j in range(side):
            k = min(i * side + j, n - 1)
            p = points[k]
            arr.SetValue(i + 1, j + 1, gp_Pnt(float(p[0]), float(p[1]), float(p[2])))
    try:
        api = GeomAPI_PointsToBSplineSurface(arr, 3, 8, 2, tol, tol)
        if not api.IsDone():
            return None
        return api.Surface()
    except Exception as e:
        logger.debug("BSpline fit failed: %s", e)
        return None


def build_face_from_primitive(
    prim_type: str,
    prim_data: Dict[str, Any],
    bounds: Tuple[float, float, float],
) -> Optional[Any]:
    ext = max(bounds)
    half = ext * 0.6
    try:
        if prim_type == "planar" and prim_data:
            c = prim_data["centroid"]
            n = prim_data["normal"]
            pln = gp_Pln(
                gp_Pnt(float(c[0]), float(c[1]), float(c[2])),
                gp_Dir(float(n[0]), float(n[1]), float(n[2])),
            )
            face = BRepBuilderAPI_MakeFace(pln, -half, half, -half, half).Face()
            return face
        if prim_type == "cylindrical" and prim_data:
            c = prim_data["centroid"]
            axis = prim_data["axis"]
            r = float(prim_data["radius"])
            ax2 = gp_Ax2(
                gp_Pnt(float(c[0]), float(c[1]), float(c[2])),
                gp_Dir(float(axis[0]), float(axis[1]), float(axis[2])),
            )
            cyl = Geom_CylindricalSurface(ax2, r)
            face = BRepBuilderAPI_MakeFace(cyl, 0.0, 2 * np.pi, -half, half).Face()
            return face
    except Exception as e:
        logger.debug("primitive face failed: %s", e)
    return None


def build_faces_from_patches(
    vertices: np.ndarray,
    faces: np.ndarray,
    patches: List[np.ndarray],
    patch_meta: List[Tuple[str, Optional[Dict[str, Any]]]],
    fit_tolerance: float,
    model_scale: float,
) -> Tuple[List[Any], int, int]:
    """Returns (occ_faces, primitive_count, freeform_count)."""
    occ_faces: List[Any] = []
    prim_count = 0
    free_count = 0
    tol = max(fit_tolerance, model_scale * 0.002)
    bounds = tuple(float(np.max(vertices.max(axis=0) - vertices.min(axis=0))) for _ in range(3))

    for face_idx, (ptype, pdata) in zip(patches, patch_meta):
        if ptype in ("planar", "cylindrical") and pdata:
            face = build_face_from_primitive(ptype, pdata, bounds)
            if face is not None:
                occ_faces.append(face)
                prim_count += 1
                continue
        pts = _sample_patch_uv(vertices, faces, face_idx)
        surf = _points_to_bspline_surface(pts, tol)
        if surf is None:
            free_count += 1
            continue
        try:
            face = BRepBuilderAPI_MakeFace(surf, 1e-3).Face()
            occ_faces.append(face)
            free_count += 1
        except Exception:
            free_count += 1
    return occ_faces, prim_count, free_count


def sew_shapes(faces: List[Any], tolerance: float) -> Optional[Any]:
    if not faces:
        return None
    sewing = BRepBuilderAPI_Sewing(float(tolerance))
    for f in faces:
        sewing.Add(f)
    sewing.Perform()
    shape = sewing.SewedShape()
    if shape.IsNull():
        return None
    return shape
