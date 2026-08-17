"""
点云条件编码模块（轨道A / Omni）
将镶嵌底座 Mesh 转换为点云条件，用于几何约束与 Hunyuan3D-Omni 推理
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


class PointCloudConditioner:
    """镶嵌底座 Mesh → 点云条件"""

    OMNI_NORMALIZE_SCALE = 0.98

    def __init__(self, num_points: int = 2048, include_normals: bool = True):
        self.num_points = num_points
        self.include_normals = include_normals
        self._open3d_available = False
        self._trimesh_available = False
        self._check_dependencies()

    def _check_dependencies(self) -> None:
        try:
            import open3d  # noqa: F401

            self._open3d_available = True
        except ImportError:
            logger.warning("Open3D 未安装，点云采样将使用 trimesh 回退")

        try:
            import trimesh  # noqa: F401

            self._trimesh_available = True
        except ImportError:
            logger.warning("Trimesh 未安装，点云条件功能受限")

    def mesh_to_pointcloud(self, mesh_path: str) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        """
        将 Mesh 转为均匀采样点云

        Returns:
            points: [N, 3]
            normals: [N, 3] 或 None
        """
        if self._open3d_available:
            return self._mesh_to_pointcloud_open3d(mesh_path)
        if self._trimesh_available:
            return self._mesh_to_pointcloud_trimesh(mesh_path)
        raise RuntimeError("缺少 Open3D/Trimesh，无法生成点云条件")

    def _mesh_to_pointcloud_open3d(self, mesh_path: str) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        import open3d as o3d

        mesh = o3d.io.read_triangle_mesh(mesh_path)
        if not mesh.has_vertices():
            raise ValueError(f"网格为空: {mesh_path}")

        pcd = mesh.sample_points_uniformly(number_of_points=self.num_points)
        points = np.asarray(pcd.points, dtype=np.float32)

        normals = None
        if self.include_normals:
            pcd.estimate_normals()
            pcd.orient_normals_consistent_tangent_plane(100)
            normals = np.asarray(pcd.normals, dtype=np.float32)

        return points, normals

    def _mesh_to_pointcloud_trimesh(self, mesh_path: str) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        import trimesh
        from app.services.mesh_processor import get_mesh_processor

        mesh = get_mesh_processor()._load_trimesh_mesh(mesh_path)

        points, face_idx = trimesh.sample.sample_surface(mesh, self.num_points)
        points = np.asarray(points, dtype=np.float32)

        normals = None
        if self.include_normals and hasattr(mesh, "face_normals"):
            normals = mesh.face_normals[face_idx].astype(np.float32)

        return points, normals

    @staticmethod
    def normalize_for_omni(
        points: np.ndarray,
        scale: float = OMNI_NORMALIZE_SCALE,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Center + scale to unit bbox (Omni inference convention).
        Returns normalized points and inverse transform metadata for post-alignment.
        """
        pts = np.asarray(points, dtype=np.float64)
        if pts.size == 0:
            return pts.astype(np.float32), {"center": [0, 0, 0], "scale": 1.0}

        bbox_min = pts.min(axis=0)
        bbox_max = pts.max(axis=0)
        center = (bbox_min + bbox_max) * 0.5
        extent = float(np.max(bbox_max - bbox_min))
        extent = max(extent, 1e-6)
        norm = (pts - center) / extent * (2.0 * float(scale))
        inv = {
            "center": center.tolist(),
            "scale": extent,
            "omni_scale": float(scale),
        }
        return norm.astype(np.float32), inv

    def estimate_bbox(self, points: np.ndarray, margin: float = 0.05) -> Tuple[float, float, float]:
        """根据点云估计生成区域边界框 (width, height, depth)，单位与模型一致"""
        if points.size == 0:
            return 1.0, 1.0, 1.0

        mins = points.min(axis=0)
        maxs = points.max(axis=0)
        size = maxs - mins
        size = np.maximum(size, 1e-6)
        size = size * (1.0 + margin)
        return float(size[0]), float(size[1]), float(size[2])

    @staticmethod
    def add_contact_region_markers(
        points: np.ndarray,
        contact_regions: List[Dict[str, Any]],
    ) -> np.ndarray:
        """Mark points near contact/seat regions (1 = contact, 0 = background)."""
        markers = np.zeros((len(points), 1), dtype=np.float32)
        for region in contact_regions:
            center_pt = np.asarray(region.get("center", [0, 0, 0]), dtype=np.float32)
            radius = float(region.get("radius", 0.5))
            dist = np.linalg.norm(points - center_pt, axis=1)
            markers[dist < radius] = 1.0
        return markers

    def extract_contact_regions(self, mesh_path: str) -> List[Dict[str, Any]]:
        """
        Derive contact/seat regions from shank-setting interface (ring frame).
        """
        try:
            import trimesh
            from app.services.mesh_processor import get_mesh_processor

            mesh = get_mesh_processor()._load_trimesh_mesh(mesh_path)
            processor = get_mesh_processor()
            shank, setting = processor._split_shank_and_setting(mesh)
            if processor._mesh_vertex_count(shank) == 0:
                return []

            fi0 = processor._estimate_ring_frame(shank)
            up = processor._geometric_setting_up(fi0, setting)
            if up is None:
                up = processor._detect_setting_up(mesh, fi0)
            frame = processor._frame_with_up(fi0, up)
            diam = float(frame["diameter"])
            thick = float(frame.get("thick", diam * 0.08))
            seat_center = np.asarray(frame["center"], dtype=np.float64) + np.asarray(
                frame["up"], dtype=np.float64
            ) * (diam * 0.35)
            return [
                {
                    "center": seat_center.tolist(),
                    "radius": max(thick * 2.5, diam * 0.06),
                    "kind": "shank_seat",
                }
            ]
        except Exception as e:
            logger.warning("contact region extraction failed: %s", e)
            return []

    def build_condition_features(
        self,
        mesh_path: str,
        contact_regions: Optional[List[Dict[str, Any]]] = None,
        *,
        for_omni: bool = True,
    ) -> Dict[str, Any]:
        """
        构建轨道A / Omni 条件特征包

        Returns:
            dict 包含 point_cloud, normals, bbox, normalized_points, inverse_transform 等
        """
        points, normals = self.mesh_to_pointcloud(mesh_path)
        bbox = self.estimate_bbox(points)
        center = points.mean(axis=0).tolist()

        regions = contact_regions
        if regions is None:
            regions = self.extract_contact_regions(mesh_path)

        features: Dict[str, Any] = {
            "point_cloud": points,
            "normals": normals,
            "bbox": bbox,
            "center": center,
            "num_points": len(points),
            "mesh_path": mesh_path,
            "contact_regions": regions,
        }

        if regions:
            features["contact_markers"] = self.add_contact_region_markers(points, regions)

        if for_omni:
            norm_points, inv = self.normalize_for_omni(points)
            features["normalized_points"] = norm_points
            features["inverse_transform"] = inv
            if regions and "contact_markers" in features:
                norm_regions = []
                inv_center = np.asarray(inv["center"], dtype=np.float64)
                inv_scale = float(inv["scale"])
                omni_scale = float(inv.get("omni_scale", self.OMNI_NORMALIZE_SCALE))
                for region in regions:
                    rc = np.asarray(region.get("center", center), dtype=np.float64)
                    nc = (rc - inv_center) / max(inv_scale, 1e-6) * (2.0 * omni_scale)
                    norm_regions.append(
                        {
                            **region,
                            "center": nc.tolist(),
                            "radius": float(region.get("radius", 0.5))
                            / max(inv_scale, 1e-6)
                            * (2.0 * omni_scale),
                        }
                    )
                features["normalized_contact_regions"] = norm_regions

        logger.info(
            "点云条件已生成: points=%d bbox=%s center=%s omni=%s",
            len(points),
            bbox,
            [round(v, 4) for v in center],
            for_omni,
        )
        return features


