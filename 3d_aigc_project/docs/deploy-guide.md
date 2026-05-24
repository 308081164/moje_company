# 珠宝3D生成系统 - 部署指南

## 项目架构概述

系统采用前后端分离 + AI推理服务分离的三层架构：

```
用户浏览器 → 前端(8853) → 业务服务(8854) → AI推理服务(8855)
                                    ↓
                              镶嵌结构数据库
```

| 服务 | 技术栈 | 端口 | 说明 |
|------|--------|------|------|
| frontend | Vue 3 + Element Plus + Three.js | 8853 | 用户界面 |
| business-service | Java Spring Boot 3.2 | 8854 | 业务逻辑、文件管理 |
| ai-service | Python FastAPI + Hunyuan3D-2 | 8855 | 3D模型推理 |

## 环境要求

### 硬件要求
- GPU: NVIDIA GPU，最低6GB显存（推荐8GB+）
- 内存: 16GB+
- 磁盘: 20GB+（模型文件约3GB）

### 软件要求
- Docker 24.0+ (含Docker Compose)
- NVIDIA Container Toolkit（GPU支持）
- Git

### 支持的GPU及推荐模型版本
| 显存 | 推荐模型 | 生成质量 | 生成速度 |
|------|---------|---------|---------|
| < 8GB | mini | 中等 | ~60-90秒 |
| 8-16GB | standard | 高 | ~30-60秒 |
| > 16GB | turbo | 最高 | ~15-30秒 |

## 快速开始

### 1. 克隆项目
```bash
cd 3d_aigc_project
```

### 2. 下载模型（需要联网）
```bash
# 方式一：使用下载脚本
python scripts/download-models.py

# 方式二：手动下载
# 从 https://huggingface.co/tencent/Hunyuan3D-2mini 下载模型文件
# 放到 models/hunyuan3d-dit-v2-mini/ 目录下
```

### 3. 配置环境变量
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑.env文件，根据实际硬件配置
# 主要配置项：
# GPU_MEMORY_GB=8          # GPU显存大小
# MODEL_VERSION=auto       # auto/mini/standard/turbo
# INLAY_DB_PATH=../镶嵌结构数据库  # 镶嵌结构数据库路径
```

### 4. 检测硬件
```bash
python scripts/check-hardware.py
```

### 5. 启动服务

#### 开发环境（Docker Compose）
```bash
# 构建并启动所有服务
docker-compose up --build

# 后台运行
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

#### 生产环境
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

#### 本地开发（不使用Docker）

**启动AI推理服务：**
```bash
cd ai-service
pip install -r requirements.txt
python -m app.main
# 服务运行在 http://localhost:8855
```

**启动业务服务：**
```bash
cd business-service
mvn spring-boot:run
# 服务运行在 http://localhost:8854
```

**启动前端：**
```bash
cd frontend
npm install
npm run dev
# 前端运行在 http://localhost:8853
```

### 6. 访问系统
打开浏览器访问: http://localhost:8853

## 离线部署

### 准备离线包
1. 在有网络的机器上下载模型：
   ```bash
   python scripts/download-models.py
   ```
2. 打包项目（排除node_modules和临时文件）：
   ```bash
   # 打包整个项目
   tar -czf jewelry3d-offline.tar.gz 3d_aigc_project/
   ```

### 在离线服务器部署
1. 解压项目
2. 设置环境变量 `OFFLINE_MODE=true`
3. 构建Docker镜像（使用预下载的模型）
4. 启动服务

### Docker离线镜像
```bash
# 在有网络的机器上构建并导出镜像
docker-compose build
docker save jewelry3d-frontend jewelry3d-business jewelry3d-ai -o jewelry3d-images.tar

# 在离线服务器上加载镜像
docker load -i jewelry3d-images.tar
```

## API接口文档

### 3D生成相关
| 接口 | 方法 | 说明 |
|------|------|------|
| /api/generate/image-to-3d | POST | 图片生成3D |
| /api/generate/condition-generate | POST | 条件生成（设计图+镶嵌底座） |
| /api/generate/tasks | GET | 获取任务列表 |
| /api/generate/tasks/{taskId} | GET | 获取任务详情 |
| /api/generate/download/{taskId} | GET | 下载生成结果 |
| /api/generate/tasks/{taskId} | DELETE | 删除任务 |

### 镶嵌结构管理
| 接口 | 方法 | 说明 |
|------|------|------|
| /api/inlay/list | GET | 列出镶嵌结构 |
| /api/inlay/{filename}/info | GET | 获取详情 |
| /api/inlay/upload | POST | 上传新结构 |

### 系统信息
| 接口 | 方法 | 说明 |
|------|------|------|
| /api/system/info | GET | 系统信息（GPU等） |
| /api/system/health | GET | 健康检查 |

## 目录结构说明

```
3d_aigc_project/
├── frontend/                # Vue前端
│   ├── src/                 # 源代码
│   ├── Dockerfile           # 前端Docker
│   └── nginx.conf           # Nginx配置
├── business-service/        # Java业务服务
│   ├── src/                 # 源代码
│   ├── pom.xml              # Maven配置
│   └── Dockerfile           # 后端Docker
├── ai-service/              # Python AI推理服务
│   ├── app/                 # 源代码
│   ├── requirements.txt     # Python依赖
│   └── Dockerfile           # AI服务Docker
├── models/                  # 模型文件（离线部署）
├── outputs/                 # 生成结果输出
├── uploads/                 # 上传文件
├── scripts/                 # 工具脚本
│   ├── download-models.py   # 模型下载
│   ├── check-hardware.py    # 硬件检测
│   └── init-env.bat         # 环境初始化
├── docs/                    # 文档
├── docker-compose.yml       # 开发环境编排
├── docker-compose.prod.yml  # 生产环境编排
└── .env.example             # 环境变量模板
```

## 常见问题

### Q: GPU显存不足怎么办？
A: 系统会自动检测显存并选择合适的模型版本。8GB显存使用mini版本即可。

### Q: 如何切换模型版本？
A: 在.env文件中设置 MODEL_VERSION=mini/standard/turbo，或设置为auto自动选择。

### Q: 离线环境如何部署？
A: 提前下载模型文件到models/目录，设置OFFLINE_MODE=true即可。

### Q: 如何添加新的镶嵌结构？
A: 将.jcd/.obj/.glb/.stl文件放入镶嵌结构数据库目录，系统会自动识别。

## 技术支持

- 项目文档: 3d_aigc_project/docs/
- Hunyuan3D官方: https://github.com/Tencent/Hunyuan3D-2
- 腾讯混元3D API: https://cloud.tencent.com/document/product/1804
