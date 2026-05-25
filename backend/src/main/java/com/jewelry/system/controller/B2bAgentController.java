package com.jewelry.system.controller;

import com.jewelry.system.dto.b2b.agent.B2bAgentChatResponse;
import com.jewelry.system.dto.b2b.agent.B2bAgentSessionDto;
import com.jewelry.system.service.B2bAgentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;

@RestController
@RequestMapping("/b2b/agent")
@Tag(name = "B2B Agent", description = "B端门户智能引导录入")
public class B2bAgentController {

    private final B2bAgentService agentService;
    private final Executor b2bAgentExecutor;

    public B2bAgentController(B2bAgentService agentService,
                                @Qualifier("b2bAgentExecutor") Executor b2bAgentExecutor) {
        this.agentService = agentService;
        this.b2bAgentExecutor = b2bAgentExecutor;
    }

    @GetMapping("/welcome")
    @Operation(summary = "获取欢迎语（不落库、不创建会话）")
    public ResponseEntity<Map<String, String>> welcome() {
        return ResponseEntity.ok(Map.of("message", agentService.getWelcomeMessage()));
    }

    @PostMapping("/sessions")
    @Operation(summary = "创建 Agent 会话（空会话，首条用户消息前不落库欢迎语）")
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
    @Operation(summary = "发送消息（异步执行大模型，不长期占用 Tomcat 工作线程）")
    public CompletableFuture<ResponseEntity<B2bAgentChatResponse>> sendMessage(
            @PathVariable long id,
            @RequestHeader(value = "X-B2B-Agent-Session-Token", required = false) String publicToken,
            @RequestPart(value = "text", required = false) String text,
            @RequestPart(value = "image", required = false) MultipartFile image,
            @RequestPart(value = "images", required = false) List<MultipartFile> images) {
        return CompletableFuture.supplyAsync(
                () -> ResponseEntity.ok(agentService.sendMessage(id, publicToken, text, image, images)),
                b2bAgentExecutor);
    }

    @PostMapping(value = "/speech-to-text", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "语音转文字（通义千问 ASR）")
    public ResponseEntity<Map<String, String>> speechToText(
            @RequestPart("audio") MultipartFile audio) {
        return ResponseEntity.ok(agentService.speechToText(audio));
    }

    @PostMapping("/sessions/{id}/commit")
    @Operation(summary = "确认创建工单")
    public CompletableFuture<ResponseEntity<B2bAgentChatResponse>> commit(
            @PathVariable long id,
            @RequestHeader(value = "X-B2B-Agent-Session-Token", required = false) String publicToken) {
        return CompletableFuture.supplyAsync(
                () -> ResponseEntity.ok(agentService.commit(id, publicToken)),
                b2bAgentExecutor);
    }
}