def apply_inverse_transform_to_mesh(mesh, inverse_transform: Dict[str, Any]):
    """Map Omni-normalized mesh back to inlay-aligned coordinates."""
    import trimesh

    if mesh is None or not inverse_transform:
        return mesh
    center = np.asarray(inverse_transform.get("center", [0, 0, 0]), dtype=np.float64)
    scale = float(inverse_transform.get("scale", 1.0))
    omni_scale = float(inverse_transform.get("omni_scale", PointCloudConditioner.OMNI_NORMALIZE_SCALE))
    if scale <= 1e-9:
        return mesh
    if isinstance(mesh, str):
        mesh = trimesh.load(mesh, force="mesh", process=False)
    out = mesh.copy()
    pts = np.asarray(out.vertices, dtype=np.float64)
    pts = pts / (2.0 * omni_scale) * scale + center
    out.vertices = pts
    return out


def build_omni_condition_points(
    features: Dict[str, Any],
    num_points: int = 2048,
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Prefer contact/seat region samples for Omni point conditioning.
    Returns normalized XYZ [N,3] and selection metadata.
    """
    norm = np.asarray(features.get("normalized_points"), dtype=np.float32)
    if norm.size == 0:
        norm = np.asarray(features.get("point_cloud"), dtype=np.float32)
    if norm.size == 0:
        return np.zeros((0, 3), dtype=np.float32), {"reason": "empty"}

    markers = features.get("contact_markers")
    info: Dict[str, Any] = {"total": len(norm), "target": num_points}
    if markers is not None and len(markers) == len(norm):
        m = np.asarray(markers, dtype=np.float32).reshape(-1)
        contact_idx = np.where(m > 0.5)[0]
        info["contact_count"] = int(len(contact_idx))
        if len(contact_idx) >= max(32, num_points // 8):
            contact_pts = norm[contact_idx]
            n_contact = min(len(contact_pts), num_points // 2)
            n_fill = num_points - n_contact
            rng = np.random.default_rng(42)
            pick_c = contact_pts if len(contact_pts) <= n_contact else contact_pts[rng.choice(len(contact_pts), n_contact, replace=False)]
            rest_idx = np.where(m <= 0.5)[0]
            rest = norm[rest_idx]
            if len(rest) >= n_fill:
                pick_f = rest[rng.choice(len(rest), n_fill, replace=False)]
            else:
                pick_f = norm[rng.choice(len(norm), n_fill, replace=False)]
            merged = np.vstack([pick_c, pick_f]).astype(np.float32)
            info["mode"] = "contact_weighted"
            return merged[:num_points], info

    if len(norm) <= num_points:
        info["mode"] = "all"
        return norm.astype(np.float32), info
    rng = np.random.default_rng(42)
    idx = rng.choice(len(norm), num_points, replace=False)
    info["mode"] = "uniform_subsample"
    return norm[idx].astype(np.float32), info


def get_pointcloud_conditioner(num_points: int = 2048) -> PointCloudConditioner:
    return PointCloudConditioner(num_points=num_points)
