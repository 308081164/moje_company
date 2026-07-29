# 镶嵌结构数据库 v2 实施文档

> 对应设计文档：`docs/inlay-database-redesign.md`  
> 实施日期：2026-07-01

---

## 1. 各 Phase 完成情况

### Phase 0 基线 ✅

| 项 | 状态 | 说明 |
|----|------|------|
| `primary_only` API 过滤 | ✅ | `GET /api/inlay/list?primary_only=true` 隐藏 JCD 伴生 OBJ 重复项 |
| 主记录标记 | ✅ | 扫描时计算 `primaryRecord`，JCD 优先 |
| v1 索引可配置下线 | ✅ | `inlay-v2.v1-index-enabled=false` |

### Phase 1 MVP ✅

| 项 | 状态 | 说明 |
|----|------|------|
| PostgreSQL / SQLite 元数据 | ✅ | Flyway `V1__inlay_catalog_schema.sql`；默认 SQLite 本地文件 |
| MinIO / 本地存储降级 | ✅ | `inlay-v2.storage.mode=local\|minio` |
| 迁移脚本 | ✅ | `scripts/migrate_inlay_to_db.py` + `POST /api/inlay/v2/import/scan-legacy` |
| v2 REST API | ✅ | `InlayV2Controller` 列表/详情/缩略图/mesh |
| InlaySelector 切 v2 | ✅ | `getInlayListUnified()` 优先 v2，失败回退 v1 |
| LegacyPathResolver | ✅ | `GenerateService` 融合链路兼容 legacy_path / UUID |

### Phase 2 完整版 ✅

| 项 | 状态 | 说明 |
|----|------|------|
| InlayLibraryView 独立页 | ✅ | 路由 `/inlay-library` |
| 虚拟列表 + 筛选 + 标签 | ✅ | 滚动窗口虚拟化 + 分类树/标签多选 |
| Three.js 3D 预览 | ✅ | `InlayPreviewPanel` + GLB→OBJ 降级 |
| 批量整理 / 元数据编辑 | ✅ | PATCH、batch、move API + 抽屉编辑 |
| Python Worker | ✅ | `scripts/inlay_worker.py` 轮询 v2 任务队列 |

### Phase 3 生产优化 ✅（含降级）

| 项 | 状态 | 说明 |
|----|------|------|
| Redis 任务队列 | ✅ | `inlay-v2.queue.type=redis`；默认 memory |
| CDN/缓存头 | ✅ | 缩略图 `Cache-Control: immutable, max-age=86400` |
| Draco GLB | ⚠️ 部分 | 优先 serve GLB；无 GLB 自动降级 OBJ；Draco 压缩需离线 gltf-pipeline |
| v1 内存索引下线 | ✅ | 配置项 + `@Deprecated` 标记 v1 Controller |

---

## 2. 启动步骤

### 2.1 本地开发（SQLite + 本地存储，零依赖）

```powershell
cd D:\Hui_Loading\moje_company\3d_aigc_project

# 1. 业务服务（自动创建 ./data/inlay-catalog.db）
cd business-service
# mvn spring-boot:run   或 IDE 启动 Jewelry3dApplication

# 2. 导入 legacy 数据（首次，约 7200 条 JCD 逻辑记录）
curl -X POST "http://localhost:8854/api/inlay/v2/import/scan-legacy"

# 3. 前端
cd ..\frontend
npm run dev
# 访问 http://localhost:8853/inlay-library
```

### 2.2 Docker Compose（PostgreSQL + MinIO + Redis 可选）

```powershell
cd D:\Hui_Loading\moje_company\3d_aigc_project
# 基础设施（profile full）；AI 仍走主 compose 强制 GPU
docker compose --profile full up -d postgres minio redis
# 配置 business-service 使用 PostgreSQL（见下方配置）
docker compose --profile full up -d business-service frontend
# Agent 重启 ai-service：docker compose up -d --build ai-service（主文件已含 GPU）
```

导入：`python scripts/migrate_inlay_to_db.py --phase upload --api http://localhost:8854`

Worker：`python scripts/inlay_worker.py --loop --api http://localhost:8854`

---

## 3. 配置说明

### business-service `application.yml`

```yaml
inlay-v2:
  enabled: true
  legacy-fallback: true      # 融合链路回退旧目录
  v1-index-enabled: true     # false = 下线 v1 内存索引
  storage:
    mode: local                # local | minio
    local-root: uploads/inlay-storage
    endpoint: http://localhost:9000
  queue:
    type: memory               # memory | redis

spring:
  datasource:
    url: jdbc:sqlite:./data/inlay-catalog.db   # 或 jdbc:postgresql://...
```

### PostgreSQL 切换示例

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/jewelry3d
    username: jewelry
    password: jewelry
  jpa:
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
```

### MinIO 切换

```yaml
inlay-v2:
  storage:
    mode: minio
    endpoint: http://localhost:9000
    access-key: minioadmin
    secret-key: minioadmin
```

### Redis 队列

```yaml
inlay-v2:
  queue:
    type: redis
spring:
  autoconfigure:
    exclude: []   # 移除 RedisAutoConfiguration 排除
  data:
    redis:
      host: localhost
      port: 6379
