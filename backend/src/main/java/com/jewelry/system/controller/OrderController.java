package com.jewelry.system.controller;

import com.jewelry.system.dto.customer.CustomerProgressLinkResponseDto;
import com.jewelry.system.dto.order.*;
import com.jewelry.system.service.*;
import com.jewelry.system.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
@Tag(name = "订单与配置", description = "订单全生命周期与系统价格/材质/工艺配置")
public class OrderController {

    private final OrderQueryService orderQueryService;
    private final OrderCommandService orderCommandService;
    private final OrderConfigurationService orderConfigurationService;
    private final OrderStatisticsService orderStatisticsService;
    private final EmployeeStatisticsService employeeStatisticsService;
    private final OrderFileService orderFileService;
    private final OrderExportService orderExportService;
    private final DashScopeChatImageDraftService dashScopeChatImageDraftService;
    private final CustomerOrderViewService customerOrderViewService;

    @GetMapping
    @Operation(summary = "订单分页列表")
    public Page<OrderInfoDto> listOrders(
            Pageable pageable,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long designerId,
            @RequestParam(required = false) Long modelerId,
            @RequestParam(required = false) Long salesId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate
    ) {
        return orderQueryService.pageOrders(pageable, keyword, status, designerId, modelerId, salesId, startDate, endDate);
    }

    // ================= 工作台接口 =================

    @GetMapping("/workbench/designer/todo")
    @Operation(summary = "设计师工作台-待办")
    public Page<OrderInfoDto> designerTodo(Pageable pageable, @RequestParam(required = false) Boolean isB2b) {
        Long uid = SecurityUtils.currentUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        return orderQueryService.pageDesignerTodo(pageable, uid, isB2b);
    }

    @GetMapping("/workbench/designer/done")
    @Operation(summary = "设计师工作台-已完成")
    public Page<OrderInfoDto> designerDone(Pageable pageable, @RequestParam(required = false) Boolean isB2b) {
        Long uid = SecurityUtils.currentUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        return orderQueryService.pageDesignerDone(pageable, uid, isB2b);
    }

    @GetMapping("/workbench/modeler/todo")
    @Operation(summary = "建模师工作台-待办")
    public Page<OrderInfoDto> modelerTodo(Pageable pageable, @RequestParam(required = false) Boolean isB2b) {
        Long uid = SecurityUtils.currentUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        return orderQueryService.pageModelerTodo(pageable, uid, isB2b);
    }

    @GetMapping("/workbench/modeler/done")
    @Operation(summary = "建模师工作台-已完成")
    public Page<OrderInfoDto> modelerDone(Pageable pageable, @RequestParam(required = false) Boolean isB2b) {
        Long uid = SecurityUtils.currentUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        return orderQueryService.pageModelerDone(pageable, uid, isB2b);
    }

    @GetMapping("/workbench/tracker/todo")
    @Operation(summary = "跟单员工作台-待评审")
    public Page<OrderInfoDto> trackerTodo(Pageable pageable, @RequestParam(required = false) Boolean isB2b) {
        Long uid = SecurityUtils.currentUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        return orderQueryService.pageTrackerTodo(pageable, uid, isB2b);
    }

    @GetMapping("/workbench/tracker/done")
    @Operation(summary = "跟单员工作台-已完成")
    public Page<OrderInfoDto> trackerDone(Pageable pageable, @RequestParam(required = false) Boolean isB2b) {
        Long uid = SecurityUtils.currentUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        return orderQueryService.pageTrackerDone(pageable, uid, isB2b);
    }

    @GetMapping("/{id:\\d+}")
    @Operation(summary = "订单详情")
    public OrderInfoDto getOrder(@PathVariable long id) {
        return orderQueryService.getOrder(id);
    }

    @PostMapping("/{id:\\d+}/customer-progress-link")
    @Operation(summary = "生成或刷新 C 端客户进度查看链接（设计师/管理员）")
    public CustomerProgressLinkResponseDto createCustomerProgressLink(@PathVariable long id) {
        return customerOrderViewService.createOrRefreshLink(id);
    }

