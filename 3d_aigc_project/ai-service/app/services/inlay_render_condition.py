"""
Render inlay silhouette overlays onto user views (MV conditioning hint).
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from PIL import Image, ImageDraw

logger = logging.getLogger(__name__)

# Camera forward vectors in ring-aligned frame (approximate CAD views)
_VIEW_FORWARD: Dict[str, np.ndarray] = {
    "front": np.array([0.0, 0.0, 1.0]),
    "back": np.array([0.0, 0.0, -1.0]),
    "left": np.array([-1.0, 0.0, 0.0]),
    "right": np.array([1.0, 0.0, 0.0]),
}


def _ring_frame_axes(inlay_mesh_path: str) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    from app.services.mesh_processor import get_mesh_processor

    processor = get_mesh_processor()
    mesh = processor._load_trimesh_mesh(inlay_mesh_path)
    shank, setting = processor._split_shank_and_setting(mesh)
    fi0 = processor._estimate_ring_frame(shank)
    up = processor._geometric_setting_up(fi0, setting)
    if up is None:
        up = processor._detect_setting_up(mesh, fi0)
    frame = processor._frame_with_up(fi0, up)
    center = np.asarray(frame["center"], dtype=np.float64)
    axis = np.asarray(frame["axis"], dtype=np.float64)
    axis = axis / (np.linalg.norm(axis) + 1e-12)
    up_n = np.asarray(frame["up"], dtype=np.float64)
    up_n = up_n / (np.linalg.norm(up_n) + 1e-12)
    e1 = np.cross(axis, up_n)
    e1 = e1 / (np.linalg.norm(e1) + 1e-12)
    e2 = np.cross(axis, e1)
    return center, e1, e2, axis


def _project_vertices(
    vertices: np.ndarray,
    center: np.ndarray,
    forward: np.ndarray,
    e1: np.ndarray,
    e2: np.ndarray,
) -> np.ndarray:
    rel = vertices - center
    fwd = forward / (np.linalg.norm(forward) + 1e-12)
    depth = rel @ fwd
    visible = depth > -1e-6
    u = rel @ e1
    v = rel @ e2
    pts = np.stack([u[visible], v[visible]], axis=1)
    return pts


def _convex_hull_2d(points: np.ndarray) -> List[Tuple[float, float]]:
    if len(points) < 3:
        return [(float(p[0]), float(p[1])) for p in points]
    pts = points[np.lexsort((points[:, 1], points[:, 0]))]

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower: List[np.ndarray] = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper: List[np.ndarray] = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    hull = lower[:-1] + upper[:-1]
    return [(float(p[0]), float(p[1])) for p in hull]


def _overlay_hull_on_image(
    img: Image.Image,
    hull_mm: List[Tuple[float, float]],
    *,
    tint: Tuple[int, int, int, int] = (255, 64, 64, 110),
    margin_frac: float = 0.12,
) -> Image.Image:
    if len(hull) < 3:
        return img
    rgba = img.convert("RGBA")
    w, h = rgba.size
    arr = np.asarray(hull, dtype=np.float64)
    min_u, min_v = arr.min(axis=0)
    max_u, max_v = arr.max(axis=0)
    span_u = max(max_u - min_u, 1e-6)
    span_v = max(max_v - min_v, 1e-6)
    usable = 1.0 - 2.0 * margin_frac
    scale = min(w * usable / span_u, h * usable / span_v)
    cx = w * 0.5
    cy = h * 0.5
    poly = [
        (
            cx + (u - (min_u + max_u) * 0.5) * scale,
            cy - (v - (min_v + max_v) * 0.5) * scale,
        )
        for u, v in hull
    ]
    overlay = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    draw.polygon(poly, fill=tint)
    return Image.alpha_composite(rgba, overlay)


def apply_inlay_render_condition(
    views: Dict[str, str],
    inlay_mesh_path: str,
    output_dir: str,
    task_id: str,
    *,
    faces: Optional[List[str]] = None,
) -> Tuple[Dict[str, str], Dict[str, Any]]:
    from app.utils.file_utils import generate_output_path

    from app.services.mesh_processor import get_mesh_processor

    processor = get_mesh_processor()
    mesh = processor._load_trimesh_mesh(inlay_mesh_path)
    verts = np.asarray(mesh.vertices, dtype=np.float64)
    center, e1, e2, axis = _ring_frame_axes(inlay_mesh_path)

    target_faces = faces or list(views.keys())
    out_views: Dict[str, str] = {}
    info: Dict[str, Any] = {"faces": {}, "applied": False}

    for face in target_faces:
        path = views.get(face)
        if not path or not os.path.isfile(path):
            continue
        fwd = _VIEW_FORWARD.get(face)
        if fwd is None:
            out_views[face] = path
            continue
        # Rotate forward into ring frame: front = +e2 (setting up), left = -e1, etc.
        if face == "front":
            cam_fwd = e2
        elif face == "back":
            cam_fwd = -e2
        elif face == "left":
            cam_fwd = -e1
        elif face == "right":
            cam_fwd = e1
        else:
            cam_fwd = fwd

        pts2d = _project_vertices(verts, center, cam_fwd, e1, e2)
        if len(pts2d) < 8:
            out_views[face] = path
            info["faces"][face] = {"skipped": True, "reason": "too_few_points"}
            continue
        hull = _convex_hull_2d(pts2d)
        img = Image.open(path)
        out_img = _overlay_hull_on_image(img, hull)
        out_path = generate_output_path(output_dir, task_id, f"inlay_cond_{face}.png")
        os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
        out_img.save(out_path)
        out_views[face] = out_path
        info["faces"][face] = {"hull_vertices": len(hull), "output": out_path}
        info["applied"] = True

    for face, path in views.items():
        out_views.setdefault(face, path)

    return out_views, info
