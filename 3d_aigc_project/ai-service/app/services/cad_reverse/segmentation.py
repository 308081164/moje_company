"""Mesh segmentation for CAD reverse: sharp edges + region growing."""

from __future__ import annotations

from typing import Dict, List, Tuple

import numpy as np


def face_normals(vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
    v0 = vertices[faces[:, 0]]
    v1 = vertices[faces[:, 1]]
    v2 = vertices[faces[:, 2]]
    n = np.cross(v1 - v0, v2 - v0)
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    ln = np.maximum(ln, 1e-12)
    return n / ln


def compute_sharp_edges(
    faces: np.ndarray,
    normals: np.ndarray,
    sharp_angle_deg: float,
) -> np.ndarray:
    """Return boolean mask of faces on sharp edges (dihedral > threshold)."""
    threshold = np.cos(np.deg2rad(float(sharp_angle_deg)))
    edge_to_faces: Dict[Tuple[int, int], List[int]] = {}
    for fi, (a, b, c) in enumerate(faces):
        for e in ((a, b), (b, c), (c, a)):
            key = (min(e), max(e))
            edge_to_faces.setdefault(key, []).append(fi)

    sharp = np.zeros(len(faces), dtype=bool)
    for pair in edge_to_faces.values():
        if len(pair) != 2:
            continue
        f0, f1 = pair
        if float(np.dot(normals[f0], normals[f1])) < threshold:
            sharp[f0] = True
            sharp[f1] = True
    return sharp


def segment_mesh_patches(
    faces: np.ndarray,
    normals: np.ndarray,
    sharp_mask: np.ndarray,
    merge_angle_deg: float,
) -> List[np.ndarray]:
    """
    Grow face regions across non-sharp edges with similar normals.
    Returns list of face index arrays (patches).
    """
    merge_cos = np.cos(np.deg2rad(float(merge_angle_deg)))
    edge_to_faces: Dict[Tuple[int, int], List[int]] = {}
    for fi, (a, b, c) in enumerate(faces):
        for e in ((a, b), (b, c), (c, a)):
            key = (min(e), max(e))
            edge_to_faces.setdefault(key, []).append(fi)

    neighbors: List[List[int]] = [[] for _ in range(len(faces))]
    for pair in edge_to_faces.values():
        if len(pair) != 2:
            continue
        f0, f1 = pair
        if sharp_mask[f0] or sharp_mask[f1]:
            continue
        if float(np.dot(normals[f0], normals[f1])) >= merge_cos:
            neighbors[f0].append(f1)
            neighbors[f1].append(f0)

    visited = np.zeros(len(faces), dtype=bool)
    patches: List[np.ndarray] = []
    for start in range(len(faces)):
        if visited[start]:
            continue
        stack = [start]
        region: List[int] = []
        visited[start] = True
        while stack:
            fi = stack.pop()
            region.append(fi)
            for nb in neighbors[fi]:
                if not visited[nb]:
                    visited[nb] = True
                    stack.append(nb)
        if region:
            patches.append(np.asarray(region, dtype=np.int64))
    return patches
