# API 参考

3D AIGC 平台 REST API 摘要。完整 OpenAPI：`http://localhost:8855/docs`（ai-service）或 business-service 代理层。

## 服务端口

| 服务 | 默认端口 | 说明 |
|------|----------|------|
| ai-service | 8855 | 推理与 mesh 处理（CLI 默认直连） |
| business-service | 8854 | 任务入库、文件上传、前端 API |

## 健康检查

```
GET /health
```

响应字段（节选）：

- `gpu_available` / `require_gpu` / `device`
- `queue_depth` — GPU 等待 + 后处理排队
- `gpu_job_running` — 是否有 GPU 推理进行中
- `active_tasks` / `queued_tasks`

## 生成

### 图片 → 3D

```
POST /api/generate/image-to-3d
Content-Type: application/json
```

主要字段：

| 字段 | 说明 |
|------|------|
| `task_id` | 可选，外部指定 |
| `image_path` | 单图绝对路径 |
| `multi_view` | 是否多视图 |
| `views` | `{front,back,left,right,top,bottom}` 路径字典，至少 2 个 |
| `generation_mode` | `fast` / `quality` / `custom` / `ultra`（封禁） |
| `enable_inlay_postprocess` | 默认 `false` |
| `custom_target_faces` | custom 模式面数 |
| `result_format` | `glb` / `stl` / `obj` 等 |

### 任务状态 / 结果 / 取消

```
GET  /api/generate/status/{task_id}
GET  /api/generate/result/{task_id}
POST /api/generate/cancel/{task_id}
```

## 调试流水线

### 基于任务的会话（兼容）

```
POST /api/debug/sessions
```

JSON：`source_task_id`, `raw_mesh_path`, `inlay_mesh_path`, …

business-service：`POST /api/debug/sessions?source_task_id=...`

### 独立会话（上传 mesh）

```
POST /api/debug/sessions/standalone
Content-Type: multipart/form-data
```

字段：`raw_mesh`, `inlay_mesh`, `enable_icp`, `enable_ai_part_split`, `output_format`

### 会话内逐步执行

```
POST /api/debug/sessions/{session_id}/steps/{step_id}/run
POST /api/debug/sessions/{session_id}/steps/{step_id}/confirm
GET  /api/debug/sessions/{session_id}/preview/{step_id}
```

### 直接单步（无 session 顺序）

```
POST /api/debug/steps/{step_id}/run
```

```json
{
  "raw_mesh_path": "/path/raw.obj",
  "inlay_mesh_path": "/path/inlay.glb",
  "context": {},
  "force": false
}
```

## 六视角键名

固定：`front` | `back` | `left` | `right` | `top` | `bottom`

与前端 `multiView.ts` 及 hy3dgen 水平四视角映射一致。
