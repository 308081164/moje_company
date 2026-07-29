# 镶嵌模型系统内裁剪可行性分析

**日期**: 2026-07-28（修订：分阶段方案与工作量估算）  
**范围**: `3d_aigc_project` 镶嵌库导入流程、网格处理能力、3D 预览与后处理管线  
**问题**: 员工上传完整建模文件后，用户需在 JewelCAD 等外部 CAD 中裁剪镶嵌结构、删除多余部件并导出，再经镶嵌库「+ 新增」导入；能否将预裁剪工作移入本系统？

**相关文档**

| 文档 | 关联 |
|------|------|
| [`docs/jcd-writer-self-development-analysis.md`](jcd-writer-self-development-analysis.md) | JCD 无公开 Writer；Reader 仅点云启发式；JCD 裁剪须先转 mesh |
| [`docs/inlay-3d-preview-analysis.md`](inlay-3d-preview-analysis.md) | JCD→mesh 精度与 2D/3D 预览割裂 |
| [`docs/inlay-database-redesign.md`](inlay-database-redesign.md) | 镶嵌库 mesh 版本化与 `mesh_ready` 语义 |

---

## 执行摘要

| 项 | 结论 |
|----|------|
| **MVP 上传格式** | **仅 OBJ / STL / GLB**（网格即 `mesh_ready`）；不在 MVP 内承诺 JCD 原生裁剪 |
| **MVP 能力** | 上传完整 mesh → 浏览器内交互裁剪（连通分量选取为主，剖切预览为辅）→ 保存回镶嵌库 |
| **Phase 2+** | **JCD 格式支持**：JCD 作源归档，裁剪前须 **JewelCAD 导出 OBJ** 或 **`convert_jcd_to_mesh.py` 点云重建**；无法在 JCD 参数层裁剪 |
| **技术可行性（MVP）** | **可行**：后端 `mesh_processor` 已有分量拆分/清洗；前端 `ModelViewer` 可扩展剖切与选中；布尔运算仅作高级选项 |
| **总体工作量** | MVP **6–10 人周（约 1.5–2.5 人月）**；Phase 2 JCD 接入 **4–8 人周**；完整交互编辑器 **+8–12 人周** |

---

## 分阶段实施计划

### Phase MVP：网格格式系统内裁剪（OBJ / STL / GLB）

**产品边界**

- 镶嵌库「+ 新增」**仅接受** `.obj`、`.stl`、`.glb` 作为源文件（与预览图可选上传）。
- **不包含** JCD 上传、JCD→mesh Worker、双文件（JCD + sidecar mesh）流程——这些归入 Phase 2+。
- 用户工作流：

```mermaid
flowchart LR
  A[员工发送完整 OBJ/STL/GLB] --> B[镶嵌库 + 新增 上传]
  B --> C[自动 sanitize_mesh]
  C --> D[浏览器 3D 预览 + 裁剪 UI]
  D --> E[勾选保留分量 / 可选剖切]
  E --> F[保存 → PUT mesh]
  F --> G[mesh_ready=true 可用于 AI 融合]
```

**MVP 功能清单**

| 能力 | 优先级 | 说明 |
|------|--------|------|
| 导入后自动 `sanitize_mesh` | P0 | 去 junk、选主装配；覆盖 JewelCAD 多视图副本场景 |
| 连通分量列表 + 勾选保留/删除 | P0 | 无需 Raycaster 即可交付核心价值 |
| 3D 预览确认（`ModelViewer`） | P0 | 只读预览 + 高亮选中分量 |
| 保存裁剪结果回镶嵌库 | P0 | `PUT /api/inlay/v2/items/{id}/mesh` |
| Three.js 剖切平面预览 | P1 | `renderer.clippingPlanes`；配合后端 `clip-plane` API |
| 撤销 / 对比原 mesh | P2 | 本地编辑栈，保存前 diff 预览 |

**MVP 明确不做**

- JCD 源文件上传与转换
- JCD 参数化编辑、CAD 级布尔
- Mesh → JCD 回写（见 [`jcd-writer-self-development-analysis.md`](jcd-writer-self-development-analysis.md)）
- 替代 JewelCAD 的精确镶口修边

**与现有代码差距**

