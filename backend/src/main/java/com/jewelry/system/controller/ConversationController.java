package com.jewelry.system.controller;

import com.jewelry.system.dto.conversation.*;
import com.jewelry.system.service.ConversationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/conversations")
@RequiredArgsConstructor
@Tag(name = "站内聊天", description = "订单聊天室、消息与已读回执")
public class ConversationController {

    private final ConversationService conversationService;

    @PostMapping("/by-order/{orderId}")
    @Operation(summary = "按订单获取或创建聊天室")
    public ResponseEntity<ConversationDto> ensureByOrder(@PathVariable Long orderId) {
        return ResponseEntity.ok(conversationService.ensureConversationByOrder(orderId));
    }

    @GetMapping
    @Operation(summary = "我的会话列表")
    public ResponseEntity<List<ConversationDto>> listMyConversations() {
        return ResponseEntity.ok(conversationService.listMyConversations());
    }

    @GetMapping("/{conversationId}/messages")
    @Operation(summary = "会话消息列表")
    public ResponseEntity<List<ConversationMessageDto>> listMessages(
            @PathVariable Long conversationId,
            @RequestParam(defaultValue = "false") boolean includeAll) {
        return ResponseEntity.ok(conversationService.listMessages(conversationId, includeAll));
    }

    @GetMapping("/{conversationId}/members")
    @Operation(summary = "会话成员列表")
    public ResponseEntity<List<ConversationMemberDto>> listMembers(@PathVariable Long conversationId) {
        return ResponseEntity.ok(conversationService.listMembers(conversationId));
    }

    @PostMapping("/{conversationId}/messages")
    @Operation(summary = "发送消息")
    public ResponseEntity<ConversationMessageDto> sendMessage(
            @PathVariable Long conversationId,
            @RequestBody ConversationSendMessageRequest req) {
        return ResponseEntity.ok(conversationService.sendMessage(conversationId, req));
    }

    @PostMapping("/{conversationId}/read")
    @Operation(summary = "标记会话已读")
    public ResponseEntity<Void> markRead(@PathVariable Long conversationId) {
        conversationService.markRead(conversationId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/messages/{messageId}/translate")
    @Operation(summary = "按目标语言翻译单条消息（用于切换语言后刷新）")
    public ResponseEntity<ConversationMessageDto> translateMessage(
            @PathVariable Long messageId,
            @RequestBody MessageTranslateRequest req) {
        return ResponseEntity.ok(conversationService.translateMessage(messageId, req.getTargetLang()));
    }
}
