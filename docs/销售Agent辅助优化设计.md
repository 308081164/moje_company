# 销售 Agent 辅助优化设计

本文档对两项能力做可行性分析，并记录**已实现**能力与官方接口依据。技术栈：Spring Boot 后端 + React/Electron 前端；售前角色 `PRE_SALES`；新建订单见 `OrderCreatePage.tsx` 与 `OrderListPage` 弹窗。

---

## 1. 背景与目标

- **痛点一**：售前经理在「新建订单」表单中重复录入客户联系方式、需求描述、款式与材质等信息，耗时长且易错。
- **痛点二**：售前需在企微侧为客户建群以便后续跟进，依赖人工记忆，易出现漏建群、客户失联。
- **目标**：在可控成本与合规前提下，用「截图理解 + 可选自动建群」减轻售前负担，关键动作保留人工确认。

---

## 2. 功能一：上传聊天记录截图，识别并预填创建订单表单

### 2.1 可行性结论

**整体可行，建议分阶段上线：先做「识别 + 人工确认填单」，再视效果收紧自动化程度。**

| 维度 | 说明 |
|------|------|
| 技术成熟度 | 通义千问多模态（如 DashScope 视觉理解 / Qwen-VL 类能力）对聊天截图中的文字、昵称、需求摘要做抽取已较成熟；珠宝行业专有名词可通过 Prompt 与少样本示例缓解。 |
| 与现有产品契合度 | 当前创建订单字段已结构化（客户姓名、联系方式、微信、来源、定金、款式、材质、基础需求、下单时间等），适合映射为「模型输出 JSON → 表单 `setFieldsValue`」。 |
| 主要风险 | 截图可能含无关界面导致幻觉；隐私与敏感信息出境/留存策略；API 费用与限流；识别错误未复核即提交导致脏数据。 |

### 2.2 推荐技术路径

1. **前端**：在新建订单页（独立页 + 列表弹窗两处需保持一致体验）增加「上传聊天截图」入口；图片先走现有 OSS 或临时上传接口（需注意**是否将含客户隐私的截图长期存 OSS**，建议可配置「仅内存/临时 URL 供识别」或短生命周期存储）。
2. **后端**：新增专用接口，例如 `POST /orders/draft-from-chat-image`（命名可再议）：服务端持有**管理员配置的 API Key**（见 2.4），将图片以 URL 或 Base64（注意大小限制）调用千问多模态接口；使用**结构化输出**（JSON Schema 或严格 Prompt 要求仅返回 JSON）映射到内部 DTO，与 `OrderCreateRequest` 字段对齐。
3. **交互**：接口返回「建议字段 + 置信度/原文摘录（可选）」；前端**预填表单且不自动提交**，售前必须人工核对后点「提交创建」。可选：高置信度字段标绿、低置信度标黄提示修改。

### 2.3 与当前项目的结合点

- 表单入口：`OrderCreatePage.tsx`、`OrderListPage.tsx` 内新建订单表单字段与 `orderService.createOrder` 已存在，适合增加「从截图导入」按钮与一次性格式化赋值逻辑。
- 系统配置：后端已有 `SysConfig` + `OrderConfigurationService` 以键值维护业务参数的模式；千问 API Key 可**扩展**为独立配置域（如 `integration.dashscope.apiKey`），或单独「集成设置」表，避免与价格类配置混在同一 DTO 造成前端臃肿。
- 权限：接口仅允许 `ADMIN`、`PRE_SALES`（与新建订单路由一致），且**仅服务端调用外部 API**，避免 Key 暴露到浏览器或 Electron 打包产物。

### 2.4 API Key 由管理员配置（安全要求）

- **存储**：数据库加密字段或 KMS；至少不在接口响应中回显完整 Key，管理界面用「已配置 / 掩码展示后几位」。
- **传输**：仅 HTTPS；管理员更新 Key 时走鉴权接口。
- **审计**：记录「谁、何时」修改集成密钥（不含明文）。

### 2.5 风险与缓解

- **识别错误**：强制人工确认；关键字段（联系方式、基础需求）可做前端校验与非空提示。
- **合规**：聊天截图含个人信息，需在隐私政策中说明用途、保留期限；若调用云端模型，需符合公司对数据出境与供应商协议的要求。
- **成本**：按次计费，可对单用户日调用次数做配额。

### 2.6 实施阶段建议