当前 `InlayLibraryView.vue` 仍接受 `.jcd`（`accept=".jcd,.obj,.glb,.stl"`）；MVP 产品化需 **前端 accept 与后端 `SOURCE_EXTS` 临时收窄为 mesh 三格式**，或增加「MVP 模式」开关。后端 `InlayItemCreateService` 已支持 OBJ/GLB/STL 双写 source + mesh。

---

### Phase 2+：JCD 格式支持

**业务动机**

镶嵌结构库约 **7,199** 条 JCD 逻辑记录（见 `inlay-database-redesign.md`）；员工习惯发送 `.jcd` 完整源文件。Phase 2+ 恢复/增强 JCD 入库，并与系统内裁剪串联。

**JCD 裁剪可行路径（无第三条）**

| 路径 | 流程 | 精度 | 依赖 |
|------|------|------|------|
| **A. JewelCAD 导出（推荐）** | JCD → 用户在 CAD 导出完整 OBJ → 系统内 mesh 裁剪 | 高 | 用户/员工有 JewelCAD |
| **B. 启发式 JCD→mesh** | JCD → `convert_jcd_to_mesh.py`（点云 Poisson）→ 系统内裁剪 | 中–低 | Worker / 「转换 Mesh」按钮 |
| **C. JCD 内裁剪** | — | **不可行** | 无公开 SDK，无参数解析 |

**Phase 2+ 功能清单**

| 能力 | 说明 |
|------|------|
| 恢复 JCD 源上传 + 可选 sidecar mesh | 复用现有 `InlayItemCreateService`、Worker |
| JCD 转 mesh 后进入裁剪向导 | `POST .../convert-mesh` → 跳转 MeshEditor |
| 转换失败引导 | 提示「请在 JewelCAD 导出 OBJ 后重试」 |
| 导入时自动 sanitize | JCD→mesh 成功后立即 `sanitize_mesh`，与 MVP 参数一致 |
| 外部导出 SOP 文档 | 统一 JewelCAD 导出设置，减少重建误差 |

**JCD 约束（来自既有调研）**

- `convert_jcd_to_mesh.py`：float32 点云扫描 → Open3D Poisson；**非 CAD 几何**；历史批次成功率约 **54%**（见 [`jcd-writer-self-development-analysis.md`](jcd-writer-self-development-analysis.md) §2.4）。
- 无开源 JCD Writer；Reader 不解析 chunk/对象树/布尔树。
- 2D 预览来自内嵌 BMP，与 3D mesh 数据源割裂（`inlay-3d-preview-analysis.md`）。

**Phase 2+ 推荐默认路径**

```
JCD 上传 → Worker convert_jcd_to_mesh（allow_proxy=false）
    → 成功：进入 MVP 裁剪 UI（同 OBJ 流程）
    → 失败：提示 JewelCAD 导出 OBJ → 再走 MVP 流程
```

---

### Phase 3（可选）：完整 MeshEditor 与高级裁剪

- Three.js `Raycaster` 点选 + 框选
- 多剖切平面 + 后端封盖
- 布尔差集（大区域挖除）；**珠宝薄壁结构成功率低**，仅高级用户
- 从 `MeshConvertView` 增加「裁剪并加入镶嵌库」入口
- 大模型 LOD：编辑用 decimated 副本，保存用全精度

---

## 背景与痛点

### 典型工作流（现状）

```mermaid
flowchart LR
  A[员工发送完整 JCD/建模文件] --> B[用户在 JewelCAD 打开]
  B --> C[裁剪出镶嵌结构]
  C --> D[删除无关部件]
  D --> E[导出 OBJ/GLB/STL]
  E --> F[镶嵌库 + 新增 上传]
  F --> G[系统用于 AI 融合生成]
```

**MVP 目标**：将步骤 B–E 中 **「导出后网格整理」** 移入系统；**不消除** 步骤 B–C 中对 CAD 的依赖（Phase 2+ JCD 仍可能需要 CAD 导出）。

### 用户痛点

| 环节 | 问题 |
|------|------|
| 工具切换 | 必须在 JewelCAD（或同类 CAD）与本系统之间来回操作 |
| 重复劳动 | 每个新镶嵌结构都要手动裁剪、命名、导出 |
| 格式认知 | 需理解「源文件 JCD + 可选 mesh」与「直接上传网格即 mesh_ready」两套逻辑 |
| 质量不确定 | 裁剪/export 参数不一致会导致融合对齐失败或 3D 预览与 2D 缩略图不一致 |

