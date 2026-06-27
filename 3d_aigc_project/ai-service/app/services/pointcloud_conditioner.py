"""
点云条件编码模块（轨道A）
将镶嵌底座 Mesh 转换为点云条件，用于几何约束与包围盒估计
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


class PointCloudConditioner:
    """镶嵌底座 Mesh → 点云条件"""

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

        mesh = trimesh.load(mesh_path)
        if isinstance(mesh, trimesh.Scene):
            mesh = mesh.dump(concatenate=True)

        points, face_idx = trimesh.sample.sample_surface(mesh, self.num_points)
        points = np.asarray(points, dtype=np.float32)

        normals = None
        if self.include_normals and hasattr(mesh, "face_normals"):
            normals = mesh.face_normals[face_idx].astype(np.float32)

        return points, normals

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

    def build_condition_features(
        self,
        mesh_path: str,
        contact_regions: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        构建轨道A条件特征包

        Returns:
            dict 包含 point_cloud, bbox, center, scale 等
        """
        points, normals = self.mesh_to_pointcloud(mesh_path)
        bbox = self.estimate_bbox(points)
        center = points.mean(axis=0).tolist()

        features: Dict[str, Any] = {
            "point_cloud": points,
            "normals": normals,
            "bbox": bbox,
            "center": center,
            "num_points": len(points),
            "mesh_path": mesh_path,
        }

        if contact_regions:
            markers = np.zeros((len(points), 1), dtype=np.float32)
            for region in contact_regions:
                center_pt = np.asarray(region.get("center", [0, 0, 0]), dtype=np.float32)
                radius = float(region.get("radius", 0.5))
                dist = np.linalg.norm(points - center_pt, axis=1)
                markers[dist < radius] = 1.0
            features["contact_markers"] = markers

        logger.info(
            "点云条件已生成: points=%d bbox=%s center=%s",
            len(points),
            bbox,
            [round(v, 4) for v in center],
        )
        return features


def get_pointcloud_conditioner(num_points: int = 2048) -> PointCloudConditioner:
    return PointCloudConditioner(num_points=num_points)
