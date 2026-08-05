# CLI 使用指南

## 安装

在 `ai-service` 目录：

```bash
pip install -e .
# 或
python -m cli --help
```

安装后可用 `aigc` 命令（`pyproject.toml` → `aigc=cli.__main__:main`）。

## 端点

| 模式 | 基址 | 说明 |
|------|------|------|
| 默认 | `http://localhost:8855` | 直连 ai-service |
| `--via-business` | `http://localhost:8854` | 经 business-service，任务入库 |

## 六视角高质量生成

```bash
aigc generate \
  --mode quality \
  --view front=./data/01_front.png \
  --view left=./data/02_left.png \
  --view back=./data/03_back.png \
  --view right=./data/04_right.png \
  --view top=./data/05_top.png \
  --view bottom=./data/06_bottom.png \
  --output-dir ./dataset/out/sample_001 \
  --format stl \
  --wait
```

## 自定义面数

```bash
aigc generate --mode custom --target-faces 80000 \
  --view front=./a.png --view back=./b.png \
  --output-dir ./out/custom_001 --wait
```

## 批处理 JSONL

`jobs.jsonl` 每行示例：

```json
{"sample_id": "ring_001", "mode": "quality", "format": "stl", "views": {"front": "images/ring_001/front.png", "back": "images/ring_001/back.png", "left": "images/ring_001/left.png", "right": "images/ring_001/right.png"}}
```

```bash
aigc batch --manifest jobs.jsonl --workers 4 --output-root ./dataset/meshes
```

`--workers` 控制并发提交与轮询，**不是** GPU 并行。

## 任务管理

```bash
aigc task status <task_id>
aigc task wait <task_id>
aigc task result <task_id>
aigc task cancel <task_id>
```

## 调试单步

```bash
aigc debug step align_icp --raw-mesh a.obj --inlay b.glb --output-dir ./debug_out
aigc debug health
```

## 训练集目录建议

```
dataset/
  jobs.jsonl
  images/{sample_id}/{view}.png
  meshes/{sample_id}/model.stl   # batch --wait 产出
```

## 错误码

- HTTP 503 + Ultra 文案：Ultra 模式封禁
- HTTP 409：调试步骤顺序/状态冲突
- HTTP 400：缺少 mesh 路径或上传为空