### 业务期望

在镶嵌库导入环节或导入后，于系统内完成「从完整模型提取可用镶嵌网格」的操作，减少对外部 CAD 的依赖。

---

## 当前系统能力盘点

### 1. 镶嵌库上传与存储

**前端** — `frontend/src/views/InlayLibraryView.vue`

- 「+ 新增」对话框当前接受：
  - **源文件（必填）**: `.jcd`、`.obj`、`.glb`、`.stl`（**MVP 产品化后收窄为后三者**）
  - **预览图（可选）**: `.png`、`.jpg`、`.jpeg`、`.webp`、`.bmp`
  - **Mesh 文件（JCD 时可选，Phase 2+）**: `.obj`、`.glb`、`.stl`
- 提交调用 `createInlayV2Item()` → `POST /api/inlay/v2/items`（multipart）。

**后端** — `business-service/.../inlay/service/InlayItemCreateService.java`

```java
private static final Set<String> SOURCE_EXTS = Set.of(".jcd", ".obj", ".glb", ".stl");
private static final Set<String> MESH_EXTS = Set.of(".obj", ".glb", ".stl");
```

| 上传组合 | 行为 | MVP / Phase 2+ |
|----------|------|----------------|
| OBJ/GLB/STL 作为源 | 同时写入 source + mesh，`mesh_ready=true` | **MVP 主路径** |
| JCD + 附带 mesh | JCD 存 source，mesh 存 mesh bucket | Phase 2+ |
| 仅 JCD | `mesh_ready=false`，需 Worker 转换 | Phase 2+ |

**Mesh 更新 API** — `InlayV2Controller.uploadMesh()`  
`PUT /api/inlay/v2/items/{id}/mesh`：裁剪保存的目标端点。

### 2. JCD → Mesh 转换链路（Phase 2+）

**脚本** — `scripts/convert_jcd_to_mesh.py`

1. JCD 二进制 float32 点云 → Open3D Poisson 重建
2. `--allow-proxy` 四爪占位（生产 `allow_proxy=false`）
3. 失败则跳过

**Worker** — `scripts/inlay_worker.py`：`job_type=mesh`，拒绝 proxy。

**限制**：点云重建 ≠ JewelCAD 参数几何；复杂镶口可能与 CAD 导出偏差大。

### 3. 网格格式转换（无编辑）

**页面** — `frontend/src/views/MeshConvertView.vue`：OBJ/GLB/STL 互转，无裁剪。

**API** — `ai-service` `POST /api/mesh/convert` → `mesh_processor.convert_format()`。

### 4. 3D 预览（只读，MVP 扩展基座）

**组件** — `frontend/src/components/ModelViewer.vue`

已实现：Three.js + OrbitControls、GLTF/OBJ/STL 加载、分色预览、自适应相机。

**未实现（MVP 需新增）**：

| 能力 | Three.js / 后端 | MVP 用途 |
|------|-----------------|----------|
| `Raycaster` 点选 | Three.js | Phase 3 |
| `renderer.clippingPlanes` | Three.js | Phase MVP P1 剖切预览 |
| 分量高亮 | 顶点色 / face index | MVP P0 配合分量列表 |
| 编辑/导出交互 | 新 `MeshEditor` | MVP P0 |

### 5. 2D 预处理编辑器（与 3D 无关）

**组件** — `frontend/src/components/PreprocessEditor.vue`：设计图 matting/SAM，**不含 3D 网格编辑**。

### 6. 后端网格处理（ai-service）

**核心** — `ai-service/app/services/mesh_processor.py`（trimesh + open3d + pymeshfix）

| 能力 | 方法 | MVP 裁剪可复用 |
|------|------|----------------|
| 连通分量拆分 | `_split_components()` | **是** |
| 垃圾分量过滤 | `_filter_junk_components()` | **是** |
| 主装配体选择 | `_select_primary_assembly()` | **是** |
| 网格清洗 | `sanitize_mesh()` | **是（P0）** |
| 平面 half-space 裁面 | 需新增 | P1 |
| 布尔差/并 | `boolean_difference` / `boolean_union` | Phase 3 高级 |
| AI 重叠裁剪 | `crop_overlapping_ai_body()` | 否（融合用，非 inlay 预裁） |

