package com.jewelry.system.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.order.*;
import com.jewelry.system.entity.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import com.jewelry.system.enums.FileRelatedType;
import com.jewelry.system.enums.OrderEventType;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.enums.ServiceType;
import com.jewelry.system.enums.ProductionProcess;
import com.jewelry.system.enums.ReviewKind;
import com.jewelry.system.enums.ReviewResult;
import com.jewelry.system.enums.UserRole;
import com.jewelry.system.enums.UserStatus;
import com.jewelry.system.repository.*;
import com.jewelry.system.security.AccountKind;
import com.jewelry.system.util.OrderSourceMapper;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class OrderCommandService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.BASIC_ISO_DATE;
    static final String DESIGN_ADJUST_NOTICE =
            "为满足生产工艺要求，我们对设计做了一定的调整，需要您确认新的设计是否符合您的预期。";
    static final String MODEL_ADJUST_NOTICE =
            "为满足生产工艺要求，我们对建模做了一定的调整，需要您确认新的建模是否符合您的预期。";

    private final OrderRepository orderRepository;
    private final EntityManager entityManager;
    private final FileEntityRepository fileEntityRepository;
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
    private final AutoAssignmentService autoAssignmentService;
    private final WeComCustomerGroupService weComCustomerGroupService;
    private final SensitiveOperationService sensitiveOperationService;
    private final OrderEventService orderEventService;
    private final OrderEventRepository orderEventRepository;
    private final ConversationService conversationService;
    private final StorefrontWalletService storefrontWalletService;
    private final ReferralService referralService;
    private final OrderPieceRepository orderPieceRepository;
    private final OrderProductionFollowLogRepository productionFollowLogRepository;
    private final OrderPieceService orderPieceService;
    private final DesignVersionService designVersionService;
    private final ModelVersionService modelVersionService;
    private final OrderQueueService orderQueueService;
    private final FulfillmentDispatchService fulfillmentDispatchService;
    private final OrderConfigurationService orderConfigurationService;
    private final CustomerOrderBriefService customerOrderBriefService;

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
        o.setOrderTime(parseOrderTime(req.getOrderTime()));
        o.setOrderNumber(generateOrderNumber());
        o.setStatus(OrderStatus.PENDING_DESIGN);
        orderQueueService.enterQueue(o);

        SecurityUtils.currentRoleApi().filter("PRE_SALES"::equals).flatMap(r -> SecurityUtils.currentStaffUserId())
                .ifPresent(uid -> o.setSalesPre(userRepository.getReferenceById(uid)));

        orderRepository.save(o);
        orderPieceService.ensureDefaultPiece(o.getId());

        // 自动分配所有成员
        autoAssignmentService.autoAssignAll(o.getId());
        
        auditLogService.log("ORDER_CREATE", "ORDER", o.getId(), "创建订单: " + o.getOrderNumber());

        Long newOrderId = o.getId();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    weComCustomerGroupService.scheduleAfterOrderCreated(newOrderId);
                }
            });
        } else {
            weComCustomerGroupService.scheduleAfterOrderCreated(newOrderId);
        }

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
            o.setOrderTime(parseOrderTime(req.getOrderTime()));
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
        assertCanEditDesign(order);
        assertReassignDesigner(order, req.getDesignerId());
        OrderPiece piece = orderPieceService.requirePiece(orderId, req.getPieceId());
        OrderDetail existingDetail = orderDetailRepository.findByOrderId(orderId).orElse(null);
        DesignInfo existingDesign = designInfoRepository.findByPieceId(piece.getId()).orElse(null);

        boolean hasDesignImages = req.getDesignImages() != null && !req.getDesignImages().isEmpty();
        boolean submitToTracker = Boolean.TRUE.equals(req.getSubmitToTracker());
        boolean submitToModeler = Boolean.TRUE.equals(req.getSubmitToModeler()) && !submitToTracker;
        boolean submitToCustomer = Boolean.TRUE.equals(req.getSubmitToCustomer())
                && !submitToTracker
                && !submitToModeler;
        if (Boolean.TRUE.equals(req.getSubmitToCustomer()) && submitToModeler) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不能同时提交客户和建模师");
        }
        if (submitToTracker && (Boolean.TRUE.equals(req.getSubmitToCustomer()) || Boolean.TRUE.equals(req.getSubmitToModeler()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "提交跟单评审时不能同时提交客户或建模师");
        }
        boolean pieceRework = isPieceDesignRework(piece.getId());
        boolean confirmed = Boolean.TRUE.equals(piece.getDesignConfirmed());
        boolean imagesDiffer = imageListDiffers(
                existingDesign != null ? existingDesign.getDesignImagesJson() : null,
                req.getDesignImages());
        boolean engravingImagesDiffer = imageListDiffers(
                existingDetail != null ? existingDetail.getEngravingImagesJson() : null,
                req.getEngravingImages());
        boolean notesDiffer = textDiffers(
                existingDetail != null ? existingDetail.getDesignNotes() : null, req.getDesignNotes())
                || (req.getMaterialDetail() != null && !req.getMaterialDetail().isBlank());
        boolean engravingDiffer = textDiffers(
                existingDetail != null ? existingDetail.getEngravingText() : null, req.getEngravingText());
        if (confirmed && submitToCustomer && !pieceRework && (imagesDiffer || engravingImagesDiffer || notesDiffer || engravingDiffer)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "「" + pieceLabel(piece) + "」客户已确认，提交给客户时不能修改该件，也不会再次发送。请只修改未确认的单件。");
        }
        if (confirmed && !pieceRework && !submitToCustomer && !submitToModeler) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "「" + pieceLabel(piece) + "」客户已确认，请勿修改");
        }
        if (confirmed && (imagesDiffer || engravingImagesDiffer) && !pieceRework) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "「" + pieceLabel(piece) + "」客户已确认，不能修改设计图");
        }
        boolean applyContent = !confirmed || pieceRework;

        if (applyContent) {
            OrderDetail od = existingDetail != null ? existingDetail : new OrderDetail();
            if (existingDetail == null) {
                od.setOrderId(orderId);
            }
            if (req.getEngravingText() != null) {
                od.setEngravingText(req.getEngravingText());
            }
            if (req.getEngravingImages() != null) {
                od.setEngravingImagesJson(toJson(req.getEngravingImages()));
            }
            if (req.getMaterialType() != null) {
                od.setMaterialType(req.getMaterialType());
            }
            DesignInfo di = existingDesign != null ? existingDesign : new DesignInfo();
            if (existingDesign == null) {
                di.setOrderId(orderId);
                di.setPieceId(piece.getId());
            }
            boolean singlePiece = orderPieceRepository.countByOrderId(orderId) <= 1;
            String handSizeForValidation = req.getHandSize() != null ? req.getHandSize() : di.getHandSize();
            if (!StringUtils.hasText(handSizeForValidation) && singlePiece && od.getHandSize() != null) {
                handSizeForValidation = od.getHandSize();
            }
            com.jewelry.system.util.JewelryTypeRules.validateDesignerHandSize(
                    piece.getJewelryType(), handSizeForValidation);
            if (piece.getJewelryType() != null && piece.getJewelryType().hasNoSizeField()) {
                req.setHandSize("");
                di.setHandSize(null);
                if (singlePiece) {
                    od.setHandSize(null);
                }
            } else if (req.getHandSize() != null) {
                String pieceSize = req.getHandSize().isBlank() ? null : req.getHandSize().trim();
                di.setHandSize(pieceSize);
                // 单件订单仍同步订单级字段，兼容旧报表；多件只写本件 design_info
                if (singlePiece) {
                    od.setHandSize(pieceSize);
                }
            }
            if (req.getDesignNotes() != null) {
                od.setDesignNotes(req.getDesignNotes());
            }
            if (req.getMaterialDetail() != null && !req.getMaterialDetail().isBlank()) {
                String base = od.getDesignNotes() != null ? od.getDesignNotes() : "";
                od.setDesignNotes(base + (base.isEmpty() ? "" : "\n") + "材质详情: " + req.getMaterialDetail());
            }
            orderDetailRepository.save(od);
            if (req.getProcessInfo() != null) {
                di.setProcessInfoJson(toJson(req.getProcessInfo()));
            }
            if (req.getStoneInfo() != null) {
                di.setStoneInfoJson(toJson(req.getStoneInfo()));
            }
            if (req.getPlating() != null) {
                di.setPlating(req.getPlating().isBlank() ? null : req.getPlating().trim());
            }
            if (req.getDesignImages() != null) {
                di.setDesignImagesJson(toJson(req.getDesignImages()));
            }
            designInfoRepository.save(di);
            // 内容变更后需重新走跟单质量审
            orderPieceService.markDesignQualityPassed(orderId, piece.getId(), false);
        }

        Long oldDesignerId = order.getDesigner() != null ? order.getDesigner().getId() : null;
        if (req.getDesignerId() != null) {
            order.setDesigner(userRepository.getReferenceById(req.getDesignerId()));
        } else if (order.getDesigner() == null && "DESIGNER".equals(SecurityUtils.currentRoleApi().orElse(""))) {
            // 请求体未带 designerId 时（常见：表单未回填），仍允许本角色保存；须写入订单设计师，
            // 否则无法匹配「指派设计师本人」条件，建模阶段与建模师自动分配不会触发。
            SecurityUtils.currentStaffUserId().ifPresent(uid -> order.setDesigner(userRepository.getReferenceById(uid)));
        }
        Long newDesignerId = order.getDesigner() != null ? order.getDesigner().getId() : null;
        if (!Objects.equals(oldDesignerId, newDesignerId)) {
            conversationService.syncDesignerMember(orderId, newDesignerId);
        }

        if (!submitToCustomer && (Boolean.TRUE.equals(req.getCreateVersion()) || submitToModeler || submitToTracker)) {
            if (applyContent) {
                designVersionService.createVersionSnapshot(
                        orderId, piece, req, false, req.getVersionLabel());
            } else if (submitToModeler || submitToTracker) {
                designVersionService.snapshotStoredPiece(orderId, piece, false, req.getVersionLabel());
            }
        }
        boolean advanced = tryAdvanceOrderToDesigning(order);
        orderRepository.save(order);
        if (submitToCustomer && "DESIGNER".equals(SecurityUtils.currentRoleApi().orElse(""))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "设计完成后请提交跟单员质量评审，不能直接发给客户");
        }
        if (submitToTracker) {
            assertAllPiecesHaveDesignImagesForTrackerHandoff(orderId);
            if (!hasDesignImages && !(existingDesign != null && hasStoredImages(existingDesign.getDesignImagesJson()))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "交给跟单员前请至少上传一张设计图");
            }
            orderPieceService.markDesignQualityPassed(orderId, piece.getId(), false);
            handoffDesignToTracker(order);
            orderEventService.record(orderId, OrderEventType.STATUS_CHANGE,
                    AccountKind.STAFF, requireUserId(), "DESIGNER",
                    "设计稿已提交跟单质量评审",
                    "内部质量评审中。通过后系统会将设计稿发送给您确认。",
                    null, null, piece.getId(), null);
        } else if (submitToModeler) {
            if (!hasDesignImages) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "交给建模师前请先上传设计图");
            }
            if (!pieceRework) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "「" + pieceLabel(piece) + "」没有被建模师驳回，请打开被驳回的那一件再交回");
            }
            clearModelerRejectOnPiece(piece.getId());
            orderPieceService.markDesignConfirmed(orderId, piece.getId());
            if (isDesignRework(orderId)) {
                orderEventService.record(orderId, OrderEventType.STATUS_CHANGE,
                        AccountKind.STAFF, requireUserId(), "DESIGNER",
                        "设计师已修改并交回建模师", "已修改单件：" + pieceLabel(piece), null, null, piece.getId(), null);
            } else {
                // 建模师驳回链路：不重走设计跟单评审，全部确认后直接回建模
                if (!orderPieceService.allDesignConfirmed(orderId)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "还有其他单件的设计未确认，暂时不能交回建模师");
                }
                OrderStatus st = order.getStatus();
                if (st == OrderStatus.DESIGNING || st == OrderStatus.PENDING_DESIGN) {
                    order.transitionTo(OrderStatus.PENDING_MODEL);
                    autoAssignmentService.ensureModelerAssigned(order);
                    orderRepository.save(order);
                }
                orderEventService.record(orderId, OrderEventType.STATUS_CHANGE,
                        AccountKind.STAFF, requireUserId(), "DESIGNER",
                        "设计师已修改并交回建模师", "已修改单件：" + pieceLabel(piece), null, null, piece.getId(), null);
            }
        } else if (submitToCustomer) {
            submitUnconfirmedDesigns(order, piece, req.getVersionLabel(), isDesignRework(orderId));
        }
        auditLogService.log("ORDER_UPDATE_DESIGN", "ORDER", orderId,
                submitToTracker ? "设计稿提交跟单质量评审（单件 " + piece.getName() + "）"
                        : submitToCustomer ? "提交未确认的设计稿给客户"
                        : "更新设计信息（单件 " + piece.getName() + "）");
        if (advanced) {
            auditLogService.log("ORDER_DESIGN_IN_PROGRESS", "ORDER", orderId,
                    "设计师保存设计，订单进入设计中");
        }
        return orderQueryService.getOrder(orderId);
    }

    private void handoffDesignToTracker(Order order) {
        OrderStatus st = order.getStatus();
        if (st == OrderStatus.PENDING_DESIGN || st == OrderStatus.DESIGNING) {
            order.transitionTo(OrderStatus.PENDING_DESIGN_REVIEW);
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前状态不能提交跟单质量评审");
        }
        autoAssignmentService.ensureTrackerAssigned(order);
        orderRepository.save(order);
    }

    private void assertAllPiecesHaveDesignImagesForTrackerHandoff(long orderId) {
        List<String> missing = new ArrayList<>();
        for (OrderPiece p : orderPieceService.listByOrderId(orderId)) {
            DesignInfo row = designInfoRepository.findByPieceId(p.getId()).orElse(null);
            if (!hasStoredImages(row != null ? row.getDesignImagesJson() : null)) {
                missing.add(pieceLabel(p));
            }
        }
        if (!missing.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "以下单件还没有设计图，须全部单件都有图后才能提交跟单评审：" + String.join("、", missing));
        }
    }

    @Transactional
    public OrderInfoDto restoreDesignVersion(long orderId, long pieceId, long versionId) {
        Order order = loadOrder(orderId);
        assertCanEditDesign(order);
        OrderPiece piece = orderPieceService.requirePiece(orderId, pieceId);
        if (Boolean.TRUE.equals(piece.getDesignConfirmed()) && !isDesignRework(orderId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "「" + pieceLabel(piece) + "」客户已确认，不能回退设计图");
        }
        designVersionService.applyVersionToWorkingCopy(orderId, pieceId, versionId);
        auditLogService.log("ORDER_RESTORE_DESIGN_VERSION", "ORDER", orderId,
                "回退设计稿版本 piece=" + pieceId + " versionId=" + versionId);
        return orderQueryService.getOrder(orderId);
    }

    /**
     * 指派设计师本人保存设计信息时，若订单仍处于设计师阶段，则自动推进至「建模中」（PENDING_MODEL）。
     * 其他角色（如管理员、客服）编辑设计信息不会触发自动流转。
     * 若订单此前未写入 designer_id，设计师保存前会先被补全为当前登录员工（见 updateDesign）。
     */
    /** 设计师保存时仅推进到「设计中」，进入建模须客户确认全部单件设计稿。 */
    private boolean tryAdvanceOrderToDesigning(Order order) {
        if (!SecurityUtils.currentRoleApi().filter("DESIGNER"::equals).isPresent()) {
            return false;
        }
        Long uid = SecurityUtils.currentStaffUserId().orElse(null);
        if (uid == null || order.getDesigner() == null || !uid.equals(order.getDesigner().getId())) {
            return false;
        }
        if (order.getStatus() == OrderStatus.PENDING_DESIGN) {
            order.transitionTo(OrderStatus.DESIGNING);
            return true;
        }
        return false;
    }

    /**
     * 客户确认全部单件设计后：须已在跟单设计评审通过之后，订单进入待建模。
     */
    @Transactional
    public void tryAdvanceAfterAllDesignConfirmed(Order order) {
        if (!orderPieceService.allDesignConfirmed(order.getId())) {
            return;
        }
        if (order.getStatus() != OrderStatus.PENDING_DESIGN_REVIEW) {
            return;
        }
        boolean craftPassed = processReviewRepository
                .findTopByOrderIdAndReviewKindOrderByIdDesc(order.getId(), ReviewKind.DESIGN)
                .map(pr -> pr.getReviewResult() == ReviewResult.PASSED)
                .orElse(false);
        if (!craftPassed) {
            return;
        }
        try {
            order.transitionTo(OrderStatus.PENDING_MODEL);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        clearModelerRejectToDesignerFields(order.getId());
        autoAssignmentService.ensureModelerAssigned(order);
        orderRepository.save(order);
        auditLogService.log("ORDER_CUSTOMER_CONFIRMED_TO_PENDING_MODEL", "ORDER", order.getId(),
                "客户全部确认设计，订单进入建模中");
        fulfillmentDispatchService.drainDesignQueue();
        requestDesignOptionsIfNeeded(order);
    }

    /**
     * 全部设计稿经客户确认后，在订单聊天里请客户选择买断、版权证书和是否保密。
     */
    public void requestDesignOptionsIfNeeded(Order order) {
        if (order == null || order.getId() == null || !orderPieceService.allDesignConfirmed(order.getId())) {
            return;
        }
        Quotation quotation = quotationRepository.findByOrderId(order.getId()).orElse(null);
        if (quotation != null && quotation.getDesignOptionsAt() != null) {
            return;
        }
        boolean pending = false;
        boolean filled = false;
        for (OrderEvent event : orderEventRepository.findByOrderIdOrderByIdAsc(order.getId())) {
            if (event.getEventType() == OrderEventType.DESIGN_OPTIONS_FILLED) {
                filled = true;
            }
            if (event.getEventType() == OrderEventType.DESIGN_OPTIONS_REQUEST) {
                pending = true;
            }
        }
        if (filled || pending) {
            return;
        }
        // actor_id 列为 NOT NULL；系统卡片统一用 0
        orderEventService.record(order.getId(), OrderEventType.DESIGN_OPTIONS_REQUEST,
                AccountKind.STAFF, 0L, ConversationService.SYSTEM_EVENT_ROLE,
                "请确认生产选项",
                "设计已通过。请选择是否买断设计、是否需要版权证书，以及是否保密、不对外宣传。",
                null, null);
    }

    @Transactional
    public void updatePieceStones(long orderId, long pieceId, Object stoneInfo) {
        Order order = loadOrder(orderId);
        assertCanEditStones(order);
        OrderPiece piece = orderPieceService.requirePiece(orderId, pieceId);
        DesignInfo design = designInfoRepository.findByPieceId(piece.getId()).orElseGet(() -> {
            DesignInfo created = new DesignInfo();
            created.setOrderId(orderId);
            created.setPieceId(piece.getId());
            return created;
        });
        design.setStoneInfoJson(toJson(stoneInfo == null ? List.of() : stoneInfo));
        designInfoRepository.save(design);
    }

    private void assertCanEditStones(Order order) {
        if (isAdminRole()) {
            return;
        }
        String role = SecurityUtils.currentRoleApi().orElse("");
        Long uid = requireUserId();
        if ("DESIGNER".equals(role)) {
            User designer = order.getDesigner();
            if (designer == null || uid.equals(designer.getId())) {
                return;
            }
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅本单设计师可修改石料");
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅设计师或管理员可修改石料");
    }

    /**
     * 客户确认全部单件建模后：须已在跟单工艺通过之后，订单进入「待发送生产」（未付尾款，禁止分享）。
     */
    @Transactional
    public void tryAdvanceAfterAllModelConfirmed(Order order) {
        if (!orderPieceService.allModelConfirmed(order.getId())) {
            return;
        }
        if (order.getStatus() != OrderStatus.PENDING_REVIEW) {
            return;
        }
        boolean craftPassed = processReviewRepository
                .findTopByOrderIdAndReviewKindOrderByIdDesc(order.getId(), ReviewKind.MODEL)
                .map(pr -> pr.getReviewResult() == ReviewResult.PASSED)
                .orElse(false);
        if (!craftPassed) {
            return;
        }
        try {
            order.transitionTo(OrderStatus.PENDING_PRODUCTION);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        autoAssignmentService.ensureTrackerAssigned(order);
        orderRepository.save(order);
        auditLogService.log("ORDER_CUSTOMER_CONFIRMED_TO_PENDING_PRODUCTION", "ORDER", order.getId(),
                "客户全部确认建模，订单进入待发送生产（待付尾款）");
        fulfillmentDispatchService.drainModelQueue();
    }

    /**
     * 一次提交待客户确认的设计稿。已确认且未被建模师驳回的件跳过。
     * 被建模师驳回的件即使此前已确认，也会重新打开并只把这些件发给客户。
     */
    private void submitUnconfirmedDesigns(Order order, OrderPiece activePiece, String versionLabel, boolean designRework) {
        long orderId = order.getId();
        List<OrderPiece> pieces = orderPieceService.listByOrderId(orderId);
        List<String> missing = new ArrayList<>();
        List<OrderPiece> pending = new ArrayList<>();
        for (OrderPiece p : pieces) {
            boolean modelerRejected = isPieceDesignRework(p.getId());
            if (Boolean.TRUE.equals(p.getDesignConfirmed()) && !modelerRejected) {
                continue;
            }
            DesignInfo row = designInfoRepository.findByPieceId(p.getId()).orElse(null);
            if (!hasStoredImages(row != null ? row.getDesignImagesJson() : null)) {
                missing.add(pieceLabel(p));
            } else {
                pending.add(p);
            }
        }
        if (!missing.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "以下单件还没有设计图，须全部单件都有图后才能一起提交给客户：" + String.join("、", missing));
        }
        if (pending.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "没有待提交给客户的单件。已确认且未被建模师驳回的件不会再次发送。");
        }
        String notes = orderDetailRepository.findByOrderId(orderId).map(OrderDetail::getDesignNotes).orElse(null);
        String content = designRework ? joinNotice(DESIGN_ADJUST_NOTICE, notes) : notes;
        for (OrderPiece p : pending) {
            if (Boolean.TRUE.equals(p.getDesignConfirmed())) {
                orderPieceService.resetDesignConfirmation(orderId, p.getId());
                p.setDesignConfirmed(false);
            }
            DesignInfo row = designInfoRepository.findByPieceId(p.getId()).orElseThrow(
                    () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "缺少设计资料：" + pieceLabel(p)));
            row.setCustomerApproved(false);
            row.setApprovalTime(null);
            row.setLastCustomerRejectReason(null);
            row.setLastCustomerRejectAt(null);
            designInfoRepository.save(row);
            String label = activePiece != null && Objects.equals(activePiece.getId(), p.getId()) ? versionLabel : null;
            designVersionService.snapshotStoredPiece(orderId, p, true, label);
            String role = SecurityUtils.currentRoleApi().orElse("DESIGNER");
            orderEventService.record(orderId, OrderEventType.DESIGN_SUBMIT,
                    AccountKind.STAFF, requireUserId(), role,
                    "设计稿 · " + pieceLabel(p), content, null, null, p.getId(),
                    buildImageSnapshotJson(parseStringList(row.getDesignImagesJson())));
        }
    }

    /**
     * 一次提交本单所有尚未被客户确认的建模稿。任一件缺效果图则整批失败，不发卡片。
     * 已 modelConfirmed 的件跳过，不重置确认。
     */
    private void submitUnconfirmedModels(Order order, OrderPiece activePiece, String versionLabel, boolean modelRework) {
        long orderId = order.getId();
        List<OrderPiece> pieces = orderPieceService.listByOrderId(orderId);
        List<String> missing = new ArrayList<>();
        List<OrderPiece> pending = new ArrayList<>();
        for (OrderPiece p : pieces) {
            if (Boolean.TRUE.equals(p.getModelConfirmed())) {
                continue;
            }
            ModelingInfo row = modelingInfoRepository.findByPieceId(p.getId()).orElse(null);
            if (!hasStoredImages(row != null ? row.getModelEffectImagesJson() : null)) {
                missing.add(pieceLabel(p));
            } else {
                pending.add(p);
            }
        }
        if (!missing.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "以下单件还没有效果图，须全部单件都有图后才能一起提交给客户：" + String.join("、", missing));
        }
        if (pending.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "没有待提交给客户的单件。已确认的件不会再次发送。");
        }
        String role = SecurityUtils.currentRoleApi().orElse("MODELER");
        for (OrderPiece p : pending) {
            ModelingInfo row = modelingInfoRepository.findByPieceId(p.getId()).orElseThrow(
                    () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "缺少建模资料：" + pieceLabel(p)));
            row.setCustomerApproved(false);
            row.setApprovalTime(null);
            row.setLastCustomerRejectReason(null);
            row.setLastCustomerRejectAt(null);
            modelingInfoRepository.save(row);
            String label = activePiece != null && Objects.equals(activePiece.getId(), p.getId()) ? versionLabel : null;
            modelVersionService.snapshotStoredPiece(orderId, p, true, label);
            String content = modelRework ? joinNotice(MODEL_ADJUST_NOTICE, row.getModelNotes()) : row.getModelNotes();
            orderEventService.record(orderId, OrderEventType.MODEL_SUBMIT,
                    AccountKind.STAFF, requireUserId(), role,
                    "建模稿 · " + pieceLabel(p), content, null, null, p.getId(),
                    buildImageSnapshotJson(parseStringList(row.getModelEffectImagesJson())));
        }
    }

    private static String pieceLabel(OrderPiece piece) {
        if (piece.getName() != null && !piece.getName().isBlank()) {
            return piece.getName().trim();
        }
        return "单件" + (piece.getSeq() != null ? piece.getSeq() : "");
    }

    private boolean imageListDiffers(String storedJson, List<String> incoming) {
        if (incoming == null) {
            return false;
        }
        return !normalizeImageUrls(parseStringList(storedJson)).equals(normalizeImageUrls(incoming));
    }

    private boolean hasStoredImages(String json) {
        return !normalizeImageUrls(parseStringList(json)).isEmpty();
    }

    private List<String> parseStringList(String json) {
        if (!StringUtils.hasText(json)) {
            return List.of();
        }
        try {
            List<String> list = objectMapper.readValue(json,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
            return list != null ? list : List.of();
        } catch (Exception e) {
            return List.of();
        }
    }

    private static List<String> normalizeImageUrls(List<String> urls) {
        if (urls == null) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (String url : urls) {
            if (url == null) {
                continue;
            }
            String trimmed = url.trim();
            if (!trimmed.isEmpty()) {
                out.add(trimmed);
            }
        }
        return out;
    }

    private static boolean textDiffers(String stored, String incoming) {
        if (incoming == null) {
            return false;
        }
        String left = stored == null ? "" : stored.trim();
        return !left.equals(incoming.trim());
    }

    private boolean sourceFilesDiffer(String storedJson, List<Long> incoming) {
        if (incoming == null) {
            return false;
        }
        List<Long> storedIds = new ArrayList<>();
        if (StringUtils.hasText(storedJson)) {
            try {
                var node = objectMapper.readTree(storedJson);
                if (node.isArray()) {
                    for (var item : node) {
                        if (item.hasNonNull("fileId")) {
                            storedIds.add(item.get("fileId").asLong());
                        }
                    }
                }
            } catch (Exception e) {
                return true;
            }
        }
        List<Long> incomingIds = new ArrayList<>();
        for (Long id : incoming) {
            if (id != null) {
                incomingIds.add(id);
            }
        }
        return !storedIds.equals(incomingIds);
    }

    private static boolean weightDiffers(BigDecimal stored, Double incoming) {
        if (incoming == null) {
            return false;
        }
        if (stored == null) {
            return incoming.doubleValue() != 0d;
        }
        return stored.compareTo(BigDecimal.valueOf(incoming)) != 0;
    }

    private String buildImageSnapshotJson(List<String> images) {
        try {
            return objectMapper.writeValueAsString(Map.of("images", images != null ? images : List.of()));
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private boolean isDesignRework(long orderId) {
        return modelingInfoRepository.findAllByOrderId(orderId).stream()
                .anyMatch(mi -> StringUtils.hasText(mi.getModelerRejectToDesignerMessage()));
    }

    private boolean isModelRework(Order order) {
        OrderStatus st = order.getStatus();
        if (st != OrderStatus.MODELING && st != OrderStatus.PENDING_MODEL) {
            return false;
        }
        // 跟单工艺驳回，或客户驳回后处于建模修改中
        boolean craftRejected = processReviewRepository
                .findTopByOrderIdAndReviewKindOrderByIdDesc(order.getId(), ReviewKind.MODEL)
                .map(pr -> pr.getReviewResult() == ReviewResult.REJECTED)
                .orElse(false);
        if (craftRejected) {
            return true;
        }
        return orderPieceService.listByOrderId(order.getId()).stream()
                .anyMatch(p -> !Boolean.TRUE.equals(p.getModelConfirmed())
                        && modelingInfoRepository.findByPieceId(p.getId())
                        .map(mi -> StringUtils.hasText(mi.getLastCustomerRejectReason()))
                        .orElse(false));
    }

    private static String joinNotice(String notice, String notes) {
        if (!StringUtils.hasText(notes)) {
            return notice;
        }
        return notice + "\n" + notes.trim();
    }

    private void handoffModelToTracker(Order order) {
        OrderStatus st = order.getStatus();
        if (st == OrderStatus.PENDING_MODEL) {
            order.transitionTo(OrderStatus.PENDING_REVIEW);
        } else if (st == OrderStatus.MODELING) {
            order.transitionTo(OrderStatus.PENDING_REVIEW);
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前状态不能交回跟单员");
        }
        autoAssignmentService.ensureTrackerAssigned(order);
        orderRepository.save(order);
    }

    private void clearModelerRejectToDesignerFields(long orderId) {
        for (ModelingInfo mi : modelingInfoRepository.findAllByOrderId(orderId)) {
            if (!StringUtils.hasText(mi.getModelerRejectToDesignerMessage())
                    && mi.getModelerRejectToDesignerFileIdsJson() == null) {
                continue;
            }
            mi.setModelerRejectToDesignerMessage(null);
            mi.setModelerRejectToDesignerFileIdsJson(null);
            modelingInfoRepository.save(mi);
        }
    }

    private void clearModelerRejectOnPiece(long pieceId) {
        modelingInfoRepository.findByPieceId(pieceId).ifPresent(mi -> {
            mi.setModelerRejectToDesignerMessage(null);
            mi.setModelerRejectToDesignerFileIdsJson(null);
            modelingInfoRepository.save(mi);
        });
    }

    private boolean isPieceDesignRework(long pieceId) {
        return modelingInfoRepository.findByPieceId(pieceId)
                .map(mi -> StringUtils.hasText(mi.getModelerRejectToDesignerMessage()))
                .orElse(false);
    }

    @Transactional
    public OrderInfoDto updateModel(long orderId, OrderModelUpdateRequest req) {
        Order order = loadOrder(orderId);
        assertCanEditModel(order);
        assertReassignModeler(order, req.getModelerId());
        OrderPiece piece = orderPieceService.requirePiece(orderId, req.getPieceId());
        ModelingInfo existing = modelingInfoRepository.findByPieceId(piece.getId()).orElse(null);

        boolean hasEffectImages = req.getModelEffectImageUrls() != null && !req.getModelEffectImageUrls().isEmpty();
        boolean submitToTracker = Boolean.TRUE.equals(req.getSubmitToTracker());
        boolean submitToCustomer = Boolean.TRUE.equals(req.getSubmitToCustomer()) && !submitToTracker;
        if (Boolean.TRUE.equals(req.getSubmitToCustomer()) && submitToTracker) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不能同时提交客户和跟单员");
        }
        boolean modelRework = isModelRework(order);
        boolean confirmed = Boolean.TRUE.equals(piece.getModelConfirmed());
        boolean imagesDiffer = imageListDiffers(
                existing != null ? existing.getModelEffectImagesJson() : null,
                req.getModelEffectImageUrls());
        boolean notesDiffer = textDiffers(existing != null ? existing.getModelNotes() : null, req.getModelNotes());
        boolean weightDiffer = weightDiffers(existing != null ? existing.getWeight() : null, req.getWeight());
        boolean sourceDiffer = sourceFilesDiffer(
                existing != null ? existing.getModelFilesJson() : null, req.getModelSourceFileIds());
        boolean engravingDiffer = sourceFilesDiffer(
                existing != null ? existing.getEngravingFilesJson() : null, req.getEngravingFileIds());
        if (confirmed && submitToCustomer && (imagesDiffer || notesDiffer || weightDiffer || sourceDiffer || engravingDiffer)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "「" + pieceLabel(piece) + "」客户已确认，提交给客户时不能修改该件，也不会再次发送。请只修改未确认的单件；跟单退回后的改动请直接交回跟单员。");
        }
        if (confirmed && !modelRework && !submitToCustomer && !submitToTracker) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "「" + pieceLabel(piece) + "」客户已确认，请勿修改");
        }
        if (confirmed && imagesDiffer && !modelRework) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "「" + pieceLabel(piece) + "」客户已确认，不能修改效果图");
        }
        boolean applyContent = !confirmed || (modelRework && !submitToCustomer);

        ModelingInfo mi = existing != null ? existing : new ModelingInfo();
        if (existing == null) {
            mi.setOrderId(orderId);
            mi.setPieceId(piece.getId());
        }
        if (applyContent) {
            if (req.getWeight() != null) {
                mi.setWeight(BigDecimal.valueOf(req.getWeight()));
            }
            if (req.getModelNotes() != null) {
                mi.setModelNotes(req.getModelNotes());
            }
            if (req.getModelEffectImageUrls() != null) {
                mi.setModelEffectImagesJson(toJson(req.getModelEffectImageUrls()));
            }
            if (req.getModelSourceFileIds() != null) {
                mi.setModelFilesJson(toJson(buildModelSourceFileRefs(orderId, req.getModelSourceFileIds())));
            }
            if (req.getEngravingFileIds() != null) {
                mi.setEngravingFilesJson(toJson(buildEngravingFileRefs(orderId, req.getEngravingFileIds())));
            }
            modelingInfoRepository.save(mi);
            orderPieceService.markModelQualityPassed(orderId, piece.getId(), false);
        }
        if (req.getModelerId() != null) {
            order.setModeler(requireActiveUserWithRole(req.getModelerId(), UserRole.MODELER, "建模师"));
        } else if (order.getModeler() == null && "MODELER".equals(SecurityUtils.currentRoleApi().orElse(""))) {
            // 与 updateDesign 补设计师对称：未写入 modeler_id 且请求未带时，由当前建模师落库，便于工作台与审计一致
            SecurityUtils.currentStaffUserId().ifPresent(uid ->
                    order.setModeler(requireActiveUserWithRole(uid, UserRole.MODELER, "建模师")));
        } else if (order.getModeler() != null && !UserRole.MODELER.equals(order.getModeler().getRole())) {
            // 历史脏数据：非建模师被误写入 modeler_id，保存时清空以免继续污染
            order.setModeler(null);
        }
        OrderStatus stBefore = order.getStatus();
        if (stBefore == OrderStatus.PENDING_MODEL) {
            order.transitionTo(OrderStatus.MODELING);
        }
        boolean createVersion = Boolean.TRUE.equals(req.getCreateVersion()) || submitToTracker;
        if (createVersion && !submitToCustomer) {
            if (applyContent) {
                modelVersionService.createVersionSnapshot(
                        orderId, piece, req, mi.getModelFilesJson(), false, req.getVersionLabel());
            } else if (submitToTracker) {
                modelVersionService.snapshotStoredPiece(orderId, piece, false, req.getVersionLabel());
            }
        }
        if (submitToCustomer) {
            // 新流程：建模师不能直交客户，须先经跟单工艺评审；管理员保留旁路能力
            if ("MODELER".equals(SecurityUtils.currentRoleApi().orElse(""))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "建模完成后请提交跟单员工艺评审，不能直接发给客户");
            }
        }
        if (submitToTracker) {
            assertAllPiecesHaveEffectImagesForTrackerHandoff(orderId);
            if (!hasEffectImages && !hasStoredImages(mi.getModelEffectImagesJson())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "交给跟单员前请至少上传一张效果图");
            }
            assertEngravingFilesForHandoff(orderId, piece.getId(), mi);
            orderPieceService.markModelQualityPassed(orderId, piece.getId(), false);
            handoffModelToTracker(order);
            orderEventService.record(orderId, OrderEventType.STATUS_CHANGE,
                    AccountKind.STAFF, requireUserId(), "MODELER",
                    modelRework ? "建模师已按工艺驳回修改并交回跟单员" : "建模稿已提交跟单工艺评审",
                    "内部质量评审中。通过后系统会将建模效果图发送给您确认。",
                    null, null, piece.getId(), null);
        } else if (submitToCustomer) {
            submitUnconfirmedModels(order, piece, req.getVersionLabel(), modelRework);
        }
        orderRepository.save(order);
        auditLogService.log("ORDER_UPDATE_MODEL", "ORDER", orderId,
                submitToTracker
                        ? "建模稿提交跟单工艺评审（单件 " + piece.getName() + "）"
                        : submitToCustomer
                        ? "提交未确认的建模稿给客户"
                        : "更新建模信息（单件 " + piece.getName() + "）");
        return orderQueryService.getOrder(orderId);
    }

    /** 交跟单前：订单下每一件都必须有建模效果图 */
    private void assertAllPiecesHaveEffectImagesForTrackerHandoff(long orderId) {
        List<String> missing = new ArrayList<>();
        for (OrderPiece p : orderPieceService.listByOrderId(orderId)) {
            ModelingInfo row = modelingInfoRepository.findByPieceId(p.getId()).orElse(null);
            if (!hasStoredImages(row != null ? row.getModelEffectImagesJson() : null)) {
                missing.add(pieceLabel(p));
            }
        }
        if (!missing.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "以下单件还没有效果图，须全部单件都有图后才能提交跟单评审：" + String.join("、", missing));
        }
    }

    @Transactional
    public OrderInfoDto restoreModelVersion(long orderId, long pieceId, long versionId) {
        Order order = loadOrder(orderId);
        assertCanEditModel(order);
        OrderPiece piece = orderPieceService.requirePiece(orderId, pieceId);
        if (Boolean.TRUE.equals(piece.getModelConfirmed()) && !isModelRework(order)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "「" + pieceLabel(piece) + "」客户已确认，不能回退效果图");
        }
        modelVersionService.applyVersionToWorkingCopy(orderId, pieceId, versionId);
        auditLogService.log("ORDER_RESTORE_MODEL_VERSION", "ORDER", orderId,
                "回退建模稿版本 piece=" + pieceId + " versionId=" + versionId);
        return orderQueryService.getOrder(orderId);
    }

    /**
     * 建模师将订单退回设计师补充资料；订单状态变为 {@link OrderStatus#DESIGNING}（展示名：设计复审中）。
     */
    @Transactional
    public OrderInfoDto modelerRejectToDesigner(long orderId, ModelerRejectToDesignerRequest req) {
        if (!SecurityUtils.currentRoleApi().filter("MODELER"::equals).isPresent()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅建模师可操作驳回给设计师");
        }
        Long uid = SecurityUtils.currentStaffUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        Order order = loadOrder(orderId);
        if (order.getModeler() == null || !Objects.equals(order.getModeler().getId(), uid)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅本单指派建模师可驳回给设计师");
        }
        OrderStatus st = order.getStatus();
        if (st != OrderStatus.PENDING_MODEL && st != OrderStatus.MODELING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前订单状态不可驳回给设计师");
        }
        String msg = req.getMessage() != null ? req.getMessage().trim() : "";
        if (msg.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "驳回说明不能为空");
        }
        verifyOrderAttachmentFileIds(orderId, req.getAttachmentFileIds());
        OrderPiece piece = orderPieceService.requirePiece(orderId, req.getPieceId());

        if (order.getServiceType() == ServiceType.CUSTOM_IMAGE) {
            return modelerRejectToCustomer(orderId, req);
        }
        order.transitionTo(OrderStatus.DESIGNING);
        orderRepository.save(order);

        ModelingInfo mi = modelingInfoRepository.findByPieceId(piece.getId()).orElseGet(() -> {
            ModelingInfo m = new ModelingInfo();
            m.setOrderId(orderId);
            m.setPieceId(piece.getId());
            return m;
        });
        mi.setModelerRejectToDesignerMessage(msg);
        if (req.getAttachmentFileIds() != null && !req.getAttachmentFileIds().isEmpty()) {
            mi.setModelerRejectToDesignerFileIdsJson(toJson(req.getAttachmentFileIds()));
        } else {
            mi.setModelerRejectToDesignerFileIdsJson(null);
        }
        modelingInfoRepository.save(mi);

        orderEventService.record(orderId, OrderEventType.STATUS_CHANGE,
                AccountKind.STAFF, uid, "MODELER",
                "建模师驳回给设计师", "驳回单件：" + pieceLabel(piece) + "\n" + msg,
                null, req.getAttachmentFileIds(), piece.getId(), null);

        auditLogService.log("ORDER_MODELER_REJECT_TO_DESIGNER", "ORDER", orderId,
                "建模师驳回给设计师，状态=DESIGNING");
        return orderQueryService.getOrder(orderId);
    }

    /**
     * 建模师主动驳回给客户：记录事件卡片（经聊天室推送）并通知，供客户在卡片上查看原因。
     * 不改变订单状态（「待客户补充」未建模为独立状态）。
     */
    @Transactional
    public OrderInfoDto modelerRejectToCustomer(long orderId, ModelerRejectToDesignerRequest req) {
        if (!SecurityUtils.currentRoleApi().filter("MODELER"::equals).isPresent()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅建模师可操作驳回给客户");
        }
        Long uid = SecurityUtils.currentStaffUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        Order order = loadOrder(orderId);
        if (order.getModeler() == null || !Objects.equals(order.getModeler().getId(), uid)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅本单指派建模师可驳回给客户");
        }
        String msg = req.getMessage() != null ? req.getMessage().trim() : "";
        if (msg.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "驳回说明不能为空");
        }
        OrderPiece piece = orderPieceService.requirePiece(orderId, req.getPieceId());
        ModelingInfo mi = modelingInfoRepository.findByPieceId(piece.getId()).orElseGet(() -> {
            ModelingInfo m = new ModelingInfo();
            m.setOrderId(orderId);
            m.setPieceId(piece.getId());
            return m;
        });
        mi.setModelerRejectToDesignerMessage(msg);
        if (req.getAttachmentFileIds() != null && !req.getAttachmentFileIds().isEmpty()) {
            mi.setModelerRejectToDesignerFileIdsJson(toJson(req.getAttachmentFileIds()));
        } else {
            mi.setModelerRejectToDesignerFileIdsJson(null);
        }
        modelingInfoRepository.save(mi);
        orderEventService.record(orderId, OrderEventType.STATUS_CHANGE,
                AccountKind.STAFF, uid, "MODELER",
                "建模师驳回给客户", "驳回单件：" + pieceLabel(piece) + "\n" + msg,
                null, req.getAttachmentFileIds(), piece.getId(), null);
        return orderQueryService.getOrder(orderId);
    }

    private void verifyOrderAttachmentFileIds(long orderId, List<Long> fileIds) {
        if (fileIds == null || fileIds.isEmpty()) {
            return;
        }
        for (Long fid : fileIds) {
            if (fid == null) {
                continue;
            }
            FileEntity fe = fileEntityRepository.findById(fid)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "附件不存在: " + fid));
            if (fe.getRelatedType() != FileRelatedType.ORDER || !Long.valueOf(orderId).equals(fe.getRelatedId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "附件不属于该订单");
            }
        }
    }

    private List<Map<String, Object>> buildModelSourceFileRefs(long orderId, List<Long> fileIds) {
        if (fileIds == null || fileIds.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Long fid : fileIds) {
            if (fid == null) {
                continue;
            }
            FileEntity fe = fileEntityRepository.findById(fid)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "源文件不存在: " + fid));
            if (fe.getRelatedType() != FileRelatedType.ORDER || !Long.valueOf(orderId).equals(fe.getRelatedId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "文件不属于该订单");
            }
            String ft = fe.getFileType() != null ? fe.getFileType() : "";
            if (!"MODEL".equals(ft)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "建模源文件引用仅支持 fileType=MODEL 的上传项（如 STL/ZIP），fileId=" + fid);
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("fileId", fe.getId());
            row.put("fileName", fe.getFileName());
            row.put("fileUrl", fe.getFileUrl());
            row.put("kind", "SOURCE");
            out.add(row);
        }
        return out;
    }

    private List<Map<String, Object>> buildEngravingFileRefs(long orderId, List<Long> fileIds) {
        if (fileIds == null || fileIds.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Long fid : fileIds) {
            if (fid == null) {
                continue;
            }
            FileEntity fe = fileEntityRepository.findById(fid)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "刻字文件不存在: " + fid));
            if (fe.getRelatedType() != FileRelatedType.ORDER || !Long.valueOf(orderId).equals(fe.getRelatedId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "文件不属于该订单");
            }
            String ft = fe.getFileType() != null ? fe.getFileType() : "";
            if (!"ENGRAVING".equals(ft)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "刻字文件引用仅支持 fileType=ENGRAVING 的上传项，fileId=" + fid);
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("fileId", fe.getId());
            row.put("fileName", fe.getFileName());
            row.put("fileUrl", fe.getFileUrl());
            row.put("kind", "ENGRAVING");
            out.add(row);
        }
        return out;
    }

    private void assertEngravingFilesForHandoff(long orderId, long pieceId, ModelingInfo mi) {
        if (!customerOrderBriefService.pieceWantsEngraving(orderId, pieceId)) {
            return;
        }
        List<Long> ids = parseFileIdsFromJson(mi != null ? mi.getEngravingFilesJson() : null);
        if (ids.isEmpty()) {
            OrderPiece piece = orderPieceService.requirePiece(orderId, pieceId);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "「" + pieceLabel(piece) + "」客户需要刻字，交给跟单员前请上传刻字文件");
        }
    }

    private List<Long> parseFileIdsFromJson(String json) {
        if (!StringUtils.hasText(json)) {
            return List.of();
        }
        try {
            List<?> raw = objectMapper.readValue(json, List.class);
            List<Long> out = new ArrayList<>();
            for (Object row : raw) {
                if (row instanceof Map<?, ?> map) {
                    Object fid = map.get("fileId");
                    if (fid instanceof Number n) {
                        out.add(n.longValue());
                    }
                }
            }
            return out;
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }

    @Transactional
    public OrderInfoDto updateReview(long orderId, OrderReviewUpdateRequest req) {
        Order order = loadOrder(orderId);
        Long uid = SecurityUtils.currentStaffUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        if (!isAdminRole()) {
            assertCanEditReview(order);
            // 非管理员一律以当前登录跟单员落库，忽略请求体里可能过期的 trackerId
            if (req.getTrackerId() != null && !req.getTrackerId().equals(uid)) {
                req.setTrackerId(uid);
            }
        }
        long reviewerId = isAdminRole() && req.getTrackerId() != null ? req.getTrackerId() : uid;
        order.setFollowUp(userRepository.getReferenceById(reviewerId));
        orderRepository.save(order);

        ReviewKind kind;
        try {
            kind = ReviewKind.fromString(req.getReviewKind());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        if (kind == ReviewKind.DESIGN && order.getStatus() != OrderStatus.PENDING_DESIGN_REVIEW) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前订单不在待设计评审状态");
        }
        if (kind == ReviewKind.MODEL && order.getStatus() != OrderStatus.PENDING_REVIEW) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前订单不在待建模评审状态");
        }

        OrderPiece piece = orderPieceService.requirePiece(orderId, req.getPieceId());
        boolean rejected = (req.getRejectionReason() != null && !req.getRejectionReason().isBlank())
                || (req.getRejectedProcesses() != null && !req.getRejectedProcesses().isEmpty());

        ProcessReview pr = new ProcessReview();
        pr.setOrderId(orderId);
        pr.setPieceId(piece.getId());
        pr.setReviewKind(kind);
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

        String pieceName = pieceLabel(piece);
        if (kind == ReviewKind.DESIGN) {
            if (rejected) {
                orderPieceService.markDesignQualityPassed(orderId, piece.getId(), false);
                try {
                    order.transitionTo(OrderStatus.DESIGNING);
                } catch (IllegalStateException e) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
                }
                orderRepository.save(order);
                auditLogService.log("ORDER_DESIGN_REVIEW_REJECT", "ORDER", orderId,
                        "设计评审驳回单件 " + pieceName + "，退回设计师修改");
                orderEventService.record(orderId, OrderEventType.REVIEW_REJECT,
                        AccountKind.STAFF, uid, SecurityUtils.currentRoleApi().orElse("TRACKER"),
                        "设计质量评审驳回 · " + pieceName,
                        req.getReviewNotes(), req.getRejectionReason(), null, piece.getId(), null);
            } else {
                orderPieceService.markDesignQualityPassed(orderId, piece.getId(), true);
                boolean allPassed = orderPieceService.allDesignQualityPassed(orderId);
                if (allPassed) {
                    // 顺序：工艺验证通过 → 客户确认卡 → 跟单问候
                    orderEventService.record(orderId, OrderEventType.REVIEW_PASS,
                            AccountKind.STAFF, uid, SecurityUtils.currentRoleApi().orElse("TRACKER"),
                            "设计质量评审全部单件通过，已自动发给客户审阅",
                            req.getReviewNotes(), null, null, piece.getId(), null);
                    afterDesignReviewPassSubmitToCustomer(order);
                    conversationService.announceDesignReviewHandoff(order.getId());
                } else {
                    orderRepository.save(order);
                    orderEventService.record(orderId, OrderEventType.REVIEW_PASS,
                            AccountKind.STAFF, uid, SecurityUtils.currentRoleApi().orElse("TRACKER"),
                            "设计质量评审通过 · " + pieceName + "（尚有其他单件待审）",
                            req.getReviewNotes(), null, null, piece.getId(), null);
                }
            }
        } else {
            if (rejected) {
                orderPieceService.markModelQualityPassed(orderId, piece.getId(), false);
                try {
                    order.transitionTo(OrderStatus.MODELING);
                } catch (IllegalStateException e) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
                }
                autoAssignmentService.rebalanceModelerIfInvalid(order);
                orderRepository.save(order);
                auditLogService.log("ORDER_REVIEW_REJECT_TO_MODELER", "ORDER", orderId,
                        "建模评审驳回单件 " + pieceName + "，订单退回建模修改中");
                orderEventService.record(orderId, OrderEventType.REVIEW_REJECT,
                        AccountKind.STAFF, uid, SecurityUtils.currentRoleApi().orElse("TRACKER"),
                        "建模工艺评审驳回 · " + pieceName,
                        req.getReviewNotes(), req.getRejectionReason(), null, piece.getId(), null);
            } else {
                orderPieceService.markModelQualityPassed(orderId, piece.getId(), true);
                boolean allPassed = orderPieceService.allModelQualityPassed(orderId);
                if (allPassed) {
                    // 顺序：工艺验证通过 → 客户确认卡 → 跟单问候
                    orderEventService.record(orderId, OrderEventType.REVIEW_PASS,
                            AccountKind.STAFF, uid, SecurityUtils.currentRoleApi().orElse("TRACKER"),
                            "建模工艺评审全部单件通过，已自动发给客户审阅",
                            req.getReviewNotes(), null, null, piece.getId(), null);
                    afterCraftReviewPassSubmitToCustomer(order);
                    conversationService.announceTrackerHandoff(order.getId());
                } else {
                    orderRepository.save(order);
                    orderEventService.record(orderId, OrderEventType.REVIEW_PASS,
                            AccountKind.STAFF, uid, SecurityUtils.currentRoleApi().orElse("TRACKER"),
                            "建模工艺评审通过 · " + pieceName + "（尚有其他单件待审）",
                            req.getReviewNotes(), null, null, piece.getId(), null);
                }
            }
        }
        auditLogService.log("ORDER_UPDATE_REVIEW", "ORDER", orderId,
                "按件质量评审 kind=" + kind.name() + " piece=" + piece.getId()
                        + (rejected ? " REJECTED" : " PASSED"));
        return orderQueryService.getOrder(orderId);
    }

    /** 设计评审通过：保持待设计评审，自动发给客户审阅（不含跟单问候，由调用方在 REVIEW_PASS 之后再发）。 */
    private void afterDesignReviewPassSubmitToCustomer(Order order) {
        orderRepository.save(order);
        try {
            submitUnconfirmedDesigns(order, null, null, false);
        } catch (ResponseStatusException ex) {
            if (ex.getStatusCode() != HttpStatus.BAD_REQUEST) {
                throw ex;
            }
            auditLogService.log("ORDER_DESIGN_REVIEW_PASS_CUSTOMER_SUBMIT_SKIPPED", "ORDER", order.getId(),
                    String.valueOf(ex.getReason()));
        }
        auditLogService.log("ORDER_DESIGN_REVIEW_PASS_TO_CUSTOMER", "ORDER", order.getId(),
                "设计评审通过，系统已自动发给客户审阅");
    }

    /**
     * 跟单建模工艺通过后：保持待建模评审状态，自动把未确认建模稿发给客户审阅（不含跟单问候）。
     */
    private void afterCraftReviewPassSubmitToCustomer(Order order) {
        orderRepository.save(order);
        try {
            submitUnconfirmedModels(order, null, null, false);
        } catch (ResponseStatusException ex) {
            // 若暂无可发件（例如效果图缺失），仍保留 PASSED 评审，由跟单补资料后手工再推
            if (ex.getStatusCode() != HttpStatus.BAD_REQUEST) {
                throw ex;
            }
            auditLogService.log("ORDER_REVIEW_PASS_CUSTOMER_SUBMIT_SKIPPED", "ORDER", order.getId(),
                    String.valueOf(ex.getReason()));
        }
        auditLogService.log("ORDER_REVIEW_PASS_TO_CUSTOMER", "ORDER", order.getId(),
                "工艺评审通过，系统已自动发给客户审阅");
    }

    /**
     * 全部单件都已喷蜡且已付尾款、处于待发送生产时，自动进入生产中。
     * 不再在「待工艺验证」阶段因喷蜡齐而跳过客户确认与付款。
     */
    @Transactional
    public void passReviewIfAllPiecesWaxed(long orderId, long actorId) {
        Order order = orderRepository.findByIdForUpdate(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        entityManager.refresh(order, LockModeType.PESSIMISTIC_WRITE);
        if (order.getStatus() != OrderStatus.PENDING_PRODUCTION) {
            return;
        }
        if (!orderEventService.hasBalancePaid(orderId)) {
            return;
        }
        List<OrderPiece> pieces = orderPieceRepository.findByOrderIdOrderBySeqAsc(orderId);
        if (pieces.isEmpty()) {
            return;
        }
        String wax = ProductionProcess.WAX.name();
        for (OrderPiece piece : pieces) {
            if (piece.getId() == null
                    || !productionFollowLogRepository.existsByOrderIdAndPieceIdAndProcessCode(orderId, piece.getId(), wax)) {
                return;
            }
        }
        if (order.getFollowUp() == null) {
            order.setFollowUp(userRepository.getReferenceById(actorId));
        }
        enterProducingAfterPaidAndWaxed(order);
        orderEventService.record(orderId, OrderEventType.STATUS_CHANGE,
                AccountKind.STAFF, actorId, SecurityUtils.currentRoleApi().orElse("TRACKER"),
                "喷蜡齐套，订单进入生产中",
                "全部单件喷蜡完成且尾款已付", null, null);
        auditLogService.log("ORDER_WAXED_TO_PRODUCING", "ORDER", orderId, "全部单件喷蜡完成，进入生产中");
    }

    private void enterProducingAfterPaidAndWaxed(Order order) {
        try {
            order.transitionTo(OrderStatus.PRODUCING);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        orderRepository.save(order);
        auditLogService.log("ORDER_TO_PRODUCING", "ORDER", order.getId(), "订单进入生产中");
    }

    /**
     * 跟单员在生产阶段标记整单生产流程结束，订单进入「已完成」。
     */
    @Transactional
    public OrderInfoDto completeProduction(long orderId) {
        Order order = loadOrder(orderId);
        if (order.getStatus() != OrderStatus.PRODUCING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "仅「生产中」订单可执行生产完成");
        }
        if (!isAdminRole()) {
            if (!"TRACKER".equals(SecurityUtils.currentRoleApi().orElse(""))) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅跟单员或管理员可操作");
            }
            Long uid = requireUserId();
            User t = order.getFollowUp();
            if (t == null || !uid.equals(t.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅本单指派跟单员可标记生产完成");
            }
        }
        try {
            order.transitionTo(OrderStatus.COMPLETED);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        orderRepository.save(order);
        storefrontWalletService.settleOnCompleted(orderId);
        referralService.settleOnCompleted(orderId);
        auditLogService.log("ORDER_PRODUCTION_COMPLETED", "ORDER", orderId, "生产完成，订单已关闭");
        conversationService.ensureConversationByOrder(orderId, false);
        Long actorId = order.getFollowUp() != null && order.getFollowUp().getId() != null
                ? order.getFollowUp().getId()
                : requireUserId();
        orderEventService.record(orderId, OrderEventType.SHIPPING_ADDRESS_REQUEST,
                AccountKind.STAFF, actorId, "FOLLOW_UP",
                "请完善收货信息",
                "生产已经完成。请填写收货人、联系电话、国家或地区、详细地址和邮编（如有），方便我们安排发货。",
                null, null);
        return orderQueryService.getOrder(orderId);
    }

    @Transactional
    public OrderInfoDto updateQuotation(long orderId, OrderQuotationUpdateRequest req) {
        Order order = loadOrder(orderId);
        assertCanEditQuotation(order);
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
        // 买断/证书/保密由客户在 C 端生产选项中选择，售中改基础费用时不得覆盖
        q.setOtherNotes(req.getQuotationNotes());
        double total = nz(req.getTotalCost());
        if (total <= 0) {
            total = labor + add + nz(req.getOtherCost());
        }
        q.setSubtotal(BigDecimal.valueOf(total));
        q.setTotalAmount(BigDecimal.valueOf(total));
        q.setFinalized(false);
        q.setFinalizedTime(null);
        quotationRepository.save(q);
        orderEventService.record(orderId, OrderEventType.QUOTATION,
                AccountKind.STAFF, requireUserId(), SecurityUtils.currentRoleApi().orElse("SALES"),
                "更新报价", req.getQuotationNotes(), null, null);
        auditLogService.log("ORDER_UPDATE_QUOTATION", "ORDER", orderId, "更新报价信息");
        return orderQueryService.getOrder(orderId);
    }

    @Transactional
    public OrderInfoDto quoteBalance(long orderId, Object amountRaw) {
        Order order = loadOrder(orderId);
        if (!"TRACKER".equals(SecurityUtils.currentRoleApi().orElse("")) && !isAdminRole()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅跟单员可录入尾款报价");
        }
        if (!isAdminRole()) {
            Long uid = requireUserId();
            User t = order.getFollowUp();
            if (t != null && !uid.equals(t.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅本单指派跟单员可录入尾款报价");
            }
        }
        if (order.getStatus() != OrderStatus.PENDING_PRODUCTION) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "客户确认全部建模稿并进入待发送生产后，才能录入尾款报价");
        }
        if (!orderPieceService.allModelConfirmed(orderId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请先让客户确认全部建模稿后再录入尾款报价");
        }
        if (orderEventService.hasBalancePaid(orderId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "尾款已支付，无法再修改报价");
        }
        boolean revising = orderEventService.hasOpenBalancePayment(orderId);
        BigDecimal cnyAmount = parseAmount(amountRaw);
        if (cnyAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请填写有效的尾款金额");
        }
        Quotation q = quotationRepository.findByOrderId(orderId).orElseGet(() -> {
            Quotation n = new Quotation();
            n.setOrderId(orderId);
            return n;
        });
        BigDecimal rate = orderConfigurationService.cnyPerUsd();
        BigDecimal usdGross = CurrencyExchange.cnyToUsd(cnyAmount, rate);
        boolean publicityDiscount = PortalDepositPricing.qualifiesPublicityDiscount(q);
        BigDecimal discountUsd = publicityDiscount
                ? PortalDepositPricing.PUBLICITY_ALLOW_DISCOUNT_USD
                : BigDecimal.ZERO;
        BigDecimal chargedUsd = usdGross.subtract(discountUsd);
        if (chargedUsd.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "换算并应用宣传优惠后尾款须大于 0，请调整人民币金额");
        }
        chargedUsd = chargedUsd.setScale(2, RoundingMode.HALF_UP);
        q.setStaffAmountCny(cnyAmount.setScale(2, RoundingMode.HALF_UP));
        q.setFxCnyPerUsd(rate);
        q.setUsdBeforeDiscount(usdGross);
        q.setPublicityDiscountUsd(discountUsd.setScale(2, RoundingMode.HALF_UP));
        q.setSubtotal(chargedUsd);
        q.setTotalAmount(chargedUsd);
        q.setFinalized(true);
        q.setFinalizedTime(LocalDateTime.now());
        quotationRepository.save(q);
        Long uid = requireUserId();
        String content = buildBalancePaymentContent(cnyAmount, rate, usdGross, discountUsd, chargedUsd, revising);
        // 再次推送时新 BALANCE_PAYMENT 会使旧卡解析为 SUPERSEDED（已作废），客户只能付最新一笔
        orderEventService.record(orderId, OrderEventType.BALANCE_PAYMENT,
                AccountKind.STAFF, uid, "TRACKER",
                revising ? "支付尾款（已修订）" : OrderEventType.BALANCE_PAYMENT.getDescription(),
                content, null, null);
        auditLogService.log(revising ? "ORDER_BALANCE_QUOTE_REVISE" : "ORDER_BALANCE_QUOTE", "ORDER", orderId,
                (revising ? "跟单员修改尾款报价，原报价作废；" : "")
                        + "人民币报价 ¥" + cnyAmount.setScale(2, RoundingMode.HALF_UP).toPlainString()
                        + " → 客户应付 USD " + chargedUsd.toPlainString()
                        + (publicityDiscount ? "（公开宣传优惠）" : ""));
        return orderQueryService.getOrder(orderId);
    }

    private static String buildBalancePaymentContent(BigDecimal cny, BigDecimal rate,
                                                     BigDecimal usdGross, BigDecimal discountUsd,
                                                     BigDecimal chargedUsd, boolean revising) {
        StringBuilder sb = new StringBuilder();
        sb.append("尾款金额：$").append(chargedUsd.setScale(2, RoundingMode.HALF_UP).toPlainString());
        sb.append("\n人民币报价：¥").append(cny.setScale(2, RoundingMode.HALF_UP).toPlainString());
        sb.append("\n汇率：1 USD = ").append(rate.stripTrailingZeros().toPlainString()).append(" CNY");
        sb.append("\n换算后：$").append(usdGross.setScale(2, RoundingMode.HALF_UP).toPlainString());
        if (discountUsd != null && discountUsd.compareTo(BigDecimal.ZERO) > 0) {
            sb.append("\n限时优惠：公开宣传 -USD ")
                    .append(discountUsd.stripTrailingZeros().toPlainString());
        }
        if (revising) {
            sb.append("\n说明：跟单员已修订报价，此前未支付的尾款请求已作废");
        }
        return sb.toString();
    }

    private static BigDecimal parseAmount(Object raw) {
        if (raw == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请填写尾款金额");
        }
        try {
            return new BigDecimal(String.valueOf(raw).replaceAll("[^0-9.\\-]", ""));
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请填写有效的尾款金额");
        }
    }

    @Transactional
    public OrderInfoDto changeStatus(long orderId, OrderStatusChangeRequest req) {
        Order order = loadOrder(orderId);
        OrderStatus target = OrderStatus.fromString(req.getStatus());
        if (target == OrderStatus.CANCELLED) {
            sensitiveOperationService.verifySecondaryPassword(req.getSecondaryPassword());
        }
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
        assertAdminOrSalesAssignPermission();
        assertManualAssignStepConstraints(order, req);
        validateAssignTargetsActive(req);
        if (req.getSalesId() != null) {
            order.setSalesMid(requireActiveUserWithRole(req.getSalesId(), UserRole.SALES_MID, "售中客服"));
        }
        if (req.getDesignerId() != null) {
            order.setDesigner(requireActiveUserWithRole(req.getDesignerId(), UserRole.DESIGNER, "设计师"));
        }
        if (req.getModelerId() != null) {
            order.setModeler(requireActiveUserWithRole(req.getModelerId(), UserRole.MODELER, "建模师"));
        }
        if (req.getTrackerId() != null) {
            order.setFollowUp(requireActiveTracker(req.getTrackerId()));
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
        orderQueueService.enterQueue(neo);
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
        List<OrderPiece> sourcePieces = orderPieceRepository.findByOrderIdOrderBySeqAsc(sourceId);
        if (sourcePieces.isEmpty()) {
            orderPieceService.ensureDefaultPiece(neo.getId());
        } else {
            for (OrderPiece sp : sourcePieces) {
                OrderPiece np = new OrderPiece();
                np.setOrderId(neo.getId());
                np.setSeq(sp.getSeq());
                np.setName(sp.getName());
                np.setDesignConfirmed(false);
                np.setModelConfirmed(false);
                np.setReferenceImagesJson(sp.getReferenceImagesJson());
                orderPieceRepository.save(np);

                designInfoRepository.findByPieceId(sp.getId()).ifPresent(di -> {
                    DesignInfo n = new DesignInfo();
                    n.setOrderId(neo.getId());
                    n.setPieceId(np.getId());
                    n.setProcessInfoJson(di.getProcessInfoJson());
                    n.setStoneInfoJson(di.getStoneInfoJson());
                    n.setDesignImagesJson(di.getDesignImagesJson());
                    designInfoRepository.save(n);
                });
                modelingInfoRepository.findByPieceId(sp.getId()).ifPresent(mi -> {
                    ModelingInfo n = new ModelingInfo();
                    n.setOrderId(neo.getId());
                    n.setPieceId(np.getId());
                    n.setWeight(mi.getWeight());
                    n.setModelFilesJson(mi.getModelFilesJson());
                    n.setModelNotes(mi.getModelNotes());
                    n.setModelEffectImagesJson(mi.getModelEffectImagesJson());
                    modelingInfoRepository.save(n);
                });
            }
        }
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

    private static LocalDateTime parseOrderTime(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "orderTime 不能为空");
        }
        String value = raw.trim();
        List<DateTimeFormatter> fmts = List.of(
                DateTimeFormatter.ISO_LOCAL_DATE_TIME,
                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"),
                DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm:ss"),
                DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm")
        );
        for (DateTimeFormatter fmt : fmts) {
            try {
                return LocalDateTime.parse(value, fmt);
            } catch (DateTimeParseException ignored) {
                // try next formatter
            }
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "orderTime 格式不正确，支持示例：2026-04-08T16:44:13 或 2026-04-08 16:44:13");
    }

    private static double nz(Double d) {
        return d != null ? d : 0;
    }

    private boolean isAdminRole() {
        return "ADMIN".equals(SecurityUtils.currentRoleApi().orElse(null));
    }

    private boolean isAdminOrSalesAssignRole() {
        String r = SecurityUtils.currentRoleApi().orElse("");
        return "ADMIN".equals(r) || "SALES".equals(r);
    }

    private void assertAdminOrSalesAssignPermission() {
        if (!isAdminOrSalesAssignRole()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员或售中客服可手动分配订单人员");
        }
    }

    private void assertManualAssignStepConstraints(Order order, OrderAssignRequest req) {
        if (req.getDesignerId() != null) {
            OrderStatus st = order.getStatus();
            if (st != OrderStatus.PENDING_DESIGN && st != OrderStatus.DESIGNING) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前步骤不可更换设计师");
            }
        }
        if (req.getModelerId() != null) {
            OrderStatus st = order.getStatus();
            if (st != OrderStatus.PENDING_MODEL && st != OrderStatus.MODELING) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前步骤不可更换建模师");
            }
        }
        if (req.getTrackerId() != null) {
            if (order.getStatus() != OrderStatus.PENDING_REVIEW) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前步骤不可更换跟单员");
            }
        }
    }

    private void validateAssignTargetsActive(OrderAssignRequest req) {
        if (req.getSalesId() != null) {
            requireActiveUserWithRole(req.getSalesId(), UserRole.SALES_MID, "售中客服");
        }
        if (req.getDesignerId() != null) {
            requireActiveUserWithRole(req.getDesignerId(), UserRole.DESIGNER, "设计师");
        }
        if (req.getModelerId() != null) {
            requireActiveUserWithRole(req.getModelerId(), UserRole.MODELER, "建模师");
        }
        if (req.getTrackerId() != null) {
            requireActiveTracker(req.getTrackerId());
        }
    }

    private void requireActiveUser(long userId) {
        requireActiveUserWithRole(userId, null, "用户");
    }

    private User requireActiveUserWithRole(long userId, UserRole expectedRole, String roleLabel) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "用户不存在: " + userId));
        if (!UserStatus.ACTIVE.equals(u.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "用户不可用（非在职）: " + userId);
        }
        if (expectedRole != null && !expectedRole.equals(u.getRole())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "只能指派" + roleLabel + "，用户 " + userId + " 当前角色为 "
                            + (u.getRole() != null ? u.getRole().getDescription() : "空"));
        }
        return u;
    }

    private User requireActiveTracker(long userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "用户不存在: " + userId));
        if (!UserStatus.ACTIVE.equals(u.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "用户不可用（非在职）: " + userId);
        }
        if (!UserRole.FOLLOW_UP.equals(u.getRole()) && !UserRole.ADMIN.equals(u.getRole())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "只能指派跟单员或管理员，用户 " + userId + " 当前角色为 "
                            + (u.getRole() != null ? u.getRole().getDescription() : "空"));
        }
        return u;
    }

    private Long requireUserId() {
        return SecurityUtils.currentStaffUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
    }

    private void assertCanEditDesign(Order order) {
        if (isAdminRole()) {
            return;
        }
        if (!"DESIGNER".equals(SecurityUtils.currentRoleApi().orElse(""))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅设计师或管理员可保存设计信息");
        }
        Long uid = requireUserId();
        User d = order.getDesigner();
        if (d != null && !uid.equals(d.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅本单指派设计师可保存设计信息");
        }
    }

    private void assertReassignDesigner(Order order, Long newDesignerId) {
        if (newDesignerId == null) {
            return;
        }
        Long cur = order.getDesigner() != null ? order.getDesigner().getId() : null;
        if (Objects.equals(newDesignerId, cur)) {
            return;
        }
        // 管理员与售中客服可改派；设计师本人不可改
        if (isAdminRole() || isSalesRole()) {
            return;
        }
        if (cur == null && newDesignerId.equals(requireUserId())) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员或售中客服可变更指派设计师");
    }

    private boolean isSalesRole() {
        return "SALES".equals(SecurityUtils.currentRoleApi().orElse(""));
    }

    private void assertCanEditModel(Order order) {
        if (isAdminRole()) {
            return;
        }
        if (!"MODELER".equals(SecurityUtils.currentRoleApi().orElse(""))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅建模师或管理员可保存建模信息");
        }
        Long uid = requireUserId();
        User m = order.getModeler();
        if (m != null && !uid.equals(m.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅本单指派建模师可保存建模信息");
        }
    }

    private void assertReassignModeler(Order order, Long newModelerId) {
        if (newModelerId == null) {
            return;
        }
        Long cur = order.getModeler() != null ? order.getModeler().getId() : null;
        if (Objects.equals(newModelerId, cur)) {
            return;
        }
        if (isAdminRole()) {
            return;
        }
        if (cur == null && newModelerId.equals(requireUserId())) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可变更指派建模师");
    }

    private void assertCanEditReview(Order order) {
        if (isAdminRole()) {
            return;
        }
        if (!"TRACKER".equals(SecurityUtils.currentRoleApi().orElse(""))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅跟单员或管理员可保存评审信息");
        }
        // 质量审核为共享队列：任一跟单员可审；updateReview 会把 follow_up 记为当前操作人
    }

    private void assertCanEditQuotation(Order order) {
        if (isAdminRole()) {
            return;
        }
        if (!"SALES".equals(SecurityUtils.currentRoleApi().orElse(""))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅售中客服或管理员可保存报价信息");
        }
        Long uid = requireUserId();
        User s = order.getSalesMid();
        if (s != null && !uid.equals(s.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅本单指派售中客服可保存报价信息");
        }
    }
}
