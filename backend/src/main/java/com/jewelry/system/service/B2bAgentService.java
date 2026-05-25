package com.jewelry.system.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.b2b.B2BOrderAccessDto;
import com.jewelry.system.dto.b2b.B2BOrderCreateRequest;
import com.jewelry.system.dto.b2b.agent.*;
import com.jewelry.system.dto.order.OrderDraftFromChatImageResponse;
import com.jewelry.system.entity.B2bAgentMessage;
import com.jewelry.system.entity.B2bAgentSession;
import com.jewelry.system.entity.B2BClient;
import com.jewelry.system.enums.B2bAgentSessionStatus;
import com.jewelry.system.repository.B2BClientRepository;
import com.jewelry.system.repository.B2bAgentMessageRepository;
import com.jewelry.system.repository.B2bAgentSessionRepository;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class B2bAgentService {

    private static final Pattern JSON_BLOCK = Pattern.compile("```(?:json)?\\s*([\\s\\S]*?)```", Pattern.CASE_INSENSITIVE);
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final B2bAgentSessionRepository sessionRepository;
    private final B2bAgentMessageRepository messageRepository;
    private final B2BClientRepository clientRepository;
    private final DashScopeChatService dashScopeChatService;
    private final DashScopeAsrService dashScopeAsrService;
    private final DashScopeChatImageDraftService imageDraftService;
    private final AliyunOssService aliyunOssService;
    private final B2BOrderService b2bOrderService;
    private final OrderFileService orderFileService;
    private final IntegrationSettingsService integrationSettingsService;
    private final ObjectMapper objectMapper;

    @Transactional
    public B2bAgentSessionDto createSession() {
        Long clientId = SecurityUtils.currentB2bClientId().orElse(null);
        if (clientId != null) {
            sessionRepository.findByClientIdOrderByCreatedAtDesc(clientId).stream()
                    .filter(s -> s.getStatus() == B2bAgentSessionStatus.ACTIVE)
                    .forEach(s -> {
                        s.setStatus(B2bAgentSessionStatus.CLOSED);
                        sessionRepository.save(s);
                    });
        }
        B2bAgentSession session = new B2bAgentSession();
        session.setPublicToken(UUID.randomUUID().toString().replace("-", ""));
        session.setClientId(clientId);
        session.setStatus(B2bAgentSessionStatus.ACTIVE);
        session.setDraftJson(writeDraft(new B2bAgentDraftDto()));
        sessionRepository.save(session);

        return toSessionDto(session, true);
    }

    @Transactional(readOnly = true)
    public String getWelcomeMessage() {
        Long clientId = SecurityUtils.currentB2bClientId().orElse(null);
        return buildWelcomeMessage(clientId);
    }

    @Transactional(readOnly = true)
    public List<B2bAgentSessionDto> listHistory() {
        Long clientId = SecurityUtils.currentB2bClientId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
        return sessionRepository.findByClientIdOrderByCreatedAtDesc(clientId).stream()
                .map(s -> toSessionDto(s, false))
                .toList();
    }

    @Transactional(readOnly = true)
    public B2bAgentSessionDto getSession(long sessionId, String publicToken) {
        B2bAgentSession session = resolveSession(sessionId, publicToken);
        return toSessionDto(session, true);
    }

    @Transactional
    public B2bAgentSessionDto bindSession(long sessionId, String publicToken) {
        Long clientId = SecurityUtils.currentB2bClientId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
        B2bAgentSession session = resolveSession(sessionId, publicToken);
        session.setClientId(clientId);
        sessionRepository.closeOtherActiveForClient(clientId, B2bAgentSessionStatus.ACTIVE,
                B2bAgentSessionStatus.CLOSED, session.getId());
        sessionRepository.save(session);
        return toSessionDto(session, true);
    }

    public Map<String, String> speechToText(MultipartFile audio) {
        SecurityUtils.currentB2bClientId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录后再使用语音输入"));
        String text = dashScopeAsrService.transcribe(audio);
        return Map.of("text", text);
    }

    @Transactional
    public B2bAgentChatResponse sendMessage(long sessionId, String publicToken, String text,
                                            MultipartFile image, List<MultipartFile> images) {
        B2bAgentSession session = resolveSession(sessionId, publicToken);
        ensureActive(session);

        List<MultipartFile> uploads = collectUploads(image, images);
        boolean hasUploads = !uploads.isEmpty();

        boolean loggedIn = SecurityUtils.currentB2bClientId().isPresent();
        if (!loggedIn && (StringUtils.hasText(text) || hasUploads)) {
            return B2bAgentChatResponse.builder()
                    .session(toSessionDto(session, true))
                    .needLogin(true)
                    .latestAssistantMessage(B2bAgentMessageDto.builder()
                            .role("assistant")
                            .content("请先登录或注册 B 端账号，以便保存您的定制需求并创建工单。")
                            .build())
                    .build();
        }

        B2bAgentDraftDto draft = readDraft(session.getDraftJson());
        String userVisible = text != null ? text.trim() : "";

        if (hasUploads) {
            int uploaded = 0;
            for (MultipartFile file : uploads) {
                if (file == null || file.isEmpty()) {
                    continue;
                }
                uploaded++;
                String url = uploadReferenceImage(session.getId(), file);
                if (!draft.getReferenceImageUrls().contains(url)) {
                    draft.getReferenceImageUrls().add(url);
                }
                try {
                    OrderDraftFromChatImageResponse parsed = imageDraftService.draftFromImage(file);
                    mergeImageDraft(draft, parsed);
                } catch (Exception e) {
                    log.warn("Agent image parse failed: {}", e.getMessage());
                }
            }
            if (!StringUtils.hasText(userVisible) && uploaded > 0) {
                userVisible = uploaded > 1
                        ? "[用户上传了 " + uploaded + " 张参考/细节图]"
                        : "[用户上传了珠宝参考或细节图]";
            }
        }

        if (!StringUtils.hasText(userVisible)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请输入文字或上传图片");
        }

        saveMessage(session.getId(), "user", userVisible, imagePayload(draft.getReferenceImageUrls()));

        List<DashScopeChatService.ChatTurn> history = buildHistory(session.getId());
        String systemPrompt = agentSystemPrompt(draft, loggedIn);
        String rawReply = dashScopeChatService.complete(systemPrompt, history, userVisible);
        AgentParseResult parsed = parseAgentReply(rawReply);
        applyPatch(draft, parsed.patch());
        if (parsed.readyForConfirm() != null) {
            draft.setReadyForConfirm(parsed.readyForConfirm());
        }
        refreshMissingFields(draft);
        session.setDraftJson(writeDraft(draft));
        sessionRepository.save(session);

        B2bAgentMessage assistant = saveMessage(session.getId(), "assistant", parsed.userText(), null);

        return B2bAgentChatResponse.builder()
                .session(toSessionDto(session, true))
                .latestAssistantMessage(toMessageDto(assistant))
                .needLogin(false)
                .showConfirmCard(Boolean.TRUE.equals(draft.getReadyForConfirm()))
                .build();
    }

    @Transactional
    public B2bAgentChatResponse commit(long sessionId, String publicToken) {
        SecurityUtils.currentB2bClientId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录后再创建工单"));
        B2bAgentSession session = resolveSession(sessionId, publicToken);
        ensureActive(session);
        if (session.getClientId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "会话未绑定账号，请重新登录");
        }

        B2bAgentDraftDto draft = readDraft(session.getDraftJson());
        if (!StringUtils.hasText(draft.getBasicRequirements())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请先通过对话补全「基础需求」");
        }

        B2BOrderCreateRequest req = new B2BOrderCreateRequest();
        req.setBasicRequirements(draft.getBasicRequirements());
        req.setStyleInfo(firstNonBlank(draft.getStyleInfo(), draft.getJewelryType()));
        req.setMaterialInfo(draft.getMaterialInfo());
        req.setCompanyName(draft.getCompanyName());
        req.setContactPerson(draft.getContactPerson());

        B2BOrderAccessDto access = b2bOrderService.createOrder(req);
        Long orderId = access.getOrderId();
        Set<String> attachedUrls = new LinkedHashSet<>();
        for (String url : draft.getReferenceImageUrls()) {
            if (!StringUtils.hasText(url) || !attachedUrls.add(url.strip())) {
                continue;
            }
            attachReferenceUrlToOrder(orderId, url.strip());
        }

        session.setStatus(B2bAgentSessionStatus.COMMITTED);
        session.setCommittedOrderId(orderId);
        sessionRepository.save(session);

        String wecomUrl = integrationSettingsService.b2bSupportWecomQrUrl();
        String closing;
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("orderResult", access);
        if (StringUtils.hasText(wecomUrl)) {
            closing = "工单已创建！请保存下方进度链接与二维码。添加企业微信客服便于沟通与反馈问题。";
            payload.put("supportWecomQrUrl", wecomUrl);
        } else {
            closing = "工单已创建！请保存下方进度链接与二维码。客服将在 24h 内与您取得联系。";
            payload.put("supportWecomFallback", true);
        }
        closing += "\n进度链接：" + access.getAccessUrl();

        B2bAgentMessage msg = saveMessage(session.getId(), "assistant", closing, payload);

        return B2bAgentChatResponse.builder()
                .session(toSessionDto(session, true))
                .latestAssistantMessage(toMessageDto(msg))
                .showConfirmCard(false)
                .orderResult(access)
                .supportWecomQrUrl(StringUtils.hasText(wecomUrl) ? wecomUrl : null)
                .supportWecomFallbackText(StringUtils.hasText(wecomUrl) ? null : "客服将在 24h 内与您取得联系")
                .build();
    }

    @Transactional(readOnly = true)
    public Map<String, String> publicSupportWecom() {
        String url = integrationSettingsService.b2bSupportWecomQrUrl();
        Map<String, String> m = new HashMap<>();
        m.put("qrUrl", url != null ? url : "");
        m.put("fallbackText", StringUtils.hasText(url) ? "" : "客服将在 24h 内与您取得联系");
        return m;
    }

    private void attachReferenceUrlToOrder(Long orderId, String url) {
        try {
            orderFileService.attachGuestDesignFromOssUrl(orderId, url, "Agent 上传参考图");
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to attach agent reference image to order {}: {}", orderId, url, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "参考图写入订单失败: " + e.getMessage());
        }
    }

    private String uploadReferenceImage(long sessionId, MultipartFile file) {
        try {
            if (!aliyunOssService.isEnabled()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "文件存储未配置，无法上传参考图");
            }
            String key = "b2b-agent/" + sessionId + "/" + UUID.randomUUID() + suffix(file.getOriginalFilename());
            return aliyunOssService.uploadObject(key, file);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "参考图上传失败: " + e.getMessage());
        }
    }

    private static List<MultipartFile> collectUploads(MultipartFile image, List<MultipartFile> images) {
        List<MultipartFile> out = new ArrayList<>();
        if (image != null && !image.isEmpty()) {
            out.add(image);
        }
        if (images != null) {
            for (MultipartFile f : images) {
                if (f != null && !f.isEmpty()) {
                    out.add(f);
                }
            }
        }
        return out;
    }

    private static String suffix(String name) {
        if (name == null || !name.contains(".")) {
            return ".jpg";
        }
        return name.substring(name.lastIndexOf('.'));
    }

    private B2bAgentSession resolveSession(long sessionId, String publicToken) {
        B2bAgentSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "会话不存在"));
        if (publicToken != null && !publicToken.isBlank()
                && !publicToken.equals(session.getPublicToken())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "会话凭证无效");
        }
        Long clientId = SecurityUtils.currentB2bClientId().orElse(null);
        if (clientId != null && session.getClientId() != null && !clientId.equals(session.getClientId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权访问该会话");
        }
        return session;
    }

    private void ensureActive(B2bAgentSession session) {
        if (session.getStatus() != B2bAgentSessionStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "该对话已结束，仅可查看历史记录");
        }
    }

    private String buildWelcomeMessage(Long clientId) {
        if (clientId == null) {
            return "您好，欢迎光临恒鎏珠宝定制服务！我是您的智能助理，可引导您提交建模订单。"
                    + "请先登录或注册，以便保存需求并创建工单。您也可以先了解流程，登录后上传参考图开始定制。";
        }
        B2BClient c = clientRepository.findById(clientId).orElse(null);
        String name = c != null ? firstNonBlank(c.getContactPerson(), c.getCompanyName(), c.getContact()) : "客户";
        return "您好，" + name + "！欢迎回来。请上传珠宝参考图并描述定制需求；若有镶嵌结构或主体小组件，也欢迎补充细节图（可多张）。"
                + "信息确认后可一键创建工单。";
    }

    private String agentSystemPrompt(B2bAgentDraftDto draft, boolean loggedIn) {
        String draftJson;
        try {
            draftJson = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(draft);
        } catch (Exception e) {
            draftJson = String.valueOf(draft);
        }
        return """
                你是恒鎏珠宝 B 端门户的智能助理，用简体中文与客户对话，引导完成「建模订单」信息收集。
                当前登录状态：%s
                当前订单草稿 JSON：
                %s

                规则：
                1. 先友好回复客户（不要只输出 JSON）。
                2. 若客户更换图片或修改需求，更新草稿并简要确认已更新。
                3. 追问缺失项：basicRequirements（必填）、款式/材质等；参考图建议上传但不强制。
                4. **细节图引导（重要，非强制）**：在客户已提供主参考图或描述主体后，主动、友好地邀请上传「镶嵌结构图」「主体小组件细节图」等（可多张）。
                   若客户表示没有更多细节、没有了、就这些、类似语义，则不再追问细节图，可在 patch 中设 detailImagesComplete=true。
                   客户拒绝或跳过上传细节图时，尊重选择，继续其他字段收集。
                5. 当 basicRequirements 非空且信息足够时，在 JSON 中设 readyForConfirm=true（不因未上传细节图而阻止确认）。
                6. 在回复末尾附加一个 ```json 代码块```，格式：
                {"patch":{"basicRequirements":"...","styleInfo":"...","detailImagesComplete":true,...},"readyForConfirm":false}
                patch 只需包含需要更新的字段；referenceImageUrls 由系统维护（含细节图），无需在 patch 中重复。
                """.formatted(loggedIn ? "已登录" : "未登录", draftJson);
    }

    private List<DashScopeChatService.ChatTurn> buildHistory(long sessionId) {
        return messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId).stream()
                .filter(m -> "user".equals(m.getRole()) || "assistant".equals(m.getRole()))
                .map(m -> new DashScopeChatService.ChatTurn(m.getRole(), m.getContent()))
                .toList();
    }

    private record AgentParseResult(String userText, Map<String, Object> patch, Boolean readyForConfirm) {}

    private AgentParseResult parseAgentReply(String raw) {
        String userText = raw;
        Map<String, Object> patch = new HashMap<>();
        Boolean ready = null;
        Matcher m = JSON_BLOCK.matcher(raw);
        if (m.find()) {
            userText = raw.substring(0, m.start()).trim();
            if (userText.isEmpty()) {
                userText = raw.substring(m.end()).trim();
            }
            try {
                JsonNode node = objectMapper.readTree(m.group(1).trim());
                if (node.has("patch") && node.get("patch").isObject()) {
                    patch = objectMapper.convertValue(node.get("patch"), Map.class);
                }
                if (node.has("readyForConfirm")) {
                    ready = node.get("readyForConfirm").asBoolean();
                }
            } catch (Exception e) {
                log.warn("Failed to parse agent JSON block: {}", e.getMessage());
            }
        }
        if (userText.isBlank()) {
            userText = raw.replaceAll("```[\\s\\S]*?```", "").trim();
        }
        return new AgentParseResult(userText, patch, ready);
    }

    @SuppressWarnings("unchecked")
    private void applyPatch(B2bAgentDraftDto draft, Map<String, Object> patch) {
        if (patch == null || patch.isEmpty()) {
            return;
        }
        if (patch.get("basicRequirements") != null) {
            draft.setBasicRequirements(String.valueOf(patch.get("basicRequirements")));
        }
        if (patch.get("styleInfo") != null) {
            draft.setStyleInfo(String.valueOf(patch.get("styleInfo")));
        }
        if (patch.get("materialInfo") != null) {
            draft.setMaterialInfo(String.valueOf(patch.get("materialInfo")));
        }
        if (patch.get("jewelryType") != null) {
            draft.setJewelryType(String.valueOf(patch.get("jewelryType")));
        }
        if (patch.get("companyName") != null) {
            draft.setCompanyName(String.valueOf(patch.get("companyName")));
        }
        if (patch.get("contactPerson") != null) {
            draft.setContactPerson(String.valueOf(patch.get("contactPerson")));
        }
        if (patch.get("detailImagesComplete") != null) {
            draft.setDetailImagesComplete(Boolean.parseBoolean(String.valueOf(patch.get("detailImagesComplete"))));
        }
    }

    private void mergeImageDraft(B2bAgentDraftDto draft, OrderDraftFromChatImageResponse p) {
        if (p.getStyle() != null && !p.getStyle().isBlank()) {
            draft.setStyleInfo(p.getStyle());
        }
        if (p.getMaterialInfo() != null && !p.getMaterialInfo().isBlank()) {
            draft.setMaterialInfo(p.getMaterialInfo());
        }
        if (p.getBasicRequirements() != null && !p.getBasicRequirements().isBlank()) {
            if (!StringUtils.hasText(draft.getBasicRequirements())) {
                draft.setBasicRequirements(p.getBasicRequirements());
            } else {
                draft.setBasicRequirements(draft.getBasicRequirements() + "；" + p.getBasicRequirements());
            }
        }
        if (p.getStyle() != null) {
            draft.setJewelryType(p.getStyle());
        }
    }

    private void refreshMissingFields(B2bAgentDraftDto draft) {
        List<String> missing = new ArrayList<>();
        if (!StringUtils.hasText(draft.getBasicRequirements())) {
            missing.add("基础需求");
        }
        draft.setMissingFields(missing);
        if (missing.isEmpty() && StringUtils.hasText(draft.getBasicRequirements())) {
            draft.setReadyForConfirm(true);
        }
    }

    private B2bAgentMessage saveMessage(long sessionId, String role, String content, Object payload) {
        B2bAgentMessage msg = new B2bAgentMessage();
        msg.setSessionId(sessionId);
        msg.setRole(role);
        msg.setContent(content);
        if (payload != null) {
            try {
                msg.setPayloadJson(objectMapper.writeValueAsString(payload));
            } catch (Exception ignored) {
            }
        }
        return messageRepository.save(msg);
    }

    private Map<String, Object> imagePayload(List<String> urls) {
        Map<String, Object> p = new HashMap<>();
        p.put("imageUrls", urls);
        return p;
    }

    private B2bAgentSessionDto toSessionDto(B2bAgentSession session, boolean withMessages) {
        boolean readOnly = session.getStatus() != B2bAgentSessionStatus.ACTIVE;
        List<B2bAgentMessageDto> messages = List.of();
        if (withMessages) {
            messages = messageRepository.findBySessionIdOrderByCreatedAtAsc(session.getId()).stream()
                    .map(this::toMessageDto)
                    .toList();
        }
        return B2bAgentSessionDto.builder()
                .sessionId(session.getId())
                .publicToken(session.getPublicToken())
                .status(session.getStatus().name())
                .draft(readDraft(session.getDraftJson()))
                .messages(messages)
                .readOnly(readOnly)
                .createdAt(session.getCreatedAt())
                .build();
    }

    private B2bAgentMessageDto toMessageDto(B2bAgentMessage m) {
        Map<String, Object> payload = null;
        if (m.getPayloadJson() != null && !m.getPayloadJson().isBlank()) {
            try {
                payload = objectMapper.readValue(m.getPayloadJson(), Map.class);
            } catch (Exception ignored) {
            }
        }
        return B2bAgentMessageDto.builder()
                .id(m.getId())
                .role(m.getRole())
                .content(m.getContent())
                .payload(payload)
                .createdAt(m.getCreatedAt())
                .build();
    }

    private B2bAgentDraftDto readDraft(String json) {
        if (json == null || json.isBlank()) {
            return new B2bAgentDraftDto();
        }
        try {
            return objectMapper.readValue(json, B2bAgentDraftDto.class);
        } catch (Exception e) {
            return new B2bAgentDraftDto();
        }
    }

    private String writeDraft(B2bAgentDraftDto draft) {
        try {
            return objectMapper.writeValueAsString(draft);
        } catch (Exception e) {
            return "{}";
        }
    }

    private static String firstNonBlank(String... parts) {
        for (String p : parts) {
            if (p != null && !p.isBlank()) {
                return p.trim();
            }
        }
        return null;
    }
}