**重要区分**：`crop_overlapping_ai_body` 裁的是 **AI 生成体**，不是用户从完整 CAD 提取镶嵌结构。

### 7. 连通分量自动选择（最接近「自动裁剪」的现有逻辑）

`sanitize_mesh(select_primary=True)` 在 **AI 生成融合管线** 内对 inlay 执行，**镶嵌库导入时不运行**——MVP 首要接入点。

---

## 技术可行性分析

### MVP 可行性结论：**可行（网格级，中等工程量）**

MVP 不追求 CAD 语义，仅做 **三角网格级** 整理与分量选取，与现有 `mesh_processor` 能力高度重合；前端在 `ModelViewer` 上增量开发，无需新 3D 引擎。

#### 1. 后端网格裁剪（trimesh）

| 操作 | 实现 | 现有基础 | MVP |
|------|------|----------|-----|
| 删除连通分量 | `split()` → 保留 indices → `concatenate` | `_split_components` | P0 |
| 自动清洗 | `sanitize_mesh()` | 直接复用 | P0 |
| 平面剖切 | half-space 删面 + 封盖 | 参考 `crop_overlapping_ai_body` | P1 |
| 导出子网格 | `trimesh.export()` | 已有 | P0 |

**风险**：非流形 mesh 布尔易失败；MVP **避免布尔**，用手动删 component + 可选平面剖切。

**建议 API**（ai-service 新 router `/api/mesh/edit`）：

- `POST /split-components` → 返回分量列表（面数、bbox）
- `POST /merge-components`（`keep_indices`）
- `POST /sanitize`（导入触发）
- `POST /clip-plane`（P1）
- 结果由 business-service `PUT .../mesh` 回写

#### 2. 前端交互（Three.js + ModelViewer）

| 交互 | 技术 | 复杂度 | 阶段 |
|------|------|--------|------|
| 分量列表勾选 | 后端 split + 前端列表 UI | 低 | MVP P0 |
| 3D 高亮选中分量 | 顶点色或 overlay mesh | 中 | MVP P0 |
| 剖切预览 | `material.clippingPlanes` + 滑块 | 低–中 | MVP P1 |
| 点选连通体 | Raycaster + component id | 中 | Phase 3 |
| 框选 | SelectionBox | 中 | Phase 3 |

**性能**：完整戒指 OBJ 面数高时，预览用 decimated GLB，保存用全精度原文件。

#### 3. 布尔运算（非 MVP 主路径）

`boolean_union` / `boolean_difference`（manifold / blender）已在融合管线使用；对用户预裁剪 **成功率低于 CAD**，仅 Phase 3 高级功能。

#### 4. MVP 与融合管线对齐

导入裁剪后的 mesh 应使用与 `process_generated_mesh()` **相同的 `sanitize` 参数**，避免「库内看起来对、融合时又被洗一遍」的意外。

---

### Phase 2+ JCD 可行性结论：**部分可行（须先 mesh 化）**

| 问题 | 结论 |
|------|------|
| 能否在 JCD 二进制内裁剪？ | **否** — 无 chunk 解析、无参数编辑 API |
| 能否 JCD→mesh 后走 MVP 裁剪？ | **是** — 约 54% 自动转换成功；失败走 JewelCAD 导出 |
| 能否替代 JewelCAD 导出？ | **否** — Poisson 重建精度不足，小文件常失败 |
| 能否自研 JCD Reader 提升精度？ | **长期、高成本** — 无公开规范；ROI 低于「导出 OBJ + MVP 裁剪」（见 [`jcd-writer-self-development-analysis.md`](jcd-writer-self-development-analysis.md)） |

**现实工作流（Phase 2+）**

1. **首选**：JewelCAD 打开 JCD → 导出 OBJ → MVP 裁剪（精度最高）
2. **批量/无 CAD**：JCD → Worker → mesh → MVP 裁剪（接受失败率与几何误差）
3. **不可行**：期望用户上传 JCD 后在系统内「像 CAD 一样」删对象树

---

### 外部 CAD vs 系统内裁剪（MVP 定位）