    @PostMapping(value = "/{id:\\d+}/customer-progress/card", produces = MediaType.IMAGE_PNG_VALUE)
    @Operation(summary = "下载 C 端客户进度「小名片」PNG（设计师/管理员）")
    public ResponseEntity<byte[]> downloadCustomerProgressCard(@PathVariable long id) throws IOException {
        byte[] png = customerOrderViewService.renderShareCardPng(id);
        String filename = "order-" + id + "-customer-card.png";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.IMAGE_PNG)
                .body(png);
    }

    @PostMapping
    @Operation(summary = "创建订单")
    public OrderInfoDto create(@Valid @RequestBody OrderCreateRequestDto body) {
        return orderCommandService.create(body);
    }

    @PostMapping(value = "/draft-from-chat-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传聊天截图，通义千问识别并返回订单草稿字段（需管理员配置 API）")
    public OrderDraftFromChatImageResponse draftFromChatImage(@RequestPart("file") MultipartFile file) throws IOException {
        String role = SecurityUtils.currentRoleApi().orElse("");
        if (!"ADMIN".equals(role) && !"PRE_SALES".equals(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员或售前客服可使用识图填单");
        }
        return dashScopeChatImageDraftService.draftFromImage(file);
    }

    @PutMapping("/{id:\\d+}")
    @Operation(summary = "更新订单基本信息")
    public OrderInfoDto update(@PathVariable long id, @RequestBody OrderUpdateRequestDto body) {
        return orderCommandService.update(id, body);
    }

    @DeleteMapping("/{id:\\d+}")
    @Operation(summary = "删除订单")
    public void delete(@PathVariable long id) {
        orderCommandService.delete(id);
    }

    @DeleteMapping("/batch")
    @Operation(summary = "批量删除订单")
    public void deleteBatch(@Valid @RequestBody OrderBatchDeleteRequest body) {
        orderCommandService.deleteBatch(body.getOrderIds());
    }

    @PutMapping("/{id:\\d+}/design")
    @Operation(summary = "更新设计信息")
    public OrderInfoDto updateDesign(@PathVariable long id, @RequestBody OrderDesignUpdateRequest body) {
        return orderCommandService.updateDesign(id, body);
    }

    @PutMapping("/{id:\\d+}/model")
    @Operation(summary = "更新建模信息")
    public OrderInfoDto updateModel(@PathVariable long id, @RequestBody OrderModelUpdateRequest body) {
        return orderCommandService.updateModel(id, body);
    }

    @PutMapping("/{id:\\d+}/review")
    @Operation(summary = "更新工艺评审")
    public OrderInfoDto updateReview(@PathVariable long id, @RequestBody OrderReviewUpdateRequest body) {
        return orderCommandService.updateReview(id, body);
    }

    @PutMapping("/{id:\\d+}/quotation")
    @Operation(summary = "更新报价")
    public OrderInfoDto updateQuotation(@PathVariable long id, @RequestBody OrderQuotationUpdateRequest body) {
        return orderCommandService.updateQuotation(id, body);
    }

    @PutMapping("/{id:\\d+}/status")
    @Operation(summary = "变更订单状态")
    public OrderInfoDto changeStatus(@PathVariable long id, @Valid @RequestBody OrderStatusChangeRequest body) {
        return orderCommandService.changeStatus(id, body);
    }

    @PutMapping("/{id:\\d+}/assign")
    @Operation(summary = "分配订单人员")
    public OrderInfoDto assign(@PathVariable long id, @RequestBody OrderAssignRequest body) {
        return orderCommandService.assign(id, body);
    }

    @PostMapping("/{id:\\d+}/copy")
    @Operation(summary = "复制订单")
    public OrderInfoDto copyOrder(@PathVariable long id) {
        return orderCommandService.copyOrder(id);
    }

    @GetMapping("/statistics")
    @Operation(summary = "订单统计")
    public OrderStatisticsDto statistics() {
        return orderStatisticsService.statistics();
    }

    @GetMapping("/search")
    @Operation(summary = "搜索订单")
    public List<OrderInfoDto> search(
            @RequestParam String keyword,
            @RequestParam(defaultValue = "10") int limit
    ) {
        return orderQueryService.search(keyword, limit);
    }

    @GetMapping("/pending-counts")
    @Operation(summary = "待处理数量")
    public PendingCountsDto pendingCounts() {
        return orderCommandService.pendingCounts();
    }

    @GetMapping("/week-processed")
    @Operation(summary = "本周处理概况")
    public WeekProcessedDto weekProcessed() {
        return orderCommandService.weekProcessed();
    }

    @GetMapping("/employee-statistics")
    @Operation(summary = "员工工作统计（管理员）")
    public List<EmployeeWorkStatisticsDto> employeeStatistics(@RequestParam(required = false) Long employeeId) {
        if (!"ADMIN".equals(SecurityUtils.currentRoleApi().orElse(null))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可查看员工统计");
        }
        return employeeStatisticsService.list(employeeId);
    }

    @GetMapping("/generate-order-number")
    @Operation(summary = "生成新订单编号")
    public String generateOrderNumber() {
        return orderCommandService.generateOrderNumber();
    }

    @PostMapping("/export")
    @Operation(summary = "导出订单 CSV")
    public ResponseEntity<byte[]> export(@RequestBody OrderExportRequest body) {
        byte[] csv = orderCommandService.exportCsv(body != null ? body.getOrderIds() : null);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=orders.csv")
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .body(csv);
    }

    @GetMapping("/{id:\\d+}/export")
    @Operation(summary = "导出单个订单 Markdown 工单")
    public ResponseEntity<byte[]> exportOne(@PathVariable long id) {
        byte[] md = orderExportService.exportOrderMarkdown(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=order-" + id + ".md")
                .contentType(MediaType.parseMediaType("text/markdown;charset=UTF-8"))
                .body(md);
    }

    @GetMapping("/{id:\\d+}/export-html")
    @Operation(summary = "导出单个订单 HTML 工单")
    public ResponseEntity<byte[]> exportOneHtml(@PathVariable long id) {
        byte[] html = orderExportService.exportOrderHtml(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=order-" + id + ".html")
                .contentType(MediaType.parseMediaType("text/html;charset=UTF-8"))
                .body(html);
    }

    @PostMapping("/export-files")
    @Operation(summary = "批量导出订单文件（未实现）")
    public void exportFiles() {
        throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "批量导出文件尚未实现");
    }

    @PostMapping("/calculate-material-price")
    @Operation(summary = "估算材质价格")
    public double calculateMaterialPrice(@RequestBody Map<String, Object> body) {
        String mt = body.get("materialType") != null ? body.get("materialType").toString() : "";
        double base = body.get("basePrice") instanceof Number n ? n.doubleValue() : 0d;
        return orderCommandService.calculateMaterialPrice(mt, base);
    }

    @PostMapping("/validate")
    @Operation(summary = "校验订单数据（占位）")
    public Map<String, Object> validate(@RequestBody Map<String, Object> body) {
        return Map.of("valid", true, "errors", List.of());
    }

    @PostMapping("/merge")
    @Operation(summary = "合并订单（未实现）")
    public void merge() {
        throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "合并订单尚未实现");
    }

    @PostMapping("/{id:\\d+}/split")
    @Operation(summary = "拆分订单（未实现）")
    public void split(@PathVariable long id) {
        throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "拆分订单尚未实现");
    }

    @GetMapping("/reminders")
    @Operation(summary = "订单提醒（占位）")
    public Page<Map<String, Object>> reminders(Pageable pageable) {
        return Page.empty(pageable);
    }

    @PutMapping("/reminders/{rid:\\d+}/read")
    @Operation(summary = "标记提醒已读（占位）")
    public void markReminderRead(@PathVariable long rid) {
        // no-op
    }

    @PutMapping("/reminders/batch-read")
    @Operation(summary = "批量标记提醒已读（占位）")
    public void markRemindersRead(@RequestBody Map<String, Object> body) {
        // no-op
    }

    @GetMapping("/{id:\\d+}/operation-logs")
    @Operation(summary = "订单操作日志（占位）")
    public Page<Map<String, Object>> operationLogs(@PathVariable long id, Pageable pageable) {
        return Page.empty(pageable);
    }

    @GetMapping("/{id:\\d+}/files")
    @Operation(summary = "订单关联文件列表")
    public List<FileInfoDto> listOrderFiles(@PathVariable long id, @RequestParam(required = false) String fileType) {
        return orderFileService.listForOrder(id);
    }

    @PostMapping(value = "/{id:\\d+}/design/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传设计文件")
    public FileInfoDto uploadDesignFile(
            @PathVariable long id,
            @RequestPart("file") MultipartFile file,
            @RequestParam(required = false) String notes
    ) throws IOException {
        return orderFileService.uploadDesignFile(id, file, notes);
    }

    @PostMapping(value = "/{id:\\d+}/model/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传建模文件")
    public FileInfoDto uploadModelFile(
            @PathVariable long id,
            @RequestPart("file") MultipartFile file,
            @RequestParam(required = false) String notes
    ) throws IOException {
        return orderFileService.uploadModelFile(id, file, notes);
    }

    @PostMapping(value = "/{id:\\d+}/model/effect-files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传建模效果图（图片）")
    public FileInfoDto uploadModelEffectFile(
            @PathVariable long id,
            @RequestPart("file") MultipartFile file,
            @RequestParam(required = false) String notes
    ) throws IOException {
        return orderFileService.uploadModelEffectImage(id, file, notes);
    }

    @PostMapping("/{id:\\d+}/modeler/reject-to-designer")
    @Operation(summary = "建模师驳回给设计师（说明 + 可选附件文件 ID），订单进入设计中")
    public OrderInfoDto modelerRejectToDesigner(
            @PathVariable long id,
            @Valid @RequestBody ModelerRejectToDesignerRequest body
    ) {
        return orderCommandService.modelerRejectToDesigner(id, body);
    }

    @PostMapping("/{id:\\d+}/modeler/reject-to-customer")
    @Operation(summary = "建模师驳回给客户（占位，未实现）")
    public void modelerRejectToCustomer(@PathVariable long id) {
        orderCommandService.modelerRejectToCustomerStub(id);
    }

    @GetMapping("/system-config")
    @Operation(summary = "系统价格配置（设计买断、证书、金银加价）")
    public OrderSystemConfigDto getSystemConfig() {
        return orderConfigurationService.getOrderSystemConfig();
    }

    @PutMapping("/system-config")
    @Operation(summary = "更新系统价格配置")
    public OrderSystemConfigDto updateSystemConfig(@RequestBody Map<String, Object> body) {
        return orderConfigurationService.updateOrderSystemConfig(body);
    }

    @GetMapping("/material-config")
    @Operation(summary = "材质配置列表")
    public List<MaterialConfigItemDto> getMaterialConfig() {
        return orderConfigurationService.listMaterials();
    }

    @PutMapping("/material-config")
    @Operation(summary = "保存材质配置（全量替换）")
    public List<MaterialConfigItemDto> updateMaterialConfig(@RequestBody List<MaterialConfigItemDto> body) {
        return orderConfigurationService.saveMaterials(body);
    }

    @GetMapping("/process-config")
    @Operation(summary = "工艺配置列表")
    public List<ProcessConfigItemDto> getProcessConfig() {
        return orderConfigurationService.listProcesses();
    }

    @PutMapping("/process-config")
    @Operation(summary = "保存工艺配置（全量替换）")
    public List<ProcessConfigItemDto> updateProcessConfig(@RequestBody List<ProcessConfigItemDto> body) {
        return orderConfigurationService.saveProcesses(body);
    }
}
