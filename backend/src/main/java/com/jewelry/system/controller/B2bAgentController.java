package com.jewelry.system.controller;

import com.jewelry.system.dto.b2b.agent.B2bAgentChatResponse;
import com.jewelry.system.dto.b2b.agent.B2bAgentSessionDto;
import com.jewelry.system.service.B2bAgentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/b2b/agent")
@RequiredArgsConstructor
@Tag(name = "B2B Agent", description = "B端门户智能引导录入")
public class B2bAgentController {

    private final B2bAgentService agentService;

    @PostMapping("/sessions")
    @Operation(summary = "创建新 Agent 会话")
    public ResponseEntity<B2bAgentSessionDto> createSession() {
        return ResponseEntity.ok(agentService.createSession());
    }

    @GetMapping("/sessions")
    @Operation(summary = "历史会话列表（只读）")
    public ResponseEntity<List<B2bAgentSessionDto>> listSessions() {
        return ResponseEntity.ok(agentService.listHistory());
    }

    @GetMapping("/sessions/{id}")
    @Operation(summary = "获取会话详情与消息")
    public ResponseEntity<B2bAgentSessionDto> getSession(
            @PathVariable long id,
            @RequestHeader(value = "X-B2B-Agent-Session-Token", required = false) String publicToken) {
        return ResponseEntity.ok(agentService.getSession(id, publicToken));
    }

    @PostMapping("/sessions/{id}/bind")
    @Operation(summary = "登录后会话绑定客户")
    public ResponseEntity<B2bAgentSessionDto> bind(
            @PathVariable long id,
            @RequestHeader(value = "X-B2B-Agent-Session-Token", required = false) String publicToken) {
        return ResponseEntity.ok(agentService.bindSession(id, publicToken));
    }

    @PostMapping(value = "/sessions/{id}/messages", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "发送消息（文本/图片）")
    public ResponseEntity<B2bAgentChatResponse> sendMessage(
            @PathVariable long id,
            @RequestHeader(value = "X-B2B-Agent-Session-Token", required = false) String publicToken,
            @RequestPart(value = "text", required = false) String text,
            @RequestPart(value = "image", required = false) MultipartFile image) {
        return ResponseEntity.ok(agentService.sendMessage(id, publicToken, text, image));
    }

    @PostMapping("/sessions/{id}/commit")
    @Operation(summary = "确认创建工单")
    public ResponseEntity<B2bAgentChatResponse> commit(
            @PathVariable long id,
            @RequestHeader(value = "X-B2B-Agent-Session-Token", required = false) String publicToken) {
        return ResponseEntity.ok(agentService.commit(id, publicToken));
    }
}