| 维度 | JewelCAD | MVP 系统内 | 差距 |
|------|----------|------------|------|
| 语义理解 | 镶口、爪、戒圈 | 连通分量、包围盒 | 大 |
| 裁剪方式 | 参数化布尔、对象树 | 分量勾选 + 可选剖切 | 中 |
| 多视图副本 | 手动删 | `sanitize_mesh` 自动 | **MVP 可覆盖** |
| 垃圾碎片 | 手动删 | `_filter_junk_components` | **MVP 可覆盖** |
| 精确镶口修边 | 保真 | 难以近似 | 仍须 CAD |
| JCD 原生 | 直接编辑 | Phase 2+ 仅归档 + 转 mesh | 大 |

**产品表述建议**：「系统内网格整理与分量选取」，**不**承诺「完全替代 JewelCAD 裁剪」。

---

## 工作量估算

估算假设：**1 名全栈或 1 前端 + 0.5 后端**；含联调与基础测试；不含 JewelCAD 商务授权与大规模 UAT。

### Phase MVP（OBJ / STL / GLB 系统内裁剪）

| 工作包 | 内容 | 人周 |
|--------|------|------|
| W1 后端 Mesh Edit API | split / merge / sanitize；business 导入钩子 | 2–3 |
| W2 前端裁剪 UI | 分量列表、高亮、`InlayPreviewPanel` 入口、保存 | 2–3 |
| W3 导入流程 | MVP 格式限制、上传后自动 sanitize、失败提示 | 1 |
| W4 联调与测试 | 典型 OBJ 样例、融合管线回归 | 1–2 |
| W5 剖切预览（P1，可拆 sprint 2） | clippingPlanes + clip-plane API | 1–2 |
| **MVP 合计** | P0 不含 W5：**6–9 人周（约 1.5–2.25 人月）** | |
| **MVP + 剖切 P1** | **7–11 人周（约 1.75–2.75 人月）** | |

### Phase 2+（JCD 接入裁剪链）

| 工作包 | 内容 | 人周 |
|--------|------|------|
| J1 恢复 JCD 上传与 convert 向导 | 转 mesh 后进 MeshEditor；失败引导 | 2–3 |
| J2 Worker / 异步任务 UX | 轮询 `mesh_ready`、进度与重试 | 1–2 |
| J3 文档与 SOP | JewelCAD 导出规范、与 2D BMP 预览说明 | 0.5–1 |
| J4 convert 成功率改进（可选） | 点云启发式调参；**非**重写 JCD 解析 | 2–4 |
| **Phase 2+ 合计（不含 J4）** | **3.5–6 人周（约 0.9–1.5 人月）** | |
| **Phase 2+ 含 J4 优化** | **5.5–10 人周（约 1.4–2.5 人月）** | |

### Phase 3（完整 MeshEditor，可选）

| 工作包 | 人周 |
|--------|------|
| Raycaster 点选、框选、撤销栈 | 3–4 |
| 多剖切平面 + 封盖 | 2–3 |
| 布尔挖除高级模式 + 失败 fallback | 2–3 |
| MeshConvertView → 镶嵌库入口 | 1–2 |
| **Phase 3 合计** | **8–12 人周（约 2–3 人月）** |

### 总体路线图与时间线

| 阶段 | 交付物 | 累计人月（约） | 日历时间（1 FTE） |
|------|--------|----------------|-------------------|
| **MVP** | OBJ/STL/GLB 上传 + 分量裁剪 + 回写 | 1.5–2.75 | 6–11 周 |
| **Phase 2+** | JCD→mesh→裁剪链 + SOP | +0.9–2.5 | +4–10 周 |
| **Phase 3** | 完整交互编辑器 | +2–3 | +8–12 周 |
| **端到端（MVP→2+→3）** | — | **4.4–8.25 人月** | **约 4–8 个月** |

**对比**：自研 JCD Writer Tier A 约 **8–14 人月**（[`jcd-writer-self-development-analysis.md`](jcd-writer-self-development-analysis.md)）；**MVP 网格裁剪 ROI 显著更高**。

---

## 风险与限制

