package com.jewelry.system.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.conversation.*;
import com.jewelry.system.entity.*;
import com.jewelry.system.enums.OrderEventType;
import com.jewelry.system.repository.*;
import com.jewelry.system.security.AccountKind;
import com.jewelry.system.security.SecurityUserPrincipal;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 站内聊天室业务：开群、成员管理、消息收发持久化、已读回执。
 * 建模师永不进群；与建模师的交互走订单事件卡片。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationService {

    private static final String SUPER_SERVICE_ROLE = "SUPER_SERVICE";
    private static final String SUPER_SERVICE_NAME = "超级客服";

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final PortalCustomerAccountRepository portalCustomerAccountRepository;
    private final B2BClientRepository b2bClientRepository;
    private final PortalCustomerOrderBindingRepository bindingRepository;
    private final OrderConversationRepository conversationRepository;
    private final ConversationMemberRepository memberRepository;
    private final ConversationMessageRepository messageRepository;
    private final ConversationSocketService socketService;
    private final MessageTranslationService translationService;
    private final OrderEventRepository orderEventRepository;
    private final OrderEventCardService orderEventCardService;
    private final DesignInfoRepository designInfoRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public ConversationDto ensureConversationByOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        OrderConversation conversation = conversationRepository.findByOrderId(orderId).orElse(null);
        if (conversation == null) {
            conversation = new OrderConversation();
            conversation.setOrderId(orderId);
            conversation.setTitle(buildConversationTitle(order));
            conversation = conversationRepository.save(conversation);
            order.setConversationId(conversation.getId());
            orderRepository.save(order);
        }
        syncMembers(conversation, order);
        return toConversationDto(conversation, order, null);
    }

    @Transactional
    public ConversationMessageDto sendMessage(Long conversationId, ConversationSendMessageRequest req) {
        SecurityUserPrincipal principal = currentPrincipal();
        boolean admin = isCurrentAdmin();
        ConversationMember member = admin ? null : requireMember(conversationId);
        String content = req.getContent();
        boolean hasContent = StringUtils.hasText(content);
        boolean hasFiles = req.getFileIds() != null && !req.getFileIds().isEmpty();
        if (!hasContent && !hasFiles) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "消息内容不能为空");
        }
        ConversationMessage message = new ConversationMessage();
        message.setConversationId(conversationId);
        if (admin) {
            message.setSenderType(AccountKind.STAFF);
            message.setSenderId(principal.getUserId());
            message.setRole(SUPER_SERVICE_ROLE);
        } else {
            message.setSenderType(member.getAccountType());
            message.setSenderId(member.getAccountId());
            message.setRole(member.getRole());
        }
        message.setMsgType(StringUtils.hasText(req.getMsgType()) ? req.getMsgType() : "text");
        message.setContent(content);
        message.setFileIdsJson(serializeFileIds(req.getFileIds()));
        message = messageRepository.save(message);

        List<ConversationMember> members = memberRepository.findByConversationIdOrderByJoinedAtAsc(conversationId);
        ConversationMessageDto dto = toMessageDto(message, null);
        broadcastFilteredByRole(conversationId, members, "MESSAGE", dto);
        // 异步预翻译并推送翻译完成事件
        if (StringUtils.hasText(content)) {
            translationService.preTranslateAsync(message.getId(), content, conversationId);
        }
        return dto;
    }

    @Transactional(readOnly = true)
    public List<ConversationMessageDto> listMessages(Long conversationId) {
        return listMessages(conversationId, false);
    }

    @Transactional(readOnly = true)
    public List<ConversationMessageDto> listMessages(Long conversationId, boolean includeAll) {
        requireAccess(conversationId);
        String viewerLang = resolveViewerLang();
        Long boundaryMessageId = null;
        if (!includeAll) {
            boundaryMessageId = boundaryMessageIdForCurrentUser(conversationId);
        }
        Long bound = boundaryMessageId;
        return messageRepository.findByConversationIdOrderByIdAsc(conversationId).stream()
                .filter(m -> bound == null || m.getId() <= bound)
                .map(m -> toMessageDto(m, viewerLang))
                .toList();
    }

    @Transactional
    public ConversationMessageDto translateMessage(Long messageId, String targetLang) {
        ConversationMessage message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "消息不存在"));
        requireAccess(message.getConversationId());
        String lang = StringUtils.hasText(targetLang) ? targetLang.trim() : resolveViewerLang();
        return toMessageDto(message, lang);
    }

    @Transactional(readOnly = true)
    public List<ConversationMemberDto> listMembers(Long conversationId) {
        requireAccess(conversationId);
        return memberRepository.findByConversationIdOrderByJoinedAtAsc(conversationId).stream()
                .map(this::toMemberDto)
                .toList();
    }

    @Transactional
    public void markRead(Long conversationId) {
        if (isCurrentAdmin()) {
            return;
        }
        ConversationMember member = requireMember(conversationId);
        messageRepository.findTopByConversationIdOrderByIdDesc(conversationId).ifPresent(latest -> {
            member.setLastReadMessageId(latest.getId());
            memberRepository.save(member);
        });
    }

    /**
     * 将订单事件卡片推送到对应聊天室（若存在），供群内成员看到关键节点。
     * 发送方为事件真实操作者：设计师提交→设计师，客户确认/驳回→客户。
     */
    @Transactional
    public void pushEventMessage(Long orderId, Long eventId, String content,
                                 AccountKind actorType, Long actorId, String actorRole) {
        conversationRepository.findByOrderId(orderId).ifPresent(conversation -> {
            ConversationMessage message = new ConversationMessage();
            message.setConversationId(conversation.getId());
            message.setSenderType(actorType != null ? actorType : AccountKind.STAFF);
            message.setSenderId(actorId != null ? actorId : 0L);
            message.setRole(actorRole != null && !actorRole.isBlank() ? actorRole : "SYSTEM");
            message.setMsgType("event");
            message.setContent(content);
            message.setEventId(eventId);
            message = messageRepository.save(message);
            List<ConversationMember> members = memberRepository.findByConversationIdOrderByJoinedAtAsc(conversation.getId());
            broadcastFilteredByRole(conversation.getId(), members, "MESSAGE", toMessageDto(message, null));
        });
    }

    @Transactional(readOnly = true)
    public List<ConversationDto> listMyConversations() {
        SecurityUserPrincipal principal = currentPrincipal();
        if (isCurrentAdmin()) {
            return conversationRepository.findAllByOrderByIdDesc().stream()
                    .map(c -> {
                        Order order = orderRepository.findById(c.getOrderId()).orElse(null);
                        return toConversationDto(c, order, null);
                    })
                    .toList();
        }
        List<ConversationMember> members = memberRepository
                .findByAccountTypeAndAccountId(principal.getAccountKind(), principal.getUserId());
        List<ConversationDto> result = new ArrayList<>();
        for (ConversationMember member : members) {
            conversationRepository.findById(member.getConversationId()).ifPresent(conversation -> {
                Order order = orderRepository.findById(conversation.getOrderId()).orElse(null);
                result.add(toConversationDto(conversation, order, member));
            });
        }
        return result;
    }

    // ---------- 内部逻辑 ----------

    private void syncMembers(OrderConversation conversation, Order order) {
        addStaffIfAssigned(conversation.getId(), order.getSalesMid(), "SALES_MID");
        addStaffIfAssigned(conversation.getId(), order.getFollowUp(), "FOLLOW_UP");
        addStaffIfAssigned(conversation.getId(), order.getDesigner(), "DESIGNER");

        if (Boolean.TRUE.equals(order.getIsB2b()) && order.getB2bClient() != null) {
            addMemberIfAbsent(conversation.getId(), AccountKind.B2B_CLIENT, order.getB2bClient().getId(), "CUSTOMER");
        } else {
            bindingRepository.findByOrderId(order.getId()).ifPresent(binding ->
                    addMemberIfAbsent(conversation.getId(), AccountKind.C_PORTAL_CUSTOMER, binding.getPortalCustomerId(), "CUSTOMER"));
        }
    }

    private void addStaffIfAssigned(Long conversationId, User user, String role) {
        if (user != null && user.getId() != null) {
            addMemberIfAbsent(conversationId, AccountKind.STAFF, user.getId(), role);
        }
    }

    private void addMemberIfAbsent(Long conversationId, AccountKind type, Long accountId, String role) {
        if (memberRepository.existsByConversationIdAndAccountTypeAndAccountId(conversationId, type, accountId)) {
            return;
        }
        ConversationMember member = new ConversationMember();
        member.setConversationId(conversationId);
        member.setAccountType(type);
        member.setAccountId(accountId);
        member.setRole(role);
        member.setLastReadMessageId(0L);
        memberRepository.save(member);
    }

    /**
     * 改派设计师后同步群成员：移除旧设计师，加入新设计师（可查看全部历史消息）。
     */
    @Transactional
    public void syncDesignerMember(Long orderId, Long newDesignerId) {
        conversationRepository.findByOrderId(orderId).ifPresent(conversation -> {
            // 移除现有 DESIGNER 角色成员（旧设计师）
            List<ConversationMember> designers = memberRepository.findByConversationIdAndRole(conversation.getId(), "DESIGNER");
            for (ConversationMember old : designers) {
                memberRepository.deleteByConversationIdAndAccountTypeAndAccountId(
                        conversation.getId(), old.getAccountType(), old.getAccountId());
            }
            // 新设计师进群（lastReadMessageId=0 可看全部历史）
            if (newDesignerId != null) {
                addMemberIfAbsent(conversation.getId(), AccountKind.STAFF, newDesignerId, "DESIGNER");
            }
        });
    }

    private ConversationMember requireMember(Long conversationId) {
        SecurityUserPrincipal principal = currentPrincipal();
        return memberRepository.findByConversationIdAndAccountTypeAndAccountId(
                        conversationId, principal.getAccountKind(), principal.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "您不是该会话的成员"));
    }

    private void requireAccess(Long conversationId) {
        if (isCurrentAdmin()) {
            return;
        }
        requireMember(conversationId);
    }

    private boolean isCurrentAdmin() {
        return "ADMIN".equals(SecurityUtils.currentRoleApi().orElse(null));
    }

    /** 角色 → 其消息可见的结束边界事件（越过该事件后默认不再接收/展示后续消息）。 */
    private static final Map<String, OrderEventType> ROLE_BOUNDARY = Map.of(
            "DESIGNER", OrderEventType.DESIGN_CONFIRM,
            "FOLLOW_UP", OrderEventType.SHIPPED
    );

    /** 当前员工角色是否有环节边界限制（客户/管理员/售中客服无限制）。 */
    private OrderEventType boundaryEventTypeForCurrentUser() {
        if (!currentPrincipal().isStaff()) {
            return null;
        }
        String role = SecurityUtils.currentRoleApi().orElse("");
        return ROLE_BOUNDARY.get(role);
    }

    /** 返回当前角色在指定会话中可见的最后一条消息 id（未越界或无边界则 null）。 */
    private Long boundaryMessageIdForCurrentUser(Long conversationId) {
        OrderEventType boundaryType = boundaryEventTypeForCurrentUser();
        if (boundaryType == null) {
            return null;
        }
        OrderConversation conversation = conversationRepository.findById(conversationId).orElse(null);
        if (conversation == null) {
            return null;
        }
        return orderEventRepository.findFirstByOrderIdAndEventTypeOrderByIdAsc(conversation.getOrderId(), boundaryType)
                .flatMap(ev -> messageRepository.findFirstByConversationIdAndEventId(conversationId, ev.getId()))
                .map(ConversationMessage::getId)
                .orElse(null);
    }

    /** 判断指定成员是否已越过其角色边界（越过则不再推送，但边界事件本身仍推送）。 */
    private boolean isMemberPassedBoundary(Long conversationId, ConversationMember member) {
        OrderEventType boundaryType = member.getAccountType() == AccountKind.STAFF
                ? ROLE_BOUNDARY.getOrDefault(member.getRole(), null)
                : null;
        if (boundaryType == null) {
            return false;
        }
        OrderConversation conversation = conversationRepository.findById(conversationId).orElse(null);
        if (conversation == null) {
            return false;
        }
        return orderEventRepository.findFirstByOrderIdAndEventTypeOrderByIdAsc(conversation.getOrderId(), boundaryType)
                .isPresent();
    }

    /**
     * 按角色边界过滤广播：已越过边界的受限角色不再接收实时推送。
     * 但若当前消息本身是某个角色的边界事件，该角色仍要收到（这是其可见的最后一条）。
     */
    private void broadcastFilteredByRole(Long conversationId, List<ConversationMember> members,
                                         String eventType, Object data) {
        Long boundaryEventId = null;
        if (data instanceof ConversationMessageDto dto && dto.getEventId() != null) {
            boundaryEventId = dto.getEventId();
        }
        for (ConversationMember member : members) {
            OrderEventType memberBoundary = member.getAccountType() == AccountKind.STAFF
                    ? ROLE_BOUNDARY.getOrDefault(member.getRole(), null)
                    : null;
            if (memberBoundary == null) {
                socketService.send(member.getAccountType(), member.getAccountId(), eventType, data);
                continue;
            }
            boolean isBoundaryMessage = boundaryEventId != null
                    && messageRepository.findFirstByConversationIdAndEventId(conversationId, boundaryEventId)
                            .map(ConversationMessage::getId)
                            .map(id -> id.equals(((ConversationMessageDto) data).getId()))
                            .orElse(false);
            if (isBoundaryMessage) {
                // 边界事件本身推送给该角色
                socketService.send(member.getAccountType(), member.getAccountId(), eventType, data);
                continue;
            }
            if (!isMemberPassedBoundary(conversationId, member)) {
                socketService.send(member.getAccountType(), member.getAccountId(), eventType, data);
            }
        }
    }

    private SecurityUserPrincipal currentPrincipal() {
        return SecurityUtils.currentPrincipal()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
    }

    private ConversationDto toConversationDto(OrderConversation conversation, Order order, ConversationMember self) {
        long unread = 0;
        String lastMessage = null;
        Long lastReadId = self != null ? self.getLastReadMessageId() : null;
        var latest = messageRepository.findTopByConversationIdOrderByIdDesc(conversation.getId()).orElse(null);
        if (latest != null) {
            lastMessage = latest.getContent();
            if (self != null) {
                if (lastReadId == null) {
                    lastReadId = 0L;
                }
                unread = messageRepository.countByConversationIdAndIdGreaterThan(conversation.getId(), lastReadId);
            }
        }
        return ConversationDto.builder()
                .id(conversation.getId())
                .orderId(conversation.getOrderId())
                .orderNumber(order != null ? order.getOrderNumber() : null)
                .title(order != null ? buildConversationTitle(order) : conversation.getTitle())
                .orderStatus(order != null && order.getStatus() != null ? order.getStatus().name() : null)
                .orderStatusLabel(order != null && order.getStatus() != null ? order.getStatus().getDescription() : null)
                .serviceType(order != null && order.getServiceType() != null ? order.getServiceType().name() : null)
                .serviceTypeLabel(order != null && order.getServiceType() != null ? order.getServiceType().getDescription() : null)
                .avatarUrl(resolveAvatarUrl(order))
                .lastMessage(lastMessage)
                .lastMessageAt(latest != null ? latest.getCreatedAt() : null)
                .unreadCount(unread)
                .createdAt(conversation.getCreatedAt())
                .build();
    }

    /** 群名：创建日期 + 客户邮箱/谷歌昵称（回退订单号）。 */
    private String buildConversationTitle(Order order) {
        if (order == null) {
            return null;
        }
        String date = order.getCreatedAt() != null
                ? order.getCreatedAt().toLocalDate().toString()
                : "";
        String label = resolveCustomerLabel(order);
        return StringUtils.hasText(date) ? (date + " " + label) : label;
    }

    private String resolveCustomerLabel(Order order) {
        try {
            if (!Boolean.TRUE.equals(order.getIsB2b())) {
                return bindingRepository.findByOrderId(order.getId())
                        .flatMap(b -> portalCustomerAccountRepository.findById(b.getPortalCustomerId()))
                        .map(a -> {
                            if (StringUtils.hasText(a.getEmail())) {
                                return a.getEmail();
                            }
                            if (StringUtils.hasText(a.getDisplayName())) {
                                return a.getDisplayName();
                            }
                            return a.getContact();
                        })
                        .orElse(order.getOrderNumber());
            }
            return b2bClientRepository.findById(order.getB2bClient().getId())
                    .map(c -> {
                        if (StringUtils.hasText(c.getCompanyName())) {
                            return c.getCompanyName();
                        }
                        if (StringUtils.hasText(c.getContactPerson())) {
                            return c.getContactPerson();
                        }
                        return c.getContact();
                    })
                    .orElse(order.getOrderNumber());
        } catch (Exception e) {
            log.warn("解析会话客户标签失败 orderId={}", order.getId(), e);
            return order.getOrderNumber();
        }
    }

    /** 会话头像图：来图定制=参考图第一张；设计师设计=最新设计稿第一张；无则 null。 */
    private String resolveAvatarUrl(Order order) {
        if (order == null) {
            return null;
        }
        DesignInfo di = designInfoRepository.findByOrderId(order.getId()).orElse(null);
        if (di == null) {
            return null;
        }
        List<String> images = parseStringList(di.getDesignImagesJson());
        if (images.isEmpty()) {
            return null;
        }
        if (order.getServiceType() == com.jewelry.system.enums.ServiceType.DESIGNER_DESIGN) {
            // 仅当存在设计稿提交事件时才展示（最新设计稿）
            boolean hasDesignSubmit = orderEventRepository.findByOrderIdOrderByIdAsc(order.getId()).stream()
                    .anyMatch(e -> e.getEventType() == com.jewelry.system.enums.OrderEventType.DESIGN_SUBMIT);
            if (!hasDesignSubmit) {
                return null;
            }
        }
        return images.get(0);
    }

    private List<String> parseStringList(String json) {
        if (!StringUtils.hasText(json)) {
            return List.of();
        }
        try {
            List<String> list = objectMapper.readValue(
                    json.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                    new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}
            );
            return list == null ? List.of() : list;
        } catch (Exception e) {
            log.warn("解析图片列表失败: {}", json, e);
            return List.of();
        }
    }

    private ConversationMemberDto toMemberDto(ConversationMember member) {
        return ConversationMemberDto.builder()
                .id(member.getId())
                .accountType(member.getAccountType().name())
                .accountId(member.getAccountId())
                .role(member.getRole())
                .displayName(resolveDisplayName(member.getAccountType(), member.getAccountId()))
                .lastReadMessageId(member.getLastReadMessageId())
                .joinedAt(member.getJoinedAt())
                .build();
    }

    private ConversationMessageDto toMessageDto(ConversationMessage message, String viewerLang) {
        String content = message.getContent();
        String translated = null;
        String translatedLang = null;
        if (StringUtils.hasText(content) && StringUtils.hasText(viewerLang) && "text".equals(message.getMsgType())) {
            translated = translationService.getOrTranslate(message.getId(), content, viewerLang);
            if (translated != null) {
                translatedLang = viewerLang;
            }
        }
        com.jewelry.system.dto.order.OrderEventDto eventDto = null;
        if ("event".equals(message.getMsgType()) && message.getEventId() != null) {
            eventDto = orderEventRepository.findById(message.getEventId())
                    .map(orderEventCardService::assemble)
                    .orElse(null);
        }
        return ConversationMessageDto.builder()
                .id(message.getId())
                .conversationId(message.getConversationId())
                .senderType(message.getSenderType().name())
                .senderId(message.getSenderId())
                .role(message.getRole())
                .displayName(SUPER_SERVICE_ROLE.equals(message.getRole())
                        ? SUPER_SERVICE_NAME
                        : resolveDisplayName(message.getSenderType(), message.getSenderId()))
                .msgType(message.getMsgType())
                .content(content)
                .translatedContent(translated)
                .translatedLang(translatedLang)
                .fileIds(parseFileIds(message.getFileIdsJson()))
                .eventId(message.getEventId())
                .event(eventDto)
                .createdAt(message.getCreatedAt())
                .build();
    }

    private String resolveViewerLang() {
        SecurityUserPrincipal principal = currentPrincipal();
        AccountKind kind = principal.getAccountKind();
        Long id = principal.getUserId();
        try {
            if (kind == AccountKind.STAFF) {
                return userRepository.findById(id).map(User::getLang).filter(StringUtils::hasText).orElse("zh-CN");
            }
            if (kind == AccountKind.C_PORTAL_CUSTOMER) {
                return portalCustomerAccountRepository.findById(id)
                        .map(a -> StringUtils.hasText(a.getLang()) ? a.getLang() : "en")
                        .orElse("en");
            }
            if (kind == AccountKind.B2B_CLIENT) {
                return b2bClientRepository.findById(id)
                        .map(c -> StringUtils.hasText(c.getLang()) ? c.getLang() : "zh-CN")
                        .orElse("zh-CN");
            }
        } catch (Exception e) {
            log.warn("解析查看者语言失败", e);
        }
        return "zh-CN";
    }

    private String resolveDisplayName(AccountKind type, Long accountId) {
        try {
            return switch (type) {
                case STAFF -> userRepository.findById(accountId)
                        .map(u -> StringUtils.hasText(u.getRealName()) ? u.getRealName() : u.getUsername())
                        .orElse(null);
                case C_PORTAL_CUSTOMER -> portalCustomerAccountRepository.findById(accountId)
                        .map(a -> StringUtils.hasText(a.getDisplayName()) ? a.getDisplayName()
                                : (StringUtils.hasText(a.getEmail()) ? a.getEmail() : a.getContact()))
                        .orElse(null);
                case B2B_CLIENT -> b2bClientRepository.findById(accountId)
                        .map(c -> StringUtils.hasText(c.getCompanyName()) ? c.getCompanyName()
                                : (StringUtils.hasText(c.getContactPerson()) ? c.getContactPerson() : c.getContact()))
                        .orElse(null);
            };
        } catch (Exception e) {
            log.warn("解析成员显示名失败 type={} id={}", type, accountId, e);
            return null;
        }
    }

    private String serializeFileIds(List<Long> fileIds) {
        if (fileIds == null || fileIds.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(fileIds);
        } catch (Exception e) {
            log.warn("序列化附件ID失败", e);
            return null;
        }
    }

    private List<Long> parseFileIds(String json) {
        if (!StringUtils.hasText(json)) {
            return null;
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<Long>>() {});
        } catch (Exception e) {
            log.warn("解析附件ID失败: {}", json, e);
            return null;
        }
    }
}
