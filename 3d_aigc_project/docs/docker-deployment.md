# Docker 一键部署指南

> 项目根目录：`3d_aigc_project`  
> 更新日期：2026-07-22

## 一行启动

**默认强制 GPU**：`docker-compose.yml` 已内置 NVIDIA device reservation、CUDA PyTorch 构建参数与 `REQUIRE_GPU=1`。  
裸跑 `docker compose up` 也会分配 GPU（需 [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)）。  
`docker-compose.gpu.yml` 现为冗余兼容叠加，可有可无。详见根目录 `AGENTS.md`（Agent 重启必读）。

```powershell
# Windows（推荐：启动后校验 gpu_available）
cd D:\Hui_Loading\moje_company\3d_aigc_project
start.bat

# Linux / macOS
./start.sh

# 裸跑亦可（主文件已含 GPU）
docker compose up -d --build
```

紧急 CPU（极慢，仅无 GPU/Toolkit 时；脚本会强烈警告）：

```powershell
start.bat --cpu
# 或
docker compose -f docker-compose.yml -f docker-compose.cpu.yml up -d --build
```

> 若缺 NVIDIA Toolkit，默认 GPU 启动会失败；仅应急才用 `start.bat --cpu`。`REQUIRE_GPU=1` 时 ai-service 不会静默落到 CPU。

完整栈（PostgreSQL + MinIO + Redis）：

```powershell
start.bat --full
# 或
docker compose --profile full up -d --build
# 需在 .env 中设置 SPRING_PROFILES_ACTIVE=docker,docker-full
```

Vite 热更新开发前端：

```powershell
start.bat --dev
# 无 GPU 时：
start.bat --dev --cpu
```

停止：

```powershell
stop.bat
# 或
docker compose down
```

---

## 架构与端口

| 服务 | 容器名 | 宿主机端口 | 说明 |
|------|--------|-----------|------|
| frontend | 3d-aigc-frontend | 8853 | Nginx 生产构建（默认）或 Vite dev |
| business-service | 3d-aigc-business-service | 8854 | Spring Boot 业务 API |
| ai-service | 3d-aigc-ai-service | 8855 | FastAPI 3D 推理 |
| postgres | 3d-aigc-postgres | 5432 | profile `full` |
| minio | 3d-aigc-minio | 9000 / 9001 | profile `full`，控制台 9001 |
| redis | 3d-aigc-redis | 6379 | profile `full` |

访问地址：

- 前端 UI：<http://localhost:8853>
- 业务健康检查：<http://localhost:8854/api/system/health>
- AI Swagger：<http://localhost:8855/docs>

---

## 前置条件

1. **Docker Desktop 24+**（含 Compose V2）
2. **模型文件**：将 Hunyuan3D 等模型放到 `./models/`（见 `scripts/download-models.py`）
3. **镶嵌 legacy 目录**：`./镶嵌结构数据库/`（只读挂载，不打包进镜像）
4. **GPU（强制默认）**：安装 [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)。`start.bat` / 裸 `docker compose up` 均启用 GPU；紧急无 GPU 才用 `start.bat --cpu`

Windows 无 WSL2 时可先运行 `scripts/install-wsl-for-docker.bat`。

---

## 环境变量

复制模板：