| 风险 | 说明 | 缓解 |
|------|------|------|
| MVP 格式收窄 | 现有 UI/后端仍接受 JCD | 产品开关 + 文案；Phase 2+ 再开放 |
| JCD 非参数化 | 点云重建 ≠ CAD | Phase 2+ 主推 JewelCAD 导出 OBJ |
| 布尔失败 | 非流形 mesh | MVP 避免布尔；用手动删 component |
| 单连通体多余几何 | sanitize 无法分离同 shell 内面 | P1 剖切或 CAD 预分割 |
| 大文件性能 | 百万面级 OBJ | 预览 decimate，保存全精度 |
| 2D/3D 不一致 | BMP vs mesh | 裁剪后触发预览 regeneration |
| GPU | ai-service 网格处理在 CPU | 与 AGENTS.md GPU 要求无冲突 |

---

## 结论与建议

1. **MVP 可行且应优先**：限定 **OBJ / STL / GLB**，复用 `sanitize_mesh` + 连通分量 UI + `PUT mesh`，**6–11 人周**可交付核心价值。  
2. **Phase 2+ JCD**：恢复 JCD 入库，裁剪前 **必须 mesh 化**（JewelCAD 导出或 `convert_jcd_to_mesh.py`）；**无法在 JCD 层裁剪**。  
3. **Three.js 剖切** 为 P1 增强；**trimesh 布尔** 仅 Phase 3 高级选项。  
4. **无法替代 CAD**：精确镶口、同零件内局部删除、JCD 参数修改——仍须 JewelCAD。  
5. **与 JCD Writer 分工**：裁剪 MVP 与 Writer **独立**；Writer 仅在有「无 CAD 归档 JCD」硬需求时另立项。

### 关键代码索引

| 主题 | 路径 |
|------|------|
| 镶嵌库上传 UI | `frontend/src/views/InlayLibraryView.vue` |
| 镶嵌 3D 预览 | `frontend/src/components/InlayPreviewPanel.vue` |
| 只读 3D viewer | `frontend/src/components/ModelViewer.vue` |
| 格式转换页 | `frontend/src/views/MeshConvertView.vue` |
| 2D 预处理（非 3D） | `frontend/src/components/PreprocessEditor.vue` |
| 镶嵌条目创建 | `business-service/.../InlayItemCreateService.java` |
| Mesh 回写 API | `InlayV2Controller.uploadMesh()` |
| JCD→Mesh | `scripts/convert_jcd_to_mesh.py`, `scripts/inlay_worker.py` |
| JCD Writer 调研 | `docs/jcd-writer-self-development-analysis.md` |
| 网格处理核心 | `ai-service/app/services/mesh_processor.py` |
| 融合管线 | `mesh_processor.process_generated_mesh()` |
| 格式转换 API | `ai-service/app/routers/mesh.py` |

---

## JewelCAD 操作 SOP（Phase 2 JCD 链）

当用户上传 `.jcd` 且系统内 Poisson 重建失败或质量不佳时，请按以下步骤操作：

1. 在 JewelCAD 中打开原始 JCD，确认镶口与爪镶几何完整。
2. **文件 → 导出 → OBJ**（推荐）或 STL；单位与坐标系保持默认，勿缩放。
3. 在镶嵌库「+ 新增」中：
   - **方案 A**：直接上传导出的 OBJ/GLB/STL（MVP 推荐，导入后自动 `sanitize_mesh`）。
   - **方案 B**：上传 JCD 源文件归档，并可选附带 sidecar mesh；或上传 JCD 后点击「转换 Mesh」等待 Worker 完成。
4. 导入成功后点击 **「进入网格裁剪」**：
   - 勾选需保留的连通分量（如 setting / 主石爪镶）。
   - 可选启用剖切平面预览并应用。
   - 点击 **「保存到镶嵌库」**。
5. 确认条目标签 `mesh_ready=true` 且非 proxy 后，即可在生成页用于 AI 融合。

**失败引导文案**（前端已实现）：「此 JCD 无法从点云重建 3D 网格，请使用 JewelCAD 导出 OBJ 或点击「转换 Mesh」重试。」

**回归测试**：`python scripts/e2e_test_mesh_crop.py --mesh path/to/sample.obj`

---

*本文档基于 2026-07-28 仓库代码梳理；MVP 格式边界与 Phase 2+ JCD 策略随产品决策同步更新。*
