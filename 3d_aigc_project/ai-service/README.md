# 3D AIGC 推理服务

基于 FastAPI + Hunyuan3D-2 的3D模型生成推理服务，支持图片到3D、条件生成、网格融合等功能。

## 功能特性

- **图片到3D**: 将设计图片转换为3D模型（GLB/OBJ/STL等格式）
- **条件生成**: 设计图 + 镶嵌底座 -> 珠宝3D模型
- **网格融合**: 底座 + 生成结果 -> 完整模型（ICP对齐 + 布尔融合）
- **硬件自适应**: 根据GPU显存自动选择 mini/standard/turbo 模型
- **离线部署**: 支持从本地路径加载模型，无需联网

## 环境要求

- Python 3.10+
- NVIDIA GPU（推荐8GB+显存）
- CUDA 12.1+

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量（可选）

```bash
# 强制指定模型版本
export MODEL_VERSION=standard

# 模型本地路径
export MODEL_PATH=./models/

# 镶嵌结构数据库路径
export INLAY_DB_PATH=../../镶嵌结构数据库/

# 离线模式（不从HuggingFace下载）
export OFFLINE_MODE=true

# 输出目录
export OUTPUT_DIR=./outputs/
```

### 3. 启动服务

```bash
# 直接启动
python -m app.main

# 或使用uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8855
```

### 4. 访问API文档

启动后访问 http://localhost:8855/docs 查看交互式API文档。

## Docker部署

```bash
# 构建镜像
docker build -t 3d-aigc-service .

# 运行容器（需要NVIDIA Container Toolkit）
docker run -d \
  --gpus all \
  -p 8855:8855 \
  -v ./models:/app/models \
  -v ./outputs:/app/outputs \
  -e MODEL_VERSION=standard \
  -e OFFLINE_MODE=true \
  --name 3d-aigc-service \
  3d-aigc-service
```

## API接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/generate/image-to-3d | 图片生成3D |
| POST | /api/generate/condition-generate | 条件生成 |
| GET  | /api/generate/status/{task_id} | 查询任务状态 |
| GET  | /api/generate/result/{task_id} | 获取生成结果 |
| GET  | /api/generate/download/{task_id} | 下载结果文件 |
| POST | /api/generate/mesh-fusion | 网格融合 |
| GET  | /api/generate/tasks | 任务列表 |
| GET  | /api/generate/system-info | 系统信息 |
| GET  | /health | 健康检查 |

## 模型版本

| 版本 | 显存要求 | 分辨率 | 点云密度 | 适用场景 |
|------|----------|--------|----------|----------|
| mini | < 8GB | 256 | 2048 | 消费级显卡 |
| standard | 8-16GB | 384 | 4096 | RTX 3070/4070 |
| turbo | >= 16GB | 512 | 8192 | RTX 4090/A100 |

## 项目结构

```
ai-service/
├── app/
│   ├── main.py              # FastAPI入口
│   ├── config.py            # 硬件自适应配置
│   ├── routers/
│   │   └── generate.py      # API路由
│   ├── services/
│   │   ├── model_manager.py # 模型管理
│   │   ├── generator.py     # 3D生成核心
│   │   └── mesh_processor.py# 网格后处理
│   ├── models/
│   │   └── schemas.py       # 数据模型
│   └── utils/
│       ├── hardware.py      # GPU检测
│       └── file_utils.py    # 文件工具
├── models/                  # 模型存放目录
├── requirements.txt
├── Dockerfile
└── README.md
```