```

---

## 4. API 列表（v2）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/inlay/v2/items` | 分页搜索列表 |
| GET | `/api/inlay/v2/items/{id}` | 详情 |
| GET | `/api/inlay/v2/items/by-legacy-path?path=` | legacy 兼容 |
| GET | `/api/inlay/v2/items/{id}/thumbnail` | 缩略图流 |
| GET | `/api/inlay/v2/items/{id}/mesh` | OBJ/STL mesh |
| GET | `/api/inlay/v2/items/{id}/mesh/glb` | GLB 优先 |
| PATCH | `/api/inlay/v2/items/{id}` | 编辑元数据 |
| POST | `/api/inlay/v2/items/batch` | 批量打标签/改分类 |
| POST | `/api/inlay/v2/items/{id}/move` | 逻辑移动分类 |
| POST | `/api/inlay/v2/items/{id}/regenerate-preview` | 预览任务入队 |
| POST | `/api/inlay/v2/items/{id}/convert-mesh` | mesh 任务入队 |
| GET | `/api/inlay/v2/categories` | 分类树 |
| POST | `/api/inlay/v2/categories` | 新建分类 |
| GET | `/api/inlay/v2/tags` | 标签列表 |
| POST | `/api/inlay/v2/tags` | 新建标签 |
| GET | `/api/inlay/v2/stats` | 统计 |
| GET | `/api/inlay/v2/jobs` | 任务列表 |
| POST | `/api/inlay/v2/jobs/claim` | Worker 领取任务 |
| POST | `/api/inlay/v2/jobs/{id}/complete` | Worker 完成任务 |
| POST | `/api/inlay/v2/import/scan-legacy` | 从 legacy 目录导入 |
| GET | `/api/inlay/v2/config` | 运行时配置 |

v1 仍可用：`/api/inlay/list?primary_only=true`（建议逐步迁移）

---

## 5. 关键文件路径

### 后端
- `business-service/src/main/java/com/moje/jewelry3d/inlay/` — v2 模块（entity/repository/service/controller/dto）
- `business-service/src/main/resources/db/migration/V1__inlay_catalog_schema.sql`
- `business-service/src/main/resources/application.yml`
- `business-service/src/main/java/com/moje/jewelry3d/inlay/service/LegacyPathResolver.java`

### 前端
- `frontend/src/views/InlayLibraryView.vue` — 镶嵌库管理页
- `frontend/src/components/InlayPreviewPanel.vue` — 3D 预览面板
- `frontend/src/components/InlaySelector.vue` — 生成页选择器（v2 优先）
- `frontend/src/api/index.ts` — v2 API 封装

### 脚本
- `scripts/migrate_inlay_to_db.py` — 迁移编排
- `scripts/inlay_worker.py` — 预览/mesh Worker

### 基础设施
- `docker-compose.yml` — postgres / minio / redis 服务

---

## 6. 访问入口

| 入口 | URL |
|------|-----|
| 镶嵌库管理页 | http://localhost:8853/inlay-library |
| 生成页嵌入选择器 | http://localhost:8853/ （HomeView） |
| v2 API 基址 | http://localhost:8854/api/inlay/v2 |

---

## 7. 已知限制与后续建议

1. **首次导入耗时**：7200+ 条记录导入需数分钟；大库建议 `--dry-run` 先统计。
2. **SQLite 中文 FTS**：MVP 使用 LIKE 模糊搜索；生产 PostgreSQL 可接 pg_trgm / pg_jieba。
3. **Draco GLB**：当前 serve 原始 GLB/OBJ；离线 gltf-pipeline 压缩可作为批处理 Worker 扩展。
4. **MinIO 大文件上传**：本地 `mode=local` 时对象复制到 `uploads/inlay-storage/`，legacy 文件仍可从原目录读取。
5. **重复 (1) 文件合并**：导入时 JCD 为主记录；`(1)` 副本可扩展 alias 表人工审核。
6. **Maven 编译**：本环境未检测到 `mvn` PATH，请在已安装 JDK17+Maven 的环境执行 `mvn compile` 验证。

---

## 8. 验收清单

- [ ] `POST /api/inlay/v2/import/scan-legacy` 返回 imported > 0
- [ ] `GET /api/inlay/v2/stats` total ≈ 7200（JCD 逻辑记录）
- [ ] `/inlay-library` 列表加载 < 2s（50 条）
- [ ] 生成页选择镶嵌后 `condition-generate` 融合成功（legacy_path）
- [ ] 3D 预览抽屉可加载 OBJ（GLB 不存在时自动降级）

---

## 9. 与 legacy 文件夹完全解耦（2026-07）

### 数据落点（删除「镶嵌结构数据库/」后仍可用）

| 类型 | 路径 |
|------|------|
| 元数据 | `business-service/data/inlay-catalog.db`（或 PostgreSQL） |
| JCD / mesh / 预览 | `uploads/inlay-storage/{bucket}/{inlayId}/...` |
| 融合缓存 | `uploads/inlay_cache/` |

### 一次性迁移（删除文件夹前必做）

```powershell
# business-service 运行中，且 legacy 文件夹仍在
python scripts/rehydrate_inlay_storage.py --api http://localhost:8854 --force
# 或
scripts\decouple_inlay_storage.bat
```

### 配置

- `inlay-v2.legacy-fallback: false`（默认）
- `inlay-v2.v1-index-enabled: false`（默认）
- Docker `business-service` 不再挂载 `镶嵌结构数据库/`（`inlay-storage` named volume 持久化）

### 新 API

- `POST /api/inlay/v2/import/rehydrate-storage` — 全量复制 legacy 资产到 storage
- `GET /api/inlay/v2/items/{id}/source-jcd` — Worker 下载源 JCD
- `PUT /api/inlay/v2/items/{id}/mesh` — Worker 上传 mesh

### 手动单条导入（2026-07）

- `POST /api/inlay/v2/items`（multipart）：`source`（必填）+ 可选 `preview`、`mesh`
- 镶嵌库页右上角 **「新增」** 按钮

```bash
curl -X POST http://localhost:8854/api/inlay/v2/items \
  -F "source=@example.jcd" \
  -F "preview=@example.png" \
  -F "display_name=示例镶口" \
  -F "tags=爪镶,测试"
```
