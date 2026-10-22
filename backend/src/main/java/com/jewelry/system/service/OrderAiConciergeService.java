package com.jewelry.system.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.conversation.OrderAiIntakeCollectedDto;
import com.jewelry.system.entity.*;
import com.jewelry.system.enums.OrderSource;
import com.jewelry.system.enums.ServiceType;
import com.jewelry.system.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.jewelry.system.event.CustomerChatMessageEvent;
import com.jewelry.system.event.OrderConversationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * C 端订单群聊 AI 客服：下单后主动问候，收集设计需求与尺寸，完成后转达设计师。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderAiConciergeService {

    private static final Pattern JSON_BLOCK = Pattern.compile("```(?:json)?\\s*([\\s\\S]*?)```", Pattern.CASE_INSENSITIVE);
    private static final int MAX_INTAKE_TURNS = 12;
    /** 采集阶段至少往返轮次，避免首轮就误判完成 */
    private static final int MIN_INTAKE_TURNS_BEFORE_COMPLETE = 2;
    private static final int MAX_ASSISTING_TURNS = 40;

    private final OrderAiIntakeRepository intakeRepository;
    private final OrderRepository orderRepository;
    private final OrderConversationRepository conversationRepository;
    private final ConversationMessageRepository messageRepository;
    private final ConversationMemberRepository memberRepository;
    private final PortalCustomerOrderBindingRepository bindingRepository;
    private final PortalCustomerAccountRepository accountRepository;
    private final OrderPieceRepository orderPieceRepository;
    private final ConversationService conversationService;
    private final DashScopeChatService dashScopeChatService;
    private final IntegrationSettingsService integrationSettingsService;
    private final ObjectMapper objectMapper;

    @Async("orderAiConciergeExecutor")
    @EventListener
    public void onConversationReady(OrderConversationReadyEvent event) {
        if (event == null || event.orderId() == null) {
            return;
        }
        try {
            startIntake(event.orderId());
        } catch (Exception e) {
            log.warn("AI intake kickoff failed orderId={}", event.orderId(), e);
        }
    }

    @Async("orderAiConciergeExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCustomerChatMessage(CustomerChatMessageEvent event) {
        if (event == null) {
            return;
        }
        try {
            onCustomerMessage(event.conversationId(), event.messageId());
        } catch (Exception e) {
            log.warn("AI intake reply failed conversationId={} messageId={}",
                    event.conversationId(), event.messageId(), e);
        }
    }

    @Transactional
    public void startIntake(Long orderId) {
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null || !shouldRunFor(order)) {
            return;
        }
        if (intakeRepository.findByOrderId(orderId).isPresent()) {
            return;
        }
        OrderConversation conversation = conversationRepository.findByOrderId(orderId).orElse(null);
        if (conversation == null) {
            return;
        }
        OrderAiIntake intake = new OrderAiIntake();
        intake.setOrderId(orderId);
        intake.setConversationId(conversation.getId());
        intake.setStatus(OrderAiIntake.STATUS_ACTIVE);
        intake.setTurnCount(0);
        intakeRepository.save(intake);

        String lang = resolveCustomerLang(orderId);
        String welcome = buildWelcomeMessage(order, lang);
        conversationService.postAiAssistantMessage(conversation.getId(), welcome);
    }

    @Transactional
    public void onCustomerMessage(Long conversationId, Long messageId) {
        ConversationMessage msg = messageRepository.findById(messageId).orElse(null);
        if (msg == null || !conversationId.equals(msg.getConversationId())) {
            return;
        }
        if (!"text".equals(msg.getMsgType()) || !StringUtils.hasText(msg.getContent())) {
            return;
        }
        if (!isCustomerMessage(msg)) {
            return;
        }
        OrderAiIntake intake = intakeRepository.findByConversationId(conversationId).orElse(null);
        if (intake == null || OrderAiIntake.STATUS_DISABLED.equals(intake.getStatus())) {
            return;
        }
        Order order = orderRepository.findById(intake.getOrderId()).orElse(null);
        if (order == null) {
            return;
        }

        intake.setTurnCount(intake.getTurnCount() + 1);
        intakeRepository.save(intake);

        String lang = resolveCustomerLang(order.getId());

        if (OrderAiIntake.STATUS_COMPLETED.equals(intake.getStatus())) {
            handleAssistingTurn(order, intake, msg.getContent(), lang);
            return;
        }

        ConciergeReply reply = generateIntakeReply(order, intake, msg.getContent(), lang);

        if (reply.collected != null) {
            intake.setCollectedJson(writeJson(reply.collected));
            intakeRepository.save(intake);
        }

        if (StringUtils.hasText(reply.text)) {
            conversationService.postAiAssistantMessage(conversationId, reply.text);
        }

        boolean shouldComplete = intake.getTurnCount() >= MAX_INTAKE_TURNS
                || (intake.getTurnCount() >= MIN_INTAKE_TURNS_BEFORE_COMPLETE && (
                reply.intakeComplete
                        || (reply.collected != null && isIntakeSufficient(reply.collected, order))));

        if (shouldComplete && OrderAiIntake.STATUS_ACTIVE.equals(intake.getStatus())) {
            completeIntake(order, intake, reply.collected, lang);
        }
    }

    /** 需求已转达设计师后：持续对话，回答追问并记录补充说明 */
    private void handleAssistingTurn(Order order, OrderAiIntake intake, String userText, String lang) {
        int assistingTurns = intake.getTurnCount();
        if (assistingTurns > MAX_ASSISTING_TURNS) {
            return;
        }
        String replyText = generateAssistingReply(order, intake, userText, lang);
        if (!StringUtils.hasText(replyText)) {
            return;
        }
        conversationService.postAiAssistantMessage(intake.getConversationId(), replyText);
        appendSupplementNote(order, userText);
        orderRepository.save(order);
    }

    private void completeIntake(Order order, OrderAiIntake intake, OrderAiIntakeCollectedDto collected, String lang) {
        String summary = buildSummary(collected, order);
        appendRequirementsToOrder(order, summary, collected);
        orderRepository.save(order);

        intake.setStatus(OrderAiIntake.STATUS_COMPLETED);
        intake.setCompletedAt(LocalDateTime.now());
        if (collected != null) {
            intake.setCollectedJson(writeJson(collected));
        }
        intakeRepository.save(intake);

        String closing = buildClosingMessage(lang);
        conversationService.postAiAssistantMessage(intake.getConversationId(), closing);
    }

    private ConciergeReply generateIntakeReply(Order order, OrderAiIntake intake, String userText, String lang) {
        if (integrationSettingsService.requireLlm() == null) {
            return scriptReply(order, intake, userText, lang);
        }
        try {
            List<DashScopeChatService.ChatTurn> history = buildChatHistory(intake.getConversationId());
            String system = intakeSystemPrompt(order, intake, lang);
            String raw = dashScopeChatService.complete(system, history, userText);
            return parseLlmReply(raw, lang);
        } catch (Exception e) {
            log.warn("LLM concierge fallback to script: {}", e.getMessage());
            return scriptReply(order, intake, userText, lang);
        }
    }

    private String generateAssistingReply(Order order, OrderAiIntake intake, String userText, String lang) {
        if (integrationSettingsService.requireLlm() == null) {
            boolean en = lang != null && lang.toLowerCase(Locale.ROOT).startsWith("en");
            return en
                    ? "Thanks for the extra detail — I've noted it for your designer. They'll join this chat soon; feel free to keep sharing references or questions here."
                    : "收到您的补充，我已记录并会同步给设计师。设计师进群前您都可以继续在这里留言或发参考图。";
        }
        try {
            List<DashScopeChatService.ChatTurn> history = buildChatHistory(intake.getConversationId());
            String system = assistingSystemPrompt(order, intake, lang);
            String raw = dashScopeChatService.complete(system, history, userText);
            return parseAssistingVisibleText(raw, lang);
        } catch (Exception e) {
            log.warn("LLM assisting fallback: {}", e.getMessage());
            boolean en = lang != null && lang.toLowerCase(Locale.ROOT).startsWith("en");
            return en
                    ? "Got it — I've added that to your order notes. Your designer will follow up in this chat."
                    : "好的，已记入订单备注，设计师会在群内与您继续沟通。";
        }
    }

    private String parseAssistingVisibleText(String raw, String lang) {
        String visible = stripJsonBlock(raw);
        Matcher m = JSON_BLOCK.matcher(raw);
        if (m.find()) {
            try {
                JsonNode node = objectMapper.readTree(m.group(1).trim());
                if (node.hasNonNull("reply")) {
                    visible = node.get("reply").asText();
                }
            } catch (Exception ignored) {
                // use stripped text
            }
        }
        if (!StringUtils.hasText(visible)) {
            visible = lang != null && lang.startsWith("en")
                    ? "Thanks — I've noted that for your designer."
                    : "收到，我会把这点转达给设计师。";
        }
        return visible.trim();
    }

    private ConciergeReply scriptReply(Order order, OrderAiIntake intake, String userText, String lang) {
        OrderAiIntakeCollectedDto collected = readCollected(intake.getCollectedJson());
        mergeUserText(collected, userText);

        boolean en = lang != null && lang.toLowerCase(Locale.ROOT).startsWith("en");
        int turn = intake.getTurnCount();

        if (turn <= 1) {
            String text = en
                    ? "Thank you! Could you tell me more about the style you want (classic, minimalist, vintage, etc.) and the metal preference (gold, silver, platinum)?"
                    : "谢谢！能再介绍一下您想要的风格（如简约、复古、奢华等）和材质偏好（如 K 金、银、铂金）吗？";
            return new ConciergeReply(text, false, collected);
        }
        if (turn == 2) {
            String text = en
                    ? "Got it. For each piece, please share the jewelry type (ring, necklace, earrings, brooch) and sizes — finger size is required for rings; chain length is optional for necklaces."
                    : "好的。请说明每件珠宝的类型（戒指/项链/耳钉/胸针等）及尺寸：戒指需手寸，项链链长可填可不填，耳钉胸针一般无需尺寸。";
            return new ConciergeReply(text, false, collected);
        }
        if (turn == 3) {
            String text = en
                    ? "Any engraving text, wearing occasion, or budget/timeline we should note?"
                    : "是否有字印内容、佩戴场景或预算/工期方面的要求？";
            return new ConciergeReply(text, false, collected);
        }
        if (turn < MIN_INTAKE_TURNS_BEFORE_COMPLETE + 1) {
            String text = en
                    ? "Anything else we should pass to your designer (pair/matching sets, flexibility of links, gemstone density, etc.)?"
                    : "还有其他希望设计师了解的吗？例如情侣款、链节柔软度、宝石密度等。";
            return new ConciergeReply(text, false, collected);
        }
        collected.setSummary(collected.getOtherNotes());
        return new ConciergeReply(null, true, collected);
    }

    private ConciergeReply parseLlmReply(String raw, String lang) {
        String visible = raw;
        boolean complete = false;
        OrderAiIntakeCollectedDto collected = null;
        Matcher m = JSON_BLOCK.matcher(raw);
        if (m.find()) {
            try {
                JsonNode node = objectMapper.readTree(m.group(1).trim());
                if (node.hasNonNull("reply")) {
                    visible = node.get("reply").asText();
                }
                if (node.has("intake_complete")) {
                    complete = node.get("intake_complete").asBoolean(false);
                }
                if (node.has("collected") && node.get("collected").isObject()) {
                    collected = objectMapper.treeToValue(node.get("collected"), OrderAiIntakeCollectedDto.class);
                }
            } catch (Exception e) {
                log.warn("Parse concierge JSON failed: {}", e.getMessage());
            }
        }
        visible = stripJsonBlock(visible);
        if (!StringUtils.hasText(visible)) {
            visible = lang != null && lang.startsWith("en")
                    ? "Thank you — could you share a bit more detail?"
                    : "收到，能再补充一些细节吗？";
        }
        return new ConciergeReply(visible.trim(), complete, collected);
    }

    private String intakeSystemPrompt(Order order, OrderAiIntake intake, String lang) {
        String langHint = lang != null && lang.startsWith("en") ? "Reply in English." : "请使用简体中文回复客户。";
        String pieces = describePieces(order.getId());
        String service = order.getServiceType() != null ? order.getServiceType().getDescription() : "";
        return """
你是珠宝定制品牌 duxury 的订单群聊 AI 客服。客户已支付定金并进入专属群聊，设计师稍后会进群。
你的任务：友好问候，逐项了解定制需求（风格、材质、场景、字印、每件类型与手寸/链长、预算工期等），一次只问 1～2 个重点，语气专业温暖。
已有下单信息：
- 服务类型：%s
- 客户已填基础需求：%s
- 单件概况：%s
- 已收集草稿：%s
%s
规则：
- 多轮对话：每次都要根据客户最新发言回应，并视情况追问；不要在第一轮就结束采集。
- intake_complete 仅在风格/材质/尺寸等关键信息已基本齐全、且客户没有明显未答问题时才设为 true。
- intake_complete 为 true 时 reply 简短说明将转达设计师，但不要暗示对话结束（客户仍可继续发言）。
在回复末尾附带 JSON 代码块（仅此一处）：
```json
{"reply":"给客户看的文字（勿重复 JSON）","intake_complete":true或false,"collected":{"stylePreference":"","materialPreference":"","occasion":"","engraving":"","budgetOrTimeline":"","sizeNotes":"","pieces":[{"pieceName":"","jewelryType":"","size":""}],"otherNotes":"","summary":"一段话汇总"}}
```
戒指必须确认手寸；项链可确认链长；情侣款/多件需分别说明。
""".formatted(
                service,
                nullToEmpty(order.getBasicRequirements()),
                pieces,
                nullToEmpty(intake.getCollectedJson()),
                langHint);
    }

    private String assistingSystemPrompt(Order order, OrderAiIntake intake, String lang) {
        String langHint = lang != null && lang.startsWith("en") ? "Reply in English." : "请使用简体中文回复客户。";
        return """
你是 duxury 订单群聊 AI 客服。初始需求已整理并转达设计师，设计师尚未进群或正在安排中。
请持续与客户对话：回答追问、确认理解、鼓励补充参考图或细节；语气简洁专业。
不要重复发送「已转达设计师」的结束语；每次针对客户最新消息回复。
已汇总需求草稿：%s
%s
仅输出给客户看的文字；如需结构化数据可附 JSON：```json
{"reply":"给客户看的文字"}
```
""".formatted(nullToEmpty(intake.getCollectedJson()), langHint);
    }

    private void appendSupplementNote(Order order, String userText) {
        if (!StringUtils.hasText(userText)) {
            return;
        }
        String snippet = userText.trim();
        if (snippet.length() > 500) {
            snippet = snippet.substring(0, 500) + "…";
        }
        String base = order.getBasicRequirements() != null ? order.getBasicRequirements() : "";
        String line = "\n[客户补充] " + snippet;
        if (base.contains(snippet)) {
            return;
        }
        order.setBasicRequirements(base + line);
    }

    private List<DashScopeChatService.ChatTurn> buildChatHistory(Long conversationId) {
        List<DashScopeChatService.ChatTurn> turns = new ArrayList<>();
        for (ConversationMessage m : messageRepository.findByConversationIdOrderByIdAsc(conversationId)) {
            if (!"text".equals(m.getMsgType()) || !StringUtils.hasText(m.getContent())) {
                continue;
            }
            if (ConversationService.AI_ASSISTANT_ROLE.equals(m.getRole())) {
                turns.add(new DashScopeChatService.ChatTurn("assistant", m.getContent()));
            } else if (isCustomerMessage(m)) {
                turns.add(new DashScopeChatService.ChatTurn("user", m.getContent()));
            }
        }
        if (turns.size() > 20) {
            return turns.subList(turns.size() - 20, turns.size());
        }
        return turns;
    }

    private boolean isCustomerMessage(ConversationMessage m) {
        if (m.getSenderType() == com.jewelry.system.security.AccountKind.C_PORTAL_CUSTOMER) {
            return true;
        }
        return memberRepository.findByConversationIdAndAccountTypeAndAccountId(
                        m.getConversationId(), m.getSenderType(), m.getSenderId())
                .map(mem -> "CUSTOMER".equals(mem.getRole()))
                .orElse(false);
    }

    private boolean shouldRunFor(Order order) {
        if (order.getSource() == OrderSource.MARKETPLACE) {
            return false;
        }
        if (Boolean.TRUE.equals(order.getIsB2b())) {
            return false;
        }
        ServiceType st = order.getServiceType();
        return st == ServiceType.DESIGNER_DESIGN || st == ServiceType.CUSTOM_IMAGE;
    }

    private String resolveCustomerLang(Long orderId) {
        return bindingRepository.findByOrderId(orderId)
                .flatMap(b -> accountRepository.findById(b.getPortalCustomerId()))
                .map(a -> StringUtils.hasText(a.getLang()) ? a.getLang() : "zh-CN")
                .orElse("zh-CN");
    }

    private String buildWelcomeMessage(Order order, String lang) {
        boolean en = lang != null && lang.toLowerCase(Locale.ROOT).startsWith("en");
        String name = order.getCustomerName() != null ? order.getCustomerName() : (en ? "there" : "您好");
        if (en) {
            return "Hi " + name + "! I'm the duxury AI assistant — your order is confirmed and this chat is now open.\n\n"
                    + "Before your designer joins, I'd love to capture your ideas: style, metal, sizing for each piece (finger size for rings), engraving, and any timeline.\n\n"
                    + "What vision do you have in mind for this piece?";
        }
        return name + "，您好！我是 duxury AI 客服助手，您的订单已确认，专属群聊已开启。\n\n"
                + "在设计师进群前，我先帮您整理定制信息：款式风格、材质、每件珠宝的类型与手寸/链长（戒指需手寸）、字印与工期等。\n\n"
                + "请先简单说说您心目中的这件/这批珠宝吧？";
    }

    private String buildClosingMessage(String lang) {
        boolean en = lang != null && lang.toLowerCase(Locale.ROOT).startsWith("en");
        if (en) {
            return "Thank you! I've summarized your requirements for our design team. "
                    + "Your designer will join this chat soon — and I'll stay here if you want to add more details or ask questions in the meantime.";
        }
        return "感谢您提供的信息！需求已整理并转达设计师，设计师会尽快进群。"
                + "在此之前您仍可继续留言，我会帮您记录并回复。";
    }

    private String describePieces(Long orderId) {
        List<OrderPiece> pieces = orderPieceRepository.findByOrderIdOrderBySeqAsc(orderId);
        if (pieces.isEmpty()) {
            return "（尚未拆分单件）";
        }
        StringBuilder sb = new StringBuilder();
        for (OrderPiece p : pieces) {
            sb.append(p.getName());
            if (p.getJewelryType() != null) {
                sb.append("[").append(p.getJewelryType().name()).append("]");
            }
            sb.append("; ");
        }
        return sb.toString();
    }

    private void appendRequirementsToOrder(Order order, String summary, OrderAiIntakeCollectedDto collected) {
        StringBuilder block = new StringBuilder();
        block.append("\n\n—— AI客服整理 ——\n");
        block.append(summary);
        if (collected != null) {
            if (StringUtils.hasText(collected.getStylePreference()) && !StringUtils.hasText(order.getStyleInfo())) {
                order.setStyleInfo(collected.getStylePreference());
            }
            if (StringUtils.hasText(collected.getMaterialPreference()) && !StringUtils.hasText(order.getMaterialInfo())) {
                order.setMaterialInfo(collected.getMaterialPreference());
            }
        }
        String base = order.getBasicRequirements() != null ? order.getBasicRequirements() : "";
        if (!base.contains("—— AI客服整理 ——")) {
            order.setBasicRequirements(base + block);
        }
    }

    private String buildSummary(OrderAiIntakeCollectedDto c, Order order) {
        if (c != null && StringUtils.hasText(c.getSummary())) {
            return c.getSummary();
        }
        if (c == null) {
            return "（客户已在群聊中补充说明，详见聊天记录）";
        }
        StringBuilder sb = new StringBuilder();
        appendLine(sb, "风格", c.getStylePreference());
        appendLine(sb, "材质", c.getMaterialPreference());
        appendLine(sb, "场景", c.getOccasion());
        appendLine(sb, "字印", c.getEngraving());
        appendLine(sb, "尺寸", c.getSizeNotes());
        appendLine(sb, "预算/工期", c.getBudgetOrTimeline());
        appendLine(sb, "其他", c.getOtherNotes());
        if (c.getPieces() != null) {
            for (OrderAiIntakeCollectedDto.PieceSizeNote p : c.getPieces()) {
                sb.append("- ").append(nullToEmpty(p.getPieceName()))
                        .append(" ").append(nullToEmpty(p.getJewelryType()))
                        .append(" ").append(nullToEmpty(p.getSize())).append("\n");
            }
        }
        return sb.toString().trim();
    }

    private static void appendLine(StringBuilder sb, String label, String val) {
        if (StringUtils.hasText(val)) {
            sb.append(label).append("：").append(val.trim()).append("\n");
        }
    }

    private boolean isIntakeSufficient(OrderAiIntakeCollectedDto c, Order order) {
        if (c == null) {
            return false;
        }
        boolean hasStyle = StringUtils.hasText(c.getStylePreference()) || StringUtils.hasText(c.getSummary());
        boolean hasSize = StringUtils.hasText(c.getSizeNotes())
                || (c.getPieces() != null && !c.getPieces().isEmpty());
        return hasStyle && (hasSize || order.getServiceType() == ServiceType.DESIGNER_DESIGN);
    }

    private void mergeUserText(OrderAiIntakeCollectedDto c, String text) {
        if (!StringUtils.hasText(text)) {
            return;
        }
        if (!StringUtils.hasText(c.getOtherNotes())) {
            c.setOtherNotes(text.trim());
        } else {
            c.setOtherNotes(c.getOtherNotes() + "\n" + text.trim());
        }
    }

    private OrderAiIntakeCollectedDto readCollected(String json) {
        if (!StringUtils.hasText(json)) {
            return new OrderAiIntakeCollectedDto();
        }
        try {
            return objectMapper.readValue(json, OrderAiIntakeCollectedDto.class);
        } catch (Exception e) {
            return new OrderAiIntakeCollectedDto();
        }
    }

    private String writeJson(OrderAiIntakeCollectedDto dto) {
        try {
            return objectMapper.writeValueAsString(dto);
        } catch (Exception e) {
            return "{}";
        }
    }

    private static String stripJsonBlock(String s) {
        if (s == null) {
            return "";
        }
        return JSON_BLOCK.matcher(s).replaceAll("").trim();
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    private record ConciergeReply(String text, boolean intakeComplete, OrderAiIntakeCollectedDto collected) {}
}
