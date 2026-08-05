# Ultra CAD 模式

Ultra 模式在 **fast / quality** 之外提供第三套生成配置：最高精度 AI mesh + **Mesh → NURBS/STEP** 逆向交付，便于在 Rhino、MatrixGold、SolidWorks 中编辑曲面（移动控制点、延伸、布尔等）。

## 模式对比

| 模式 | 定位 | 主要输出 | 典型耗时 |
|------|------|----------|----------|
| fast | 速度优先 | mesh | 最短 |
| quality | 预览/融合顺滑 mesh | mesh | 中等 |
| ultra | CAD 可编辑交付 | mesh + **STEP** + 拟合报告 | 最长 |

## 推理与网格

- `octree_resolution=512`，`num_inference_steps=65`，`mc_algo=dmc`
- **跳过 QEM/Loop 减面**（`jewelry_coarse_faces=0`），保留 AI 全细节供拟合
- 仅轻量拓扑修复 + 少量 Taubin 平滑

## CAD 逆向流程

1. 锐边检测 + 区域分割（平面 / 圆柱 / 自由曲面）
2. OCCT B-spline / 原语面拟合
3. `BRepBuilderAPI_Sewing` 缝合
4. `STEPControl_Writer` 导出 AP214
5. 质量门禁：`max_deviation_mm`、片数、`score_0_100`

失败时任务仍 **completed**，保留 mesh 下载，并在 `error_message` / 报告中标记 `cad_reverse_failed` 或 `cad_fit_below_threshold_mesh_fallback`。

## 环境变量

```bash
GEN_ULTRA_OCTREE_RESOLUTION=512
GEN_ULTRA_INFERENCE_STEPS=65
ULTRA_CAD_ENABLED=1
ULTRA_FIT_TOLERANCE_MM=0.08
ULTRA_MAX_SURFACES=60
ULTRA_SHARP_ANGLE_DEG=30
ULTRA_STEP_SCHEMA=AP214
ENABLE_CAD_REVERSE=1   # Docker 构建时安装 pythonocc-core
ENABLE_DMC=1           # Docker 构建时编译 diso (DiffDMC)
TORCH_CUDA_ARCH_LIST=8.9
```

## API / 前端

- 创建任务：`generation_mode=ultra`
- 完成后：`cad_step_url` → `GET /api/tasks/{id}/cad-step`
- 任务详情：`cad_fit_score`（0–100）；低于 70 时 UI 提示在 Rhino 中 Patch 微调

## 依赖

### DiffDMC（`diso`）

Ultra 与 quality 模式的 `mc_algo=dmc` 依赖 **`diso==0.1.4`**（Diff Dual Marching Cubes，GPU 曲面提取）。

- Docker 镜像构建时会安装 CUDA 12.1 开发工具链（nvcc）并编译 `diso`（`ENABLE_DMC=1`，默认开启）
- PyPI 无预编译 wheel，必须在构建期编译；RTX 4060 Ti 等 Ada 卡使用 `TORCH_CUDA_ARCH_LIST=8.9`
- 若 `diso` 不可用，运行时自动回退 **marching cubes**（任务仍可完成，网格质量与耗时略差）
- 验证：`GET /health` 中 `dmc_available: true`，或容器内 `resolve_mc_algo('dmc') == 'dmc'`

`diso` 许可为 CC BY-NC 4.0，商用部署需做法务评估。

### CAD 逆向（STEP）

Docker 镜像默认尝试安装 `pythonocc-core`。若安装失败，Ultra 仍可生成 mesh，但 STEP 导出不可用（日志含 `pythonocc_not_available`）。

POC 脚本：

```bash
docker exec -it 3d-aigc-ai-service python scripts/poc_cad_reverse.py
```

## 验收建议

- Rhino 7+ 打开 `final.step`，Explode 后为 NURBS 面（非纯 Mesh）
- SolidWorks Import 识别为曲面实体
- 拟合失败时 mesh 仍可下载
