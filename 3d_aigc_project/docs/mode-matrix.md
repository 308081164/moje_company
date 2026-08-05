# 生成模式参数对照

| 参数 | fast | quality | custom |
|------|------|---------|--------|
| 推理步数 | ~30 | ~65 | 继承 quality，可覆盖 |
| octree | 256 | 512 | 可覆盖 |
| 面数/QEM | 无减面 | **不限制**（`jewelry_target_faces=0`） | 用户 `custom_target_faces`（0=不限） |
| Taubin / Loop | 关 / 低 | 开 / 高 | 同 quality |
| mc_algo | 默认 MC | dmc（可回退） | dmc |
| 镶嵌后处理 | 独立开关 `enable_inlay_postprocess`，**默认 false** | 同左 | 同左 |

## Ultra 模式

- 环境变量 `ULTRA_MODE_ENABLED=0`（默认）
- API 返回 503「功能全面升级中」
- 前端选项 disabled

## 镶嵌参与推理 vs 后处理

| 开关 | 行为 |
|------|------|
| 启用镶嵌结构 | 可选 render condition / Omni 条件 |
| `enable_inlay_postprocess=true` | 对齐、裁剪、融合等后处理 |

二者解耦；仅选镶嵌不会自动跑融合。

## 环境变量（节选）

| 变量 | 默认 | 说明 |
|------|------|------|
| `MAX_CONCURRENT_TASKS` | 8 | 任务生命周期并发 |
| `MAX_CONCURRENT_GPU_JOBS` | 1 | GPU 推理（实际串行 1） |
| `MAX_POSTPROCESS_WORKERS` | 4 | 后处理线程池 |
| `REQUIRE_GPU` | 1 | 禁止静默 CPU |
