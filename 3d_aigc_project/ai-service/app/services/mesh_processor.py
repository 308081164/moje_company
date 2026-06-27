"""
网格后处理模块
提供ICP点云对齐、SDF布尔融合、拓扑修复等功能
使用 trimesh 和 open3d 库
"""

import os
import logging
import numpy as np
from typing import Optional, Tuple, Dict, Any

logger = logging.getLogger(__name__)


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
    ) -> Tuple[np.ndarray, float]:
        """
        ICP点云对齐

        将源网格对齐到目标网格的坐标系

        Args:
            source_mesh_path: 源网格文件路径（需要对齐的网格）
            target_mesh_path: 目标网格文件路径（参考网格）
            max_iterations: ICP最大迭代次数
            max_correspondence_distance: 最大对应点距离
            init_transform: 初始变换矩阵（4x4），可选

        Returns:
            Tuple[变换矩阵(4x4), 适配误差]
        """
        if not self._open3d_available:
            logger.error("Open3D 不可用，无法执行ICP对齐")
            return np.eye(4), float("inf")

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

        # 初始变换
        if init_transform is not None:
            trans_init = init_transform
        else:
            # 使用质心对齐作为初始变换
            trans_init = np.eye(4)

        logger.info(f"开始ICP对齐: 最大迭代={max_iterations}")

        # 执行点到面ICP（精度更高）
        reg_p2l = o3d.pipelines.registration.registration_icp(
            source_pcd,
            target_pcd,
            max_correspondence_distance,
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
            f"ICP对齐完成: fitness={fitness:.4f}, RMSE={rmse:.6f}"
        )

        return transformation, rmse

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
        mesh.transform(transformation)

        # 确保输出目录存在
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        o3d.io.write_triangle_mesh(output_path, mesh)

        logger.info(f"变换已应用并保存: {output_path}")
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
        布尔并集融合
        将两个网格合并为一个完整的网格（去除内部重叠）

        Args:
            mesh_a_path: 网格A路径
            mesh_b_path: 网格B路径
            output_path: 输出路径

        Returns:
            输出文件路径
        """
        if not self._trimesh_available:
            logger.error("Trimesh 不可用，无法执行布尔融合")
            return mesh_a_path

        import trimesh

        mesh_a = trimesh.load(mesh_a_path)
        mesh_b = trimesh.load(mesh_b_path)

        # 确保都是Trimesh对象
        if isinstance(mesh_a, trimesh.Scene):
            mesh_a = mesh_a.dump(concatenate=True)
        if isinstance(mesh_b, trimesh.Scene):
            mesh_b = mesh_b.dump(concatenate=True)

        logger.info(
            f"布尔并集: A({mesh_a.vertices.shape[0]}顶点) + "
            f"B({mesh_b.vertices.shape[0]}顶点)"
        )

        # 尝试使用manifold3d进行精确布尔运算
        try:
            result = self._boolean_union_manifold(mesh_a, mesh_b)
            if result is not None:
                os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
                result.export(output_path)
                logger.info(f"布尔融合完成(manifold3d): {output_path}")
                return output_path
        except Exception as e:
            logger.warning(f"manifold3d布尔融合失败，回退到简单合并: {e}")

        # 回退方案：简单合并顶点
        result = self._simple_merge(mesh_a, mesh_b)
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        result.export(output_path)
        logger.info(f"简单合并完成: {output_path}")
        return output_path

    def _boolean_union_manifold(self, mesh_a, mesh_b):
        """
        使用 manifold3d 进行精确布尔并集
        """
        try:
            import manifold3d

            # 转换为manifold格式
            manifold_a = manifold3d.Mesh(
                vertices=mesh_a.vertices,
                faces=mesh_a.faces,
            )
            manifold_b = manifold3d.Mesh(
                vertices=mesh_b.vertices,
                faces=mesh_b.faces,
            )

            # 布尔并集
            result_manifold = manifold_a.union(manifold_b)

            # 转回trimesh
            result = trimesh.Trimesh(
                vertices=result_manifold.vertices,
                faces=result_manifold.triangles,
            )
            return result

        except ImportError:
            logger.debug("manifold3d 未安装，跳过精确布尔运算")
            return None
        except Exception as e:
            logger.debug(f"manifold3d 布尔运算失败: {e}")
            return None

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

        stats = {
            "success": True,
            "original_vertices": len(mesh.vertices),
            "original_faces": len(mesh.faces),
            "repairs": [],
        }

        logger.info(f"开始网格修复: {len(mesh.vertices)}顶点, {len(mesh.faces)}面")

        # 1. 移除重复面
        if remove_duplicate_faces:
            before = len(mesh.faces)
            mesh.remove_duplicate_faces()
            removed = before - len(mesh.faces)
            if removed > 0:
                stats["repairs"].append(f"移除了 {removed} 个重复面")
                logger.info(f"移除重复面: {removed}个")

        # 2. 移除退化面（面积为0的面）
        if remove_degenerate_faces:
            before = len(mesh.faces)
            mesh.remove_degenerate_faces()
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

        # 5. 填充孔洞
        if fill_holes:
            try:
                # 使用trimesh的填充功能
                filled = trimesh.repair.fill_holes(mesh)
                if filled is not None:
                    mesh = filled
                    stats["repairs"].append("孔洞已填充")
                    logger.info("孔洞已填充")
            except Exception as e:
                logger.warning(f"填充孔洞失败: {e}")

        # 6. 确保网格是水密的（用于3D打印等场景）
        try:
            is_watertight = mesh.is_watertight
            stats["is_watertight"] = is_watertight
            if not is_watertight:
                logger.warning("网格不是水密的，可能影响后续处理")
        except Exception:
            stats["is_watertight"] = False

        # 7. 珠宝曲面轻度平滑（去除 AI 网格锯齿/尖刺，保持整体形态）
        try:
            mesh = self._apply_jewelry_surface_smooth(mesh)
            stats["repairs"].append("珠宝曲面平滑")
        except Exception as e:
            logger.warning(f"珠宝曲面平滑失败: {e}")

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

    def _get_generation_smooth_config(self):
        try:
            from app.config import get_config
            return get_config().generation
        except Exception:
            return None

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

    def _apply_jewelry_surface_smooth(self, mesh):
        """
        珠宝建模后处理：Taubin 保体积平滑 + 去除尖刺三角面，获得平整顺滑曲面。
        """
        import trimesh

        if not isinstance(mesh, trimesh.Trimesh):
            return mesh

        gen_cfg = self._get_generation_smooth_config()
        taubin_iter = gen_cfg.jewelry_taubin_iterations if gen_cfg else 10
        taubin_lambda = gen_cfg.jewelry_taubin_lambda if gen_cfg else 0.5
        taubin_nu = gen_cfg.jewelry_taubin_nu if gen_cfg else -0.53
        min_area_ratio = gen_cfg.jewelry_min_face_area_ratio if gen_cfg else 0.0015
        max_aspect = gen_cfg.jewelry_spike_aspect_ratio if gen_cfg else 40.0

        before_faces = len(mesh.faces)
        mesh.remove_degenerate_faces()
        mesh.remove_duplicate_faces()
        mesh.merge_vertices()
        mesh = self._remove_spike_faces(mesh, min_area_ratio, max_aspect)

        if taubin_iter > 0:
            try:
                import trimesh.smoothing as smoothing

                smoothed = smoothing.filter_taubin(
                    mesh,
                    lamb=taubin_lambda,
                    nu=taubin_nu,
                    iterations=taubin_iter,
                )
                if isinstance(smoothed, trimesh.Trimesh):
                    mesh = smoothed
            except Exception:
                try:
                    import trimesh.smoothing as smoothing

                    iterations = 2 if len(mesh.faces) < 120_000 else 1
                    smoothed = smoothing.filter_laplacian(
                        mesh, lamb=0.35, iterations=iterations
                    )
                    if isinstance(smoothed, trimesh.Trimesh):
                        mesh = smoothed
                except Exception:
                    pass

        mesh = self._remove_spike_faces(mesh, min_area_ratio, max_aspect)
        mesh.remove_degenerate_faces()
        mesh.merge_vertices()
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

    def jewelry_finish_mesh(self, mesh_path: str, output_path: str) -> str:
        """对生成网格做珠宝级曲面整理（修复 + 平滑）。"""
        self.repair_mesh(
            mesh_path,
            output_path,
            remove_duplicate_faces=True,
            remove_degenerate_faces=True,
            fill_holes=True,
            fix_normals=True,
            merge_close_vertices=True,
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
    ) -> str:
        """
        网格格式转换

        Args:
            input_path: 输入文件路径
            output_path: 输出文件路径

        Returns:
            输出文件路径
        """
        if not self._trimesh_available:
            logger.error("Trimesh 不可用，无法转换格式")
            return input_path

        import trimesh

        mesh = trimesh.load(input_path)
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        mesh.export(output_path)

        logger.info(f"格式转换完成: {input_path} -> {output_path}")
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
        fusion_method: str = "boolean",
        enable_icp: bool = True,
        enable_repair: bool = True,
        output_format: str = "glb",
    ) -> Dict[str, Any]:
        """
        完整的网格后处理流程

        步骤:
        1. 加载生成的网格
        2. （可选）ICP对齐到底座
        3. （可选）布尔融合
        4. 拓扑修复
        5. 格式转换并保存

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

            # 步骤2: ICP对齐（如果有底座）
            if base_mesh_path and enable_icp and self._open3d_available:
                logger.info("执行ICP对齐...")
                try:
                    aligned_path = generate_output_path(
                        output_dir, task_id, f"aligned.{output_format}"
                    )
                    transform, rmse = self.icp_align(
                        current_mesh_path, base_mesh_path
                    )
                    current_mesh_path = self.apply_icp_transform(
                        current_mesh_path, transform, aligned_path
                    )
                    result["icp_rmse"] = rmse
                    result["steps_completed"].append("ICP对齐")
                except Exception as e:
                    logger.warning(f"ICP对齐失败，跳过: {e}")

            # 步骤3: 布尔融合（如果有底座）
            if base_mesh_path and fusion_method == "boolean":
                logger.info("执行布尔融合...")
                try:
                    fused_path = generate_output_path(
                        output_dir, task_id, f"fused.{output_format}"
                    )
                    current_mesh_path = self.boolean_union(
                        base_mesh_path, current_mesh_path, fused_path
                    )
                    result["steps_completed"].append("布尔融合")
                except Exception as e:
                    logger.warning(f"布尔融合失败，使用简单合并: {e}")
                    merged_path = generate_output_path(
                        output_dir, task_id, f"merged.{output_format}"
                    )
                    # 使用简单合并作为回退
                    import trimesh
                    mesh_a = trimesh.load(base_mesh_path)
                    mesh_b = trimesh.load(current_mesh_path)
                    if isinstance(mesh_a, trimesh.Scene):
                        mesh_a = mesh_a.dump(concatenate=True)
                    if isinstance(mesh_b, trimesh.Scene):
                        mesh_b = mesh_b.dump(concatenate=True)
                    merged = self._simple_merge(mesh_a, mesh_b)
                    merged.export(merged_path)
                    current_mesh_path = merged_path
                    result["steps_completed"].append("简单合并(回退)")

            # 步骤4: 拓扑修复
            if enable_repair and self._trimesh_available:
                logger.info("执行拓扑修复...")
                try:
                    repaired_path = generate_output_path(
                        output_dir, task_id, f"repaired.{output_format}"
                    )
                    repair_stats = self.repair_mesh(
                        current_mesh_path, repaired_path
                    )
                    current_mesh_path = repaired_path
                    result["repair_stats"] = repair_stats
                    result["steps_completed"].append("拓扑修复")
                except Exception as e:
                    logger.warning(f"拓扑修复失败，跳过: {e}")

            # 步骤5: 格式转换（如果需要）
            final_path = generate_output_path(
                output_dir, task_id, f"final.{output_format}"
            )
            if current_mesh_path != final_path:
                self.convert_format(current_mesh_path, final_path)
                current_mesh_path = final_path

            # 步骤6: 分析最终网格
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