| 阶段 | 内容 |
|------|------|
| MVP | 单图上传 → 后端调千问 → 返回 JSON → 前端预填 → 人工提交。 |
| 增强 | 多图、会话上下文摘要、字段级置信度、失败重试与降级（仅 OCR 文本再 LLM）。 |
| 运营 | 根据错填率迭代 Prompt 与字段校验规则。 |

---

## 3. 功能二：接入企业微信 API，在系统内自动创建客户群

### 3.1 可行性结论

**在具备企业微信主体资质并完成应用与权限配置的前提下可行；工程复杂度与组织流程成本高于功能一，且「群」的类型决定具体 API。**

需先与业务对齐一个关键事实：

- 若售前创建的是**客户联系（外部联系人）相关的客户群**（含微信用户或企微外部联系人），应走**客户联系**相关接口能力（企业需开通客户联系、配置可信 IP、使用对应 Secret 等）。
- 若仅为**企业内部同事群**，接口体系不同，且通常**无法直接把「微信上的客户」拉进群**，与「防止与客户失联」场景可能不一致。

下文按更常见的「售前 + 客户在微信侧沟通，需在企微客户群中收口」理解进行分析。

### 3.2 能力与前置条件（概要）

1. **企业微信管理后台**：创建自建应用或使用已有应用；获取 `corpid`、应用 `secret`；配置 IP 白名单、域名可信校验等。
2. **权限范围**：客户联系、客户群管理等能力需管理员在后台为应用勾选；部分能力依赖企业认证状态。
3. **建群流程（逻辑上）**：通常需要明确群成员（内部成员 userid + 外部联系人 external_userid 等）、群主、群名规则；部分场景需通过**联系我**或**加入群聊**二维码由客户主动入群，而非纯服务端「一键拉满所有人」。
4. **与订单绑定**：订单表或扩展表增加 `wecom_chat_id` / `room_id` / 群二维码 URL 等字段；创建订单成功或识别完成后异步调企微创建群，写回订单，前端在订单详情展示「打开企微」或二维码。

### 3.3 与当前系统的结合点

- **触发时机**：建议在「订单创建成功」后由后端异步任务发起建群（避免阻塞下单）；若建群失败，订单仍有效，需告警与重试队列，并在订单详情提示「建群失败请人工处理」。
- **成员规则**：内部成员至少包含当前售前 userid（需维护「系统用户 ↔ 企微 userid」映射表，可由管理员批量导入或首次 OAuth 绑定）；外部客户需已在客户联系中可识别，否则只能生成「待客户扫码入群」的链路。
- **配置项**：除 corpid/secret 外，可能还需 agentid、客户联系 Secret 等（视官方文档版本而定），同样建议**仅管理员配置、服务端使用**。

### 3.4 风险与边界

| 风险 | 说明 |
|------|------|
| 权限与审核 | 企微接口变更频繁，需预留适配成本；未认证企业部分接口不可用。 |
| 客户身份 | 若客户仅在微信私聊、未加企微外部联系人，则无法按 external_userid 直接拉群，需产品改为「生成入群二维码 + 订单页展示」流程。 |
| 失败与一致 | 网络超时、频率限制、成员非法会导致建群失败；必须异步重试 + 运营可见性，避免「系统显示已下单但无群」。 |
| 合规 | 自动拉群涉及用户同意与个人信息处理，需法务/合规确认话术与授权链路。 |

### 3.5 实施阶段建议

| 阶段 | 内容 |
|------|------|
| 调研 | 确认实际使用的是「客户群」还是「内部群」；梳理成员来源与绑定方式。 |
| MVP | 订单创建后创建群（或生成客户群二维码）→ 写回订单 → 详情页展示；失败人工补救。 |
| 增强 | 映射表管理、重试队列、管理后台测试连通性、与截图识别联动（例如从截图解析出的微信号仅作备注，不保证能拉群）。 |

---

## 4. 总体架构建议（两功能共用）

- **集成配置中心**：管理员维护「千问」「企业微信」等密钥与开关；应用启动或缓存定时刷新；业务代码只读配置服务。
- **异步与幂等**：识图与建群均建议异步任务 + 幂等键（如 `orderId`），避免重复建群、重复扣费。
- **可观测性**：调用外部 API 的耗时、错误码、重试次数写入日志或指标，便于排障。

---

## 5. 小结

| 功能 | 可行性 | 主要依赖 |
|------|--------|----------|
| 截图识别预填订单 | 高（MVP 明确） | 千问多模态 API、管理员安全配置、前端双入口表单改造、人工确认流程。 |
| 企微自动建群 | 中高（依赖企微资质与业务场景） | 企业微信应用与客户联系等权限、成员身份映射、异步任务与失败兜底；需产品澄清「群类型」与「客户是否在企微外部联系人中」。 |

