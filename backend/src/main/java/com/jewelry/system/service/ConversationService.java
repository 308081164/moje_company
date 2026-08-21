package com.jewelry.system.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.conversation.*;
import com.jewelry.system.entity.*;
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

/**
 * 站内聊天室业务：开群、成员管理、消息收发持久化、已读回执。
 * 建模师永不进群；与建模师的交互走订单事件卡片。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationService {

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
    private final ObjectMapper objectMapper;

    @Transactional
    public ConversationDto ensureConversationByOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        OrderConversation conversation = conversationRepository.findByOrderId(orderId).orElse(null);
        if (conversation == null) {
            conversation = new OrderConversation();
            conversation.setOrderId(orderId);
            conversation.setTitle(order.getOrderNumber());
            conversation = conversationRepository.save(conversation);
            order.setConversationId(conversation.getId());
            orderRepository.save(order);
        }
        syncMembers(conversation, order);
        return toConversationDto(conversation, order, null);
    }

    @Transactional
    public ConversationMessageDto sendMessage(Long conversationId, ConversationSendMessageRequest req) {
        ConversationMember member = requireMember(conversationId);
        String content = req.getContent();
        boolean hasContent = StringUtils.hasText(content);
        boolean hasFiles = req.getFileIds() != null && !req.getFileIds().isEmpty();
        if (!hasContent && !hasFiles) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "消息内容不能为空");
        }
        ConversationMessage message = new ConversationMessage();
        message.setConversationId(conversationId);
        message.setSenderType(member.getAccountType());
        message.setSenderId(member.getAccountId());
        message.setRole(member.getRole());
        message.setMsgType(StringUtils.hasText(req.getMsgType()) ? req.getMsgType() : "text");
        message.setContent(content);
        message.setFileIdsJson(serializeFileIds(req.getFileIds()));
        message = messageRepository.save(message);

        List<ConversationMember> members = memberRepository.findByConversationIdOrderByJoinedAtAsc(conversationId);
        ConversationMessageDto dto = toMessageDto(message, null);
        socketService.broadcast(members, "MESSAGE", dto);
        // 异步预翻译并推送翻译完成事件
        if (StringUtils.hasText(content)) {
            translationService.preTranslateAsync(message.getId(), content, conversationId);
        }
        return dto;
    }

    @Transactional(readOnly = true)
    public List<ConversationMessageDto> listMessages(Long conversationId) {
        requireMember(conversationId);
        String viewerLang = resolveViewerLang();
        return messageRepository.findByConversationIdOrderByIdAsc(conversationId).stream()
                .map(m -> toMessageDto(m, viewerLang))
                .toList();
    }

    @Transactional
    public ConversationMessageDto translateMessage(Long messageId, String targetLang) {
        ConversationMessage message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "消息不存在"));
        requireMember(message.getConversationId());
        String lang = StringUtils.hasText(targetLang) ? targetLang.trim() : resolveViewerLang();
        return toMessageDto(message, lang);
    }

    @Transactional(readOnly = true)
    public List<ConversationMemberDto> listMembers(Long conversationId) {
        requireMember(conversationId);
        return memberRepository.findByConversationIdOrderByJoinedAtAsc(conversationId).stream()
                .map(this::toMemberDto)
                .toList();
    }

    @Transactional
    public void markRead(Long conversationId) {
        ConversationMember member = requireMember(conversationId);
        messageRepository.findTopByConversationIdOrderByIdDesc(conversationId).ifPresent(latest -> {
            member.setLastReadMessageId(latest.getId());
            memberRepository.save(member);
        });
    }

    /**
     * 将订单事件卡片以系统消息形式推送到对应聊天室（若存在），供群内成员看到关键节点。
     */
    @Transactional
    public void pushEventMessage(Long orderId, Long eventId, String content) {
        conversationRepository.findByOrderId(orderId).ifPresent(conversation -> {
            ConversationMessage message = new ConversationMessage();
            message.setConversationId(conversation.getId());
            message.setSenderType(AccountKind.STAFF);
            message.setSenderId(0L);
            message.setRole("SYSTEM");
            message.setMsgType("event");
            message.setContent(content);
            message.setEventId(eventId);
            message = messageRepository.save(message);
            List<ConversationMember> members = memberRepository.findByConversationIdOrderByJoinedAtAsc(conversation.getId());
            socketService.broadcast(members, "MESSAGE", toMessageDto(message, null));
        });
    }

    @Transactional(readOnly = true)
    public List<ConversationDto> listMyConversations() {
        SecurityUserPrincipal principal = currentPrincipal();
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

    private ConversationMember requireMember(Long conversationId) {
        SecurityUserPrincipal principal = currentPrincipal();
        return memberRepository.findByConversationIdAndAccountTypeAndAccountId(
                        conversationId, principal.getAccountKind(), principal.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "您不是该会话的成员"));
    }

    private SecurityUserPrincipal currentPrincipal() {
        return SecurityUtils.currentPrincipal()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
    }

    private ConversationDto toConversationDto(OrderConversation conversation, Order order, ConversationMember self) {
        long unread = 0;
        String lastMessage = null;
        Long lastReadId = self != null ? self.getLastReadMessageId() : 0L;
        var latest = messageRepository.findTopByConversationIdOrderByIdDesc(conversation.getId()).orElse(null);
        if (latest != null) {
            lastMessage = latest.getContent();
            if (lastReadId == null) {
                lastReadId = 0L;
            }
            unread = messageRepository.countByConversationIdAndIdGreaterThan(conversation.getId(), lastReadId);
        }
        return ConversationDto.builder()
                .id(conversation.getId())
                .orderId(conversation.getOrderId())
                .orderNumber(order != null ? order.getOrderNumber() : null)
                .title(conversation.getTitle())
                .lastMessage(lastMessage)
                .lastMessageAt(latest != null ? latest.getCreatedAt() : null)
                .unreadCount(unread)
                .createdAt(conversation.getCreatedAt())
                .build();
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
        return ConversationMessageDto.builder()
                .id(message.getId())
                .conversationId(message.getConversationId())
                .senderType(message.getSenderType().name())
                .senderId(message.getSenderId())
                .role(message.getRole())
                .displayName(resolveDisplayName(message.getSenderType(), message.getSenderId()))
                .msgType(message.getMsgType())
                .content(content)
                .translatedContent(translated)
                .translatedLang(translatedLang)
                .fileIds(parseFileIds(message.getFileIdsJson()))
                .eventId(message.getEventId())
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
