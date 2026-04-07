package com.jewelry.system.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.order.*;
import com.jewelry.system.entity.*;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.enums.ReviewResult;
import com.jewelry.system.repository.*;
import com.jewelry.system.util.OrderSourceMapper;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
@Service
@RequiredArgsConstructor
public class OrderCommandService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.BASIC_ISO_DATE;

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final OrderDetailRepository orderDetailRepository;
    private final DesignInfoRepository designInfoRepository;
    private final ModelingInfoRepository modelingInfoRepository;
    private final QuotationRepository quotationRepository;
    private final ProcessReviewRepository processReviewRepository;
    private final MaterialConfigRepository materialConfigRepository;
    private final ObjectMapper objectMapper;
    private final OrderQueryService orderQueryService;
    private final AuditLogService auditLogService;

    @Value("${app.order.number-prefix:JZ}")
    private String numberPrefix;

    @Transactional
    public OrderInfoDto create(OrderCreateRequestDto req) {
        Order o = new Order();
        try {
            o.setSource(OrderSourceMapper.fromApi(req.getSource()));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        o.setInfluencerName(req.getSourceDetail());
        o.setDeposit(req.getDepositAmount() != null ? req.getDepositAmount() : BigDecimal.ZERO);
        o.setBasicRequirements(req.getBasicRequirements());
        o.setStyleInfo(req.getStyle());
        o.setMaterialInfo(req.getMaterialInfo());
        o.setCustomerName(req.getCustomerName());
        applyContact(o, req.getCustomerContact());
        if (req.getCustomerWechat() != null && !req.getCustomerWechat().isBlank()) {
            o.setCustomerWechat(req.getCustomerWechat());
        }
        o.setOrderTime(LocalDateTime.parse(req.getOrderTime()));
        o.setOrderNumber(generateOrderNumber());
        o.setStatus(OrderStatus.PENDING_DESIGN);

        SecurityUtils.currentRoleApi().filter("PRE_SALES"::equals).flatMap(r -> SecurityUtils.currentUserId())
                .ifPresent(uid -> o.setSalesPre(userRepository.getReferenceById(uid)));

        orderRepository.save(o);
        auditLogService.log("ORDER_CREATE", "ORDER", o.getId(), "创建订单: " + o.getOrderNumber());
        return orderQueryService.getOrder(o.getId());
    }

    @Transactional
    public OrderInfoDto update(long id, OrderUpdateRequestDto req) {
        Order o = loadOrder(id);
        if (req.getSource() != null && !req.getSource().isBlank()) {
            try {
                o.setSource(OrderSourceMapper.fromApi(req.getSource()));
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
            }
        }
        if (req.getSourceDetail() != null) {
            o.setInfluencerName(req.getSourceDetail());
        }
        if (req.getDepositAmount() != null) {
            o.setDeposit(req.getDepositAmount());
        }
        if (req.getBasicRequirements() != null) {
            o.setBasicRequirements(req.getBasicRequirements());
        }
        if (req.getOrderTime() != null && !req.getOrderTime().isBlank()) {
            o.setOrderTime(LocalDateTime.parse(req.getOrderTime()));
        }
        if (req.getStyle() != null) {
            o.setStyleInfo(req.getStyle());
        }
        if (req.getMaterialInfo() != null) {
            o.setMaterialInfo(req.getMaterialInfo());
        }
        if (req.getCustomerContact() != null) {
            applyContact(o, req.getCustomerContact());
        }
        if (req.getCustomerName() != null) {
            o.setCustomerName(req.getCustomerName());
        }
        if (req.getCustomerWechat() != null) {
            o.setCustomerWechat(req.getCustomerWechat());
        }
        orderRepository.save(o);
        auditLogService.log("ORDER_UPDATE", "ORDER", o.getId(), "更新订单基本信息: " + o.getOrderNumber());
        return orderQueryService.getOrder(id);
    }

    @Transactional
    public void delete(long id) {
        if (!orderRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在");
        }
        orderRepository.deleteById(id);
        auditLogService.log("ORDER_DELETE", "ORDER", id, "删除订单 ID=" + id);
    }

    @Transactional
    public void deleteBatch(List<Long> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) {
            return;
        }
        orderRepository.deleteAllById(orderIds);
        auditLogService.log("ORDER_DELETE_BATCH", "ORDER", null, "批量删除订单: " + orderIds);
    }

    @Transactional
    public OrderInfoDto updateDesign(long orderId, OrderDesignUpdateRequest req) {
        Order order = loadOrder(orderId);
        OrderDetail od = orderDetailRepository.findByOrderId(orderId).orElseGet(() -> {
            OrderDetail d = new OrderDetail();
            d.setOrderId(orderId);
            return d;
        });
        if (req.getEngravingText() != null) {
            od.setEngravingText(req.getEngravingText());
        }
        if (req.getMaterialType() != null) {
            od.setMaterialType(req.getMaterialType());
        }
        if (req.getHandSize() != null) {
            od.setHandSize(req.getHandSize());
        }
        if (req.getDesignNotes() != null) {
            od.setDesignNotes(req.getDesignNotes());
        }
        if (req.getMaterialDetail() != null && !req.getMaterialDetail().isBlank()) {
            String base = od.getDesignNotes() != null ? od.getDesignNotes() : "";
            od.setDesignNotes(base + (base.isEmpty() ? "" : "\n") + "材质详情: " + req.getMaterialDetail());
        }
        orderDetailRepository.save(od);

        DesignInfo di = designInfoRepository.findByOrderId(orderId).orElseGet(() -> {
            DesignInfo d = new DesignInfo();
            d.setOrderId(orderId);
            return d;
        });
        if (req.getProcessInfo() != null) {
            di.setProcessInfoJson(toJson(req.getProcessInfo()));
        }
        if (req.getStoneInfo() != null) {
            di.setStoneInfoJson(toJson(req.getStoneInfo()));
        }
        designInfoRepository.save(di);

        if (req.getDesignerId() != null) {
            order.setDesigner(userRepository.getReferenceById(req.getDesignerId()));
        }
        orderRepository.save(order);
        auditLogService.log("ORDER_UPDATE_DESIGN", "ORDER", orderId, "更新设计信息");
        return orderQueryService.getOrder(orderId);
    }

    @Transactional
    public OrderInfoDto updateModel(long orderId, OrderModelUpdateRequest req) {
        Order order = loadOrder(orderId);
        ModelingInfo mi = modelingInfoRepository.findByOrderId(orderId).orElseGet(() -> {
            ModelingInfo m = new ModelingInfo();
            m.setOrderId(orderId);
            return m;
        });
        if (req.getWeight() != null) {
            mi.setWeight(BigDecimal.valueOf(req.getWeight()));
        }
        if (req.getModelNotes() != null) {
            mi.setModelNotes(req.getModelNotes());
        }
        modelingInfoRepository.save(mi);
        if (req.getModelerId() != null) {
            order.setModeler(userRepository.getReferenceById(req.getModelerId()));
        }
        orderRepository.save(order);
        auditLogService.log("ORDER_UPDATE_MODEL", "ORDER", orderId, "更新建模信息");
        return orderQueryService.getOrder(orderId);
    }

    @Transactional
    public OrderInfoDto updateReview(long orderId, OrderReviewUpdateRequest req) {
        Order order = loadOrder(orderId);
        long reviewerId = req.getTrackerId() != null
                ? req.getTrackerId()
                : SecurityUtils.currentUserId().orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        order.setFollowUp(userRepository.getReferenceById(reviewerId));
        orderRepository.save(order);

        boolean rejected = (req.getRejectionReason() != null && !req.getRejectionReason().isBlank())
                || (req.getRejectedProcesses() != null && !req.getRejectedProcesses().isEmpty());

        ProcessReview pr = new ProcessReview();
        pr.setOrderId(orderId);
        pr.setReviewerId(reviewerId);
        pr.setReviewResult(rejected ? ReviewResult.REJECTED : ReviewResult.PASSED);
        pr.setReviewNotes(req.getReviewNotes());
        pr.setRejectedReasons(req.getRejectionReason());
        if (req.getRejectedProcesses() != null && !req.getRejectedProcesses().isEmpty()) {
            try {
                pr.setDeletedProcessesJson(objectMapper.writeValueAsString(req.getRejectedProcesses()));
            } catch (JsonProcessingException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "工艺驳回列表序列化失败");
            }
        }
        pr.setReviewTime(LocalDateTime.now());
        processReviewRepository.save(pr);
        auditLogService.log("ORDER_UPDATE_REVIEW", "ORDER", orderId, "更新工艺评审信息");
        return orderQueryService.getOrder(orderId);
    }

    @Transactional
    public OrderInfoDto updateQuotation(long orderId, OrderQuotationUpdateRequest req) {
        loadOrder(orderId);
        Quotation q = quotationRepository.findByOrderId(orderId).orElseGet(() -> {
            Quotation n = new Quotation();
            n.setOrderId(orderId);
            return n;
        });
        double labor = nz(req.getLaborCost()) + nz(req.getProcessCost());
        double add = nz(req.getStoneCost()) + nz(req.getMaterialCost()) + nz(req.getWeightCost());
        q.setLaborCost(BigDecimal.valueOf(labor));
        q.setAdditionalLaborCost(BigDecimal.valueOf(add));
        q.setOtherFees(BigDecimal.valueOf(nz(req.getOtherCost())));
        q.setHasDesignCopyright(Boolean.TRUE.equals(req.getDesignBuyout()));
        q.setDesignCopyrightFee(BigDecimal.valueOf(nz(req.getDesignBuyoutCost())));
        double cert = nz(req.getCertificateCost());
        q.setHasAppraisalCertificate(cert > 0);
        q.setAppraisalCertificateFee(BigDecimal.valueOf(cert));
        q.setConfidential(Boolean.TRUE.equals(req.getConfidential()));
        q.setOtherNotes(req.getQuotationNotes());
        double total = nz(req.getTotalCost());
        if (total <= 0) {
            total = labor + add + nz(req.getOtherCost()) + nz(req.getDesignBuyoutCost()) + cert;
        }
        q.setSubtotal(BigDecimal.valueOf(total));
        q.setTotalAmount(BigDecimal.valueOf(total));
        quotationRepository.save(q);
        auditLogService.log("ORDER_UPDATE_QUOTATION", "ORDER", orderId, "更新报价信息");
        return orderQueryService.getOrder(orderId);
    }

    @Transactional
    public OrderInfoDto changeStatus(long orderId, OrderStatusChangeRequest req) {
        Order order = loadOrder(orderId);
        OrderStatus target = OrderStatus.fromString(req.getStatus());
        try {
            order.transitionTo(target);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        orderRepository.save(order);
        auditLogService.log("ORDER_CHANGE_STATUS", "ORDER", orderId, "变更状态为: " + target.name());
        return orderQueryService.getOrder(orderId);
    }

    @Transactional
    public OrderInfoDto assign(long orderId, OrderAssignRequest req) {
        Order order = loadOrder(orderId);
        if (req.getSalesId() != null) {
            order.setSalesMid(userRepository.getReferenceById(req.getSalesId()));
        }
        if (req.getDesignerId() != null) {
            order.setDesigner(userRepository.getReferenceById(req.getDesignerId()));
        }
        if (req.getModelerId() != null) {
            order.setModeler(userRepository.getReferenceById(req.getModelerId()));
        }
        if (req.getTrackerId() != null) {
            order.setFollowUp(userRepository.getReferenceById(req.getTrackerId()));
        }
        orderRepository.save(order);
        auditLogService.log("ORDER_ASSIGN", "ORDER", orderId, "分配人员: sales=" + req.getSalesId() + ", designer=" + req.getDesignerId() + ", modeler=" + req.getModelerId() + ", tracker=" + req.getTrackerId());
        return orderQueryService.getOrder(orderId);
    }

    @Transactional
    public OrderInfoDto copyOrder(long sourceId) {
        Order src = loadOrder(sourceId);
        Order neo = new Order();
        neo.setCustomerName(src.getCustomerName());
        neo.setCustomerPhone(src.getCustomerPhone());
        neo.setCustomerWechat(src.getCustomerWechat());
        neo.setSource(src.getSource());
        neo.setInfluencerName(src.getInfluencerName());
        neo.setDeposit(src.getDeposit());
        neo.setBasicRequirements(src.getBasicRequirements());
        neo.setStyleInfo(src.getStyleInfo());
        neo.setMaterialInfo(src.getMaterialInfo());
        neo.setOrderTime(LocalDateTime.now());
        neo.setSalesPre(src.getSalesPre());
        neo.setSalesMid(src.getSalesMid());
        neo.setDesigner(src.getDesigner());
        neo.setModeler(src.getModeler());
        neo.setFollowUp(src.getFollowUp());
        neo.setStatus(OrderStatus.PENDING_DESIGN);
        neo.setOrderNumber(generateOrderNumber());
        neo.setDesignCompletedTime(null);
        neo.setModelCompletedTime(null);
        neo.setReviewCompletedTime(null);
        neo.setProductionStartTime(null);
        neo.setProductionCompletedTime(null);
        neo.setCancelledTime(null);
        orderRepository.save(neo);

        orderDetailRepository.findByOrderId(sourceId).ifPresent(od -> {
            OrderDetail n = new OrderDetail();
            n.setOrderId(neo.getId());
            n.setEngravingText(od.getEngravingText());
            n.setMaterialType(od.getMaterialType());
            n.setMaterialWeight(od.getMaterialWeight());
            n.setMaterialUnitPrice(od.getMaterialUnitPrice());
            n.setMaterialTotalPrice(od.getMaterialTotalPrice());
            n.setHandSize(od.getHandSize());
            n.setChainLength(od.getChainLength());
            n.setDesignNotes(od.getDesignNotes());
            orderDetailRepository.save(n);
        });
        designInfoRepository.findByOrderId(sourceId).ifPresent(di -> {
            DesignInfo n = new DesignInfo();
            n.setOrderId(neo.getId());
            n.setProcessInfoJson(di.getProcessInfoJson());
            n.setStoneInfoJson(di.getStoneInfoJson());
            n.setDesignImagesJson(di.getDesignImagesJson());
            n.setCustomerApproved(di.getCustomerApproved());
            n.setApprovalTime(di.getApprovalTime());
            n.setApprovalNotes(di.getApprovalNotes());
            designInfoRepository.save(n);
        });
        modelingInfoRepository.findByOrderId(sourceId).ifPresent(mi -> {
            ModelingInfo n = new ModelingInfo();
            n.setOrderId(neo.getId());
            n.setWeight(mi.getWeight());
            n.setModelFilesJson(mi.getModelFilesJson());
            n.setModelNotes(mi.getModelNotes());
            n.setCustomerApproved(mi.getCustomerApproved());
            n.setApprovalTime(mi.getApprovalTime());
            n.setApprovalNotes(mi.getApprovalNotes());
            modelingInfoRepository.save(n);
        });
        quotationRepository.findByOrderId(sourceId).ifPresent(q -> {
            Quotation n = new Quotation();
            n.setOrderId(neo.getId());
            n.setLaborCost(q.getLaborCost());
            n.setAdditionalLaborCost(q.getAdditionalLaborCost());
            n.setHasDesignCopyright(q.getHasDesignCopyright());
            n.setDesignCopyrightFee(q.getDesignCopyrightFee());
            n.setHasAppraisalCertificate(q.getHasAppraisalCertificate());
            n.setAppraisalCertificateFee(q.getAppraisalCertificateFee());
            n.setConfidential(q.getConfidential());
            n.setOtherFees(q.getOtherFees());
            n.setOtherNotes(q.getOtherNotes());
            n.setSubtotal(q.getSubtotal());
            n.setTotalAmount(q.getTotalAmount());
            quotationRepository.save(n);
        });

        auditLogService.log("ORDER_COPY", "ORDER", neo.getId(), "从订单 " + sourceId + " 复制创建");
        return orderQueryService.getOrder(neo.getId());
    }

    public String generateOrderNumber() {
        String prefix = numberPrefix + LocalDate.now().format(DAY);
        long n = orderRepository.countByOrderNumberStartingWith(prefix);
        return prefix + String.format("%04d", n + 1);
    }

    public byte[] exportCsv(List<Long> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "orderIds 不能为空");
        }
        List<Order> list = orderRepository.findAllById(orderIds);
        StringBuilder sb = new StringBuilder();
        sb.append('\uFEFF');
        sb.append("订单编号,客户,联系方式,来源,状态,定金,创建时间\n");
        DateTimeFormatter iso = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
        for (Order o : list) {
            sb.append(csv(o.getOrderNumber()))
                    .append(',')
                    .append(csv(o.getCustomerName()))
                    .append(',')
                    .append(csv(firstNonBlank(o.getCustomerPhone(), o.getCustomerWechat())))
                    .append(',')
                    .append(o.getSource() != null ? o.getSource().name() : "")
                    .append(',')
                    .append(o.getStatus() != null ? o.getStatus().name() : "")
                    .append(',')
                    .append(o.getDeposit() != null ? o.getDeposit().toPlainString() : "0")
                    .append(',')
                    .append(o.getCreatedAt() != null ? iso.format(o.getCreatedAt()) : "")
                    .append('\n');
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) {
            return a;
        }
        if (b != null && !b.isBlank()) {
            return b;
        }
        return "";
    }

    private static String csv(String s) {
        if (s == null) {
            return "";
        }
        String x = s.replace("\"", "\"\"");
        if (x.contains(",") || x.contains("\"") || x.contains("\n")) {
            return "\"" + x + "\"";
        }
        return x;
    }

    public PendingCountsDto pendingCounts() {
        PendingCountsDto d = new PendingCountsDto();
        long pd = orderRepository.countByStatus(OrderStatus.PENDING_DESIGN) + orderRepository.countByStatus(OrderStatus.DESIGNING);
        long pm = orderRepository.countByStatus(OrderStatus.PENDING_MODEL) + orderRepository.countByStatus(OrderStatus.MODELING);
        long pr = orderRepository.countByStatus(OrderStatus.PENDING_REVIEW);
        long pq = 0;
        long pp = orderRepository.countByStatus(OrderStatus.PENDING_PRODUCTION) + orderRepository.countByStatus(OrderStatus.PRODUCING);
        d.setPendingDesign(pd);
        d.setPendingModel(pm);
        d.setPendingReview(pr);
        d.setPendingQuotation(pq);
        d.setPendingProduction(pp);
        d.setTotalPending(pd + pm + pr + pq + pp);
        return d;
    }

    public WeekProcessedDto weekProcessed() {
        LocalDateTime weekStart = LocalDate.now()
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .atStartOfDay();
        long completed = orderRepository.countByStatusAndUpdatedAtAfter(OrderStatus.COMPLETED, weekStart);
        WeekProcessedDto d = new WeekProcessedDto();
        d.setProcessedOrders(completed);
        d.setCompletedOrders(completed);
        d.setAverageProcessingTime(0);
        return d;
    }

    public double calculateMaterialPrice(String materialType, double basePrice) {
        if (materialType == null || materialType.isBlank()) {
            return basePrice * 1.035;
        }
        return materialConfigRepository.findByMaterialCode(materialType.trim())
                .map(e -> estimateFromFormula(e.getPriceFormula(), basePrice))
                .orElse(basePrice * 1.035);
    }

    private static double estimateFromFormula(String formula, double base) {
        if (formula == null || formula.isBlank()) {
            return base * 1.035;
        }
        String f = formula.replace(" ", "");
        if (f.contains("1.035")) {
            return base * 1.035;
        }
        if (f.contains("1.05")) {
            return base * 1.05;
        }
        if (f.contains("1.08")) {
            return base * 1.08;
        }
        if (f.contains("+10")) {
            return base + 10;
        }
        return base * 1.035;
    }

    private Order loadOrder(long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
    }

    private static void applyContact(Order order, String contact) {
        if (contact == null || contact.isBlank()) {
            return;
        }
        String c = contact.trim();
        if (c.matches("^[\\d\\-\\s+]{5,20}$")) {
            order.setCustomerPhone(c.replaceAll("\\s", ""));
        } else {
            order.setCustomerWechat(c);
        }
    }

    private String toJson(Object o) {
        try {
            return objectMapper.writeValueAsString(o);
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "JSON 序列化失败");
        }
    }

    private static double nz(Double d) {
        return d != null ? d : 0;
    }
}