建议优先落地**截图识别预填**；企微侧需完成管理后台权限与种子客户群配置后再启用自动进群。

---

## 6. 官方接口参考（联网查阅摘要）

### 6.1 阿里云 DashScope / 通义千问（OpenAI 兼容多模态）

- **文档入口**：[通过 DashScope 调用通义千问 API](https://help.aliyun.com/zh/model-studio/qwen-api-via-dashscope)、[Qwen-VL 视觉理解](https://help.aliyun.com/zh/dashscope/developer-reference/qwen-vl-plus/)。
- **本系统调用方式**：`POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`  
  - 请求头：`Authorization: Bearer <DASHSCOPE_API_KEY>`，`Content-Type: application/json`。  
  - 请求体：OpenAI Chat Completions 格式；`messages` 中 `user.content` 为数组，包含 `{ "type": "image_url", "image_url": { "url": "data:image/...;base64,..." } }` 与 `{ "type": "text", "text": "..." }`。  
  - 模型名可配置，默认 `qwen-vl-plus`（见系统配置「销售助手集成」）。
- **地域**：主线路使用北京域名；国际业务可参考官方文档切换 `dashscope-intl.aliyuncs.com` 等（当前代码未做可配置地域，可按需扩展）。

### 6.2 企业微信「客户群」进群方式

- **文档入口**：[客户群「加入群聊」管理](https://developer.work.weixin.qq.com/document/path/92229)（路径号以官方为准，若跳转变更请在开发者中心搜索「加入群聊」「groupchat」）。
- **本系统调用顺序**（客户联系 `access_token`）：  
  1. `GET https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=ID&corpsecret=SECRET` 获取 `access_token`。  
  2. `POST https://qyapi.weixin.qq.com/cgi-bin/externalcontact/groupchat/add_join_way?access_token=TOKEN`  
     - 请求体字段与官方一致：`scene`（本实现使用 `2` 表示群的二维码插件场景）、`chat_id_list`（**必填**，已有客户群 ID 列表，最多 5 个）、`auto_create_room`（群满自动建新群）、`room_base_name`、`remark`、`state` 等。  
  3. `POST https://qyapi.weixin.qq.com/cgi-bin/externalcontact/groupchat/get_join_way?access_token=TOKEN`，请求体 `{"config_id":"..."}`，从返回的 `join_way.qr_code` 取二维码（可能为 Base64 或带 `data:image` 前缀，后端已做剥离）。
- **重要限制（产品需知晓）**：  
  - 无法在无种子群的情况下「凭空」创建第一个客户群；管理员必须在企微侧先存在至少一个客户群，并将其 `chat_id` 配置到本系统「种子客户群」中。  
  - Secret 须为具备**客户联系**权限的应用或客户联系专用 Secret，具体以后台可见权限为准。  
  - 错误码如互通账号 License、可见范围超过 1000 人等，需按[企业微信开发者文档](https://developer.work.weixin.qq.com/document/path)排查。

---

## 7. 实现映射（仓库内）

| 能力 | 后端 | 前端 |
|------|------|------|
| 截图识图填单 | `POST /api/orders/draft-from-chat-image`（`multipart/form-data`，字段名 `file`），`DashScopeChatImageDraftService` | `ChatScreenshotImportButton`、`applyChatDraftToOrderForm`；`OrderCreatePage`、`OrderListPage` |
| 集成配置 | `GET/PUT /api/integrations/settings`（仅 `ADMIN`），`IntegrationSettingsService` + `SysConfig` 键 `integration.*` | `SystemConfigPage` Tab「销售助手集成」 |
| 企微进群二维码 | 订单创建成功后 `@Async`：`WeComCustomerGroupService.scheduleAfterOrderCreated`；字段 `orders.wecom_join_*` | `OrderDetailPage` 展示二维码或失败原因 |
| 列表性能 | `OrderApiMapper.toOrderInfo(o, false)` 列表不返回大字段；详情 `toOrderInfo(o, true)` 含企微字段 | — |

---

## 8. 文档维护

- 官方链接若变更，请以阿里云「大模型服务平台百炼」与企业微信「开发者中心」为准更新第 6 节。
- 关联代码：`IntegrationController`、`OrderController`（draft 接口）、`OrderCommandService`、`OrderApiMapper`、`V8__sales_assist_integration.sql`。