```powershell
copy .env.example .env
```

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MODELS_PATH` | `./models` | 模型 bind mount（只读） |
| `INLAY_DB_PATH` | `./镶嵌结构数据库` | Legacy 镶嵌目录（只读） |
| `UPLOADS_PATH` | `./uploads` | 用户上传 |
| `OUTPUTS_PATH` | `./outputs` | 生成结果 |
| `SPRING_PROFILES_ACTIVE` | `docker` | 完整栈改为 `docker,docker-full` |
| `COMPOSE_PROFILES` | 空 | 完整栈设为 `full` |
| `MODEL_VERSION` | `auto` | AI 模型版本 |
| `REQUIRE_GPU` | `1` | 强制 GPU；CUDA 不可用则 ai-service 非零退出 |
| `OFFLINE_MODE` | `true` | 离线推理，不拉 HuggingFace |

---

## Volume 说明

### Bind Mount（宿主机目录）

| 宿主机路径 | 容器路径 | 服务 | 权限 |
|-----------|---------|------|------|
| `./models` | `/app/models` | ai-service | ro |
| `./镶嵌结构数据库` | `/app/inlay_db` | ai-service, business-service | ro |
| `./uploads` | `/app/uploads` | ai-service, business-service | rw |
| `./outputs` | `/app/outputs` | ai-service, business-service | rw |

### Named Volume（Docker 管理）

| Volume | 挂载点 | 用途 |
|--------|--------|------|
| `business-data` | `/app/data` | SQLite 元数据库（默认模式） |
| `inlay-storage` | `/app/inlay-storage` | v2 本地对象存储 |
| `inlay-cache` | `/app/inlay_cache` | 融合 mesh 缓存（business + ai 共享） |
| `pg-data` | PostgreSQL 数据 | profile `full` |
| `minio-data` | MinIO 对象 | profile `full` |

> SAM 等可选模型同样放在 `./models/` 下，通过 `MODELS_PATH` 挂载，**不要** COPY 进镜像。

---

## 首次启动：导入镶嵌库

容器就绪后（business-service 健康），执行 legacy 扫描导入：

```powershell
curl -X POST "http://localhost:8854/api/inlay/v2/import/scan-legacy"
```

或在 PowerShell：

```powershell
Invoke-WebRequest -Method POST -Uri "http://localhost:8854/api/inlay/v2/import/scan-legacy"
```

导入完成后访问：<http://localhost:8853/inlay-library>

完整栈（MinIO）还可运行离线 Worker：

```powershell
python scripts/inlay_worker.py --loop --api http://localhost:8854
```

---

## Compose Profile 对照

| 模式 | 命令 | 数据库 | 对象存储 | 加速 |
|------|------|--------|---------|------|
| 默认 (强制 GPU) | `start.bat` 或 `docker compose up` | SQLite (`business-data`) | 本地 (`inlay-storage`) | CUDA（需 Toolkit） |
| full | `start.bat --full` | PostgreSQL | MinIO | 同默认 GPU |
| dev | `start.bat --dev` | 同默认 | 同默认 | 同默认 GPU + Vite |
| cpu（紧急） | `start.bat --cpu` | 同默认 | 同默认 | CPU only（`docker-compose.cpu.yml`） |

Spring 配置对应：

- 默认：`application-docker.yml`（profile `docker`）
- 完整栈：额外 `application-docker-full.yml`（profile `docker-full`）

---

## 常用运维命令

```powershell
# 校验 compose 语法（主文件已含 GPU）
docker compose config

# 确认 DeviceRequests 非 null
docker compose config | findstr /i device

# 查看状态 / 日志
docker compose ps
docker compose logs -f ai-service

# 重建单个服务（Agent 重启请用此命令，勿去掉 GPU）
docker compose up -d --build ai-service

# 健康检查（应见 gpu_available=true, require_gpu=true, device=cuda）
curl http://localhost:8855/health

# 生产精简编排（同样强制 GPU）
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 健康检查与启动顺序

```
postgres/minio/redis (full, healthy)
        ↓
ai-service (healthy, 模型加载最多约 3 分钟)
        ↓
business-service (healthy)
        ↓
frontend
```

- business 等待 ai-service `service_healthy`
- postgres/minio/redis 使用 `required: false`，未启用 profile 时不阻塞启动
- ai-service `start_period: 180s` 适配模型冷加载

---

## 已知限制

1. **首次构建较慢**：ai-service 需安装 PyTorch 及 3D 依赖，约 10–20 分钟；business-service Maven 依赖下载视网络而定。
2. **强制 GPU 推理**：主 `docker-compose.yml` 已含 GPU + `REQUIRE_GPU=1`；CUDA 不可用时 ai-service **直接退出**，不会静默 CPU。紧急才用 `start.bat --cpu`（极慢）。Agent 见 `AGENTS.md`。
3. **模型需预下载**：`OFFLINE_MODE=true` 时若 `./models` 为空，AI 推理会失败；请先运行 `scripts/download-models.py`。
4. **镶嵌库需手动导入**：首次启动不会自动执行 `scan-legacy`，需按上文 curl 导入。
5. **Windows 路径**：`INLAY_DB_PATH` 含中文目录名时，确保 Docker Desktop 已共享该盘符。
6. **dev 模式**：Vite 容器内代理指向 `business-service:8854`，仅 `/api` 走代理，静态资源由 Vite 提供。

---

## 文件清单

| 文件 | 说明 |
|------|------|
| `docker-compose.yml` | 主编排（**已内置 GPU** + full profile） |
| `docker-compose.gpu.yml` | 冗余兼容叠加（与主文件 GPU 配置重复，无害） |
| `docker-compose.cpu.yml` | 紧急 CPU 覆盖（仅 `--cpu`） |
| `docker-compose.dev.yml` | Vite 开发覆盖 |
| `docker-compose.prod.yml` | 生产精简编排（同样强制 GPU） |
| `AGENTS.md` | Agent/自动化重启 GPU 约束 |
| `start.bat` / `start.sh` | 一键启动（默认校验 gpu_available） |
| `stop.bat` / `stop.sh` | 一键停止 |
| `.env.example` | 环境变量模板 |
| `*/Dockerfile` | 各服务多阶段镜像 |
| `business-service/.../application-docker*.yml` | 容器内 Spring 配置 |
