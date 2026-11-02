package com.jewelry.system.service;

import com.jewelry.system.dto.order.OrderInfoDto;
import com.jewelry.system.dto.order.OrderShipmentDto;
import com.jewelry.system.entity.*;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;

@Service
@RequiredArgsConstructor
public class OrderQueryService {

    private final OrderRepository orderRepository;
    private final OrderDetailRepository orderDetailRepository;
    private final DesignInfoRepository designInfoRepository;
    private final ModelingInfoRepository modelingInfoRepository;
    private final ProcessReviewRepository processReviewRepository;
    private final QuotationRepository quotationRepository;
    private final OrderDetailAssembler orderDetailAssembler;
    private final OrderPieceRepository orderPieceRepository;
    private final OrderPieceService orderPieceService;
    private final OrderShipmentRepository shipmentRepository;
    private final OrderEventRepository orderEventRepository;
    private final OrderEventService orderEventService;

    @Transactional(readOnly = true)
    public Page<OrderInfoDto> pageOrders(
            Pageable pageable,
            String keyword,
            String status,
            Long designerId,
            Long modelerId,
            Long salesId,
            String startDate,
            String endDate
    ) {
        Specification<Order> spec = OrderSpecifications.build(
                keyword, status, designerId, modelerId, salesId, startDate, endDate
        );
        // 列表：加急置顶；其余按请求排序或创建时间倒序
        Sort secondary = pageable.getSort().isSorted()
                ? pageable.getSort()
                : Sort.by(Sort.Order.desc("createdAt"));
        Pageable sorted = PageRequest.of(
                pageable.getPageNumber(),
                pageable.getPageSize(),
                OrderQueueService.rushFirstSort().and(secondary));
        // 列表：全员可浏览全部订单；具体操作权限在写接口与前端任务区控制
        return orderRepository.findAll(spec, sorted).map(o -> OrderApiMapper.toOrderInfo(o, false));
    }

    @Transactional(readOnly = true)
    public OrderInfoDto getOrder(long id) {
        Order o = orderRepository.findWithGraphById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        // 详情：已登录成员均可查看；写操作在 OrderCommandService / OrderFileService 中校验角色与指派
        OrderInfoDto dto = OrderApiMapper.toOrderInfo(o, true);
        OrderDetail od = orderDetailRepository.findByOrderId(id).orElse(null);
        DesignInfo di = designInfoRepository.findByOrderId(id).orElse(null);
        ModelingInfo mi = modelingInfoRepository.findByOrderId(id).orElse(null);
        List<DesignInfo> allDesign = designInfoRepository.findAllByOrderId(id);
        List<ModelingInfo> allModel = modelingInfoRepository.findAllByOrderId(id);
        List<OrderPiece> pieces = orderPieceRepository.findByOrderIdOrderBySeqAsc(id);
        ProcessReview modelPr = processReviewRepository
                .findTopByOrderIdAndReviewKindOrderByIdDesc(id, com.jewelry.system.enums.ReviewKind.MODEL)
                .orElse(null);
        ProcessReview designPr = processReviewRepository
                .findTopByOrderIdAndReviewKindOrderByIdDesc(id, com.jewelry.system.enums.ReviewKind.DESIGN)
                .orElse(null);
        Quotation q = quotationRepository.findByOrderId(id).orElse(null);
        OrderInfoDto enriched = orderDetailAssembler.enrich(dto, o, od, di, mi, modelPr, q, pieces, allDesign, allModel);
        enriched.setDesignReviewInfo(orderDetailAssembler.buildReview(o, designPr, com.jewelry.system.enums.ReviewKind.DESIGN));
        boolean paid = orderEventService.hasBalancePaid(id);
        boolean quoteOpen = orderEventService.hasOpenBalancePayment(id);
        boolean finalized = enriched.getQuotationInfo() != null
                && Boolean.TRUE.equals(enriched.getQuotationInfo().getFinalized());
        enriched.setBalancePaid(paid);
        enriched.setBalanceQuoteSent(paid || quoteOpen || finalized);
        // 按件质量审：须「全部单件质量通过」才算进入客户审阅等待；不能再用最新一条 ProcessReview=PASSED
        // （单件通过也会写 PASSED，否则会把仍有待审单件的订单从质量审核队列误剔除）。
        enriched.setAwaitingCustomerModelConfirm(
                o.getStatus() == OrderStatus.PENDING_REVIEW
                        && orderPieceService.allModelQualityPassed(id));
        enriched.setAwaitingCustomerDesignConfirm(
                o.getStatus() == OrderStatus.PENDING_DESIGN_REVIEW
                        && orderPieceService.allDesignQualityPassed(id));
        if (o.getStatus() == OrderStatus.PENDING_DESIGN_REVIEW) {
            enriched.setQualityReviewKind("DESIGN");
        } else if (o.getStatus() == OrderStatus.PENDING_REVIEW) {
            enriched.setQualityReviewKind("MODEL");
        }
        enriched.setBalanceUnpaidPendingProduction(
                o.getStatus() == OrderStatus.PENDING_PRODUCTION && !paid);
        return enriched;
    }

    @Transactional(readOnly = true)
    public List<OrderInfoDto> search(String keyword, int limit) {
        int size = Math.min(Math.max(limit, 1), 50);
        Pageable p = PageRequest.of(0, size);
        Specification<Order> spec = OrderSpecifications.build(keyword, null, null, null, null, null, null);
        return orderRepository.findAll(spec, p).stream().map(o -> OrderApiMapper.toOrderInfo(o, false)).toList();
    }

    // ================= 工作台查询 =================

    @Transactional(readOnly = true)
    public Page<OrderInfoDto> pageDesignerTodo(Pageable pageable, Long designerId, Boolean isB2b) {
        Specification<Order> spec = (root, query, cb) -> {
            var predicates = new java.util.ArrayList<Predicate>();
            predicates.add(cb.equal(root.get("designer").get("id"), designerId));
            predicates.add(root.get("status").in(OrderStatus.PENDING_DESIGN, OrderStatus.DESIGNING));
            if (isB2b != null) {
                predicates.add(cb.equal(root.get("isB2b"), isB2b));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return withPieceRevisionFlag(orderRepository.findAll(spec, OrderQueueService.rushFirstPageable(pageable)), true);
    }

    @Transactional(readOnly = true)
    public Page<OrderInfoDto> pageDesignerDone(Pageable pageable, Long designerId, Boolean isB2b) {
        Specification<Order> spec = (root, query, cb) -> {
            var predicates = new java.util.ArrayList<Predicate>();
            predicates.add(cb.equal(root.get("designer").get("id"), designerId));
            predicates.add(root.get("status").in(
                    OrderStatus.PENDING_MODEL,
                    OrderStatus.MODELING,
                    OrderStatus.PENDING_REVIEW,
                    OrderStatus.PENDING_PRODUCTION,
                    OrderStatus.PRODUCING,
                    OrderStatus.COMPLETED
            ));
            if (isB2b != null) {
                predicates.add(cb.equal(root.get("isB2b"), isB2b));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return orderRepository.findAll(spec, pageable).map(o -> OrderApiMapper.toOrderInfo(o, false));
    }

    @Transactional(readOnly = true)
    public Page<OrderInfoDto> pageModelerTodo(Pageable pageable, Long modelerId, Boolean isB2b) {
        Specification<Order> spec = (root, query, cb) -> {
            var predicates = new java.util.ArrayList<Predicate>();
            predicates.add(cb.equal(root.get("modeler").get("id"), modelerId));
            predicates.add(root.get("status").in(OrderStatus.PENDING_MODEL, OrderStatus.MODELING));
            if (isB2b != null) {
                predicates.add(cb.equal(root.get("isB2b"), isB2b));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return withPieceRevisionFlag(orderRepository.findAll(spec, OrderQueueService.rushFirstPageable(pageable)), false);
    }

    @Transactional(readOnly = true)
    public Page<OrderInfoDto> pageModelerDone(Pageable pageable, Long modelerId, Boolean isB2b) {
        Specification<Order> spec = (root, query, cb) -> {
            var predicates = new java.util.ArrayList<Predicate>();
            predicates.add(cb.equal(root.get("modeler").get("id"), modelerId));
            predicates.add(root.get("status").in(
                    OrderStatus.PENDING_REVIEW,
                    OrderStatus.PENDING_PRODUCTION,
                    OrderStatus.PRODUCING,
                    OrderStatus.COMPLETED
            ));
            if (isB2b != null) {
                predicates.add(cb.equal(root.get("isB2b"), isB2b));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return orderRepository.findAll(spec, pageable).map(o -> OrderApiMapper.toOrderInfo(o, false));
    }

    @Transactional(readOnly = true)
    public Page<OrderInfoDto> pageTrackerProducing(Pageable pageable, Long trackerId, Boolean isB2b) {
        Specification<Order> spec = (root, query, cb) -> {
            var predicates = new java.util.ArrayList<Predicate>();
            predicates.add(cb.equal(root.get("followUp").get("id"), trackerId));
            predicates.add(root.get("status").in(OrderStatus.PENDING_PRODUCTION, OrderStatus.PRODUCING));
            if (isB2b != null) {
                predicates.add(cb.equal(root.get("isB2b"), isB2b));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return orderRepository.findAll(spec, pageable).map(o -> getOrder(o.getId()));
    }

    /**
     * 质量审核待办：待设计评审 / 待建模评审，且尚有单件未过质量审（已全部通过、等客户审阅的不进队列）。
     * 共享队列：不限 follow_up，任一跟单员可审；操作时会把跟单员记到订单上。
     */
    @Transactional(readOnly = true)
    public Page<OrderInfoDto> pageTrackerTodo(Pageable pageable, Long trackerId, Boolean isB2b) {
        // trackerId 保留入参：操作评审时仍会写入 follow_up；队列本身共享给所有跟单员
        Specification<Order> spec = (root, query, cb) -> {
            var predicates = new java.util.ArrayList<Predicate>();
            predicates.add(root.get("status").in(
                    OrderStatus.PENDING_DESIGN_REVIEW, OrderStatus.PENDING_REVIEW));
            if (isB2b != null) {
                predicates.add(cb.equal(root.get("isB2b"), isB2b));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        // 先按加急序取足量候选，再按「是否仍待质量审」过滤（避免只取一页后被滤空）
        int fetch = Math.max(pageable.getPageSize() * (pageable.getPageNumber() + 1) * 5, 50);
        Pageable fetchPageable = OrderQueueService.rushFirstPageable(PageRequest.of(0, fetch));
        List<OrderInfoDto> eligible = orderRepository.findAll(spec, fetchPageable).getContent().stream()
                .map(o -> getOrder(o.getId()))
                .filter(dto -> !Boolean.TRUE.equals(dto.getAwaitingCustomerModelConfirm())
                        && !Boolean.TRUE.equals(dto.getAwaitingCustomerDesignConfirm()))
                .toList();
        int from = (int) pageable.getOffset();
        int to = Math.min(from + pageable.getPageSize(), eligible.size());
        List<OrderInfoDto> slice = from >= eligible.size() ? List.of() : eligible.subList(from, to);
        return new PageImpl<>(slice, pageable, eligible.size());
    }

    @Transactional(readOnly = true)
    public Page<OrderInfoDto> pageTrackerBalanceTodo(Pageable pageable, Long trackerId, Boolean isB2b) {
        Specification<Order> spec = (root, query, cb) -> {
            var predicates = new java.util.ArrayList<Predicate>();
            predicates.add(cb.equal(root.get("followUp").get("id"), trackerId));
            // 客户全件确认后进入待发送生产；未付尾款期间跟单可报价、禁止转发
            predicates.add(cb.equal(root.get("status"), OrderStatus.PENDING_PRODUCTION));
            if (isB2b != null) {
                predicates.add(cb.equal(root.get("isB2b"), isB2b));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        Page<Order> page = orderRepository.findAll(spec, pageable);
        List<OrderInfoDto> filtered = page.getContent().stream()
                .map(o -> getOrder(o.getId()))
                .filter(this::needsTrackerBalanceQuote)
                .toList();
        return new PageImpl<>(filtered, pageable, filtered.size());
    }

    /**
     * 准备生产主列表：仍处「待发送生产」的订单。
     * 含未报价、待付款，以及已付款但尚未进入生产中（跟单可标记转发喷蜡文件）的订单。
     * 付尾款后不得从本列表消失，否则跟单无法再点「标记待发送」。
     */
    private boolean needsTrackerBalanceQuote(OrderInfoDto dto) {
        if (dto == null) {
            return false;
        }
        return "PENDING_PRODUCTION".equals(dto.getCurrentStatus());
    }

    @Transactional(readOnly = true)
    public Page<OrderInfoDto> pageTrackerDone(Pageable pageable, Long trackerId, Boolean isB2b) {
        Specification<Order> spec = (root, query, cb) -> {
            var predicates = new java.util.ArrayList<Predicate>();
            predicates.add(cb.equal(root.get("followUp").get("id"), trackerId));
            predicates.add(cb.equal(root.get("status"), OrderStatus.COMPLETED));
            if (isB2b != null) {
                predicates.add(cb.equal(root.get("isB2b"), isB2b));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return orderRepository.findAll(spec, pageable).map(o -> OrderApiMapper.toOrderInfo(o, false));
    }

    /** 生产已完成、尚未录入物流单号的订单，供跟单员发货。 */
    @Transactional(readOnly = true)
    public Page<OrderInfoDto> pageTrackerAwaitingShipment(Pageable pageable, Long trackerId, Boolean isB2b) {
        Specification<Order> spec = (root, query, cb) -> {
            var predicates = new java.util.ArrayList<Predicate>();
            predicates.add(cb.equal(root.get("followUp").get("id"), trackerId));
            predicates.add(cb.equal(root.get("status"), OrderStatus.COMPLETED));
            if (isB2b != null) {
                predicates.add(cb.equal(root.get("isB2b"), isB2b));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        Page<Order> completed = orderRepository.findAll(
                spec,
                PageRequest.of(0, 200, Sort.by(Sort.Direction.DESC, "id")));
        List<Long> ids = completed.getContent().stream().map(Order::getId).toList();
        Set<Long> shipped = ids.isEmpty()
                ? Set.of()
                : new HashSet<>(shipmentRepository.findOrderIdsIn(ids));
        List<OrderInfoDto> waiting = completed.getContent().stream()
                .filter(order -> !shipped.contains(order.getId()))
                .map(order -> OrderApiMapper.toOrderInfo(order, false))
                .toList();
        int page = Math.max(pageable.getPageNumber(), 0);
        int size = pageable.getPageSize() > 0 ? pageable.getPageSize() : 50;
        int from = Math.min(page * size, waiting.size());
        int to = Math.min(from + size, waiting.size());
        return new PageImpl<>(waiting.subList(from, to), PageRequest.of(page, size), waiting.size());
    }

    /** 本跟单员已录入物流的订单，按物流更新时间倒序，供改单号或重新发货。 */
    @Transactional(readOnly = true)
    public Page<OrderInfoDto> pageTrackerShipped(Pageable pageable, Long trackerId, Boolean isB2b) {
        int page = Math.max(pageable.getPageNumber(), 0);
        int size = pageable.getPageSize() > 0 ? Math.min(pageable.getPageSize(), 100) : 50;
        Specification<OrderShipment> spec = (root, query, cb) -> {
            Subquery<Long> ids = query.subquery(Long.class);
            Root<Order> order = ids.from(Order.class);
            var orderPreds = new ArrayList<Predicate>();
            orderPreds.add(cb.equal(order.get("followUp").get("id"), trackerId));
            if (isB2b != null) {
                orderPreds.add(cb.equal(order.get("isB2b"), isB2b));
            }
            ids.select(order.get("id")).where(orderPreds.toArray(Predicate[]::new));
            return root.get("orderId").in(ids);
        };
        Page<OrderShipment> shipments = shipmentRepository.findAll(
                spec,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "updatedAt")));
        List<Long> orderIds = shipments.getContent().stream().map(OrderShipment::getOrderId).toList();
        Map<Long, Order> orders = new HashMap<>();
        if (!orderIds.isEmpty()) {
            for (Order order : orderRepository.findAllById(orderIds)) {
                orders.put(order.getId(), order);
            }
        }
        List<OrderInfoDto> content = new ArrayList<>();
        for (OrderShipment shipment : shipments.getContent()) {
            Order order = orders.get(shipment.getOrderId());
            if (order == null) {
                continue;
            }
            OrderInfoDto dto = OrderApiMapper.toOrderInfo(order, false);
            dto.setShipment(toShipmentSummary(shipment));
            content.add(dto);
        }
        return new PageImpl<>(content, shipments.getPageable(), shipments.getTotalElements());
    }

    private static OrderShipmentDto toShipmentSummary(OrderShipment shipment) {
        DateTimeFormatter iso = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
        return OrderShipmentDto.builder()
                .id(shipment.getId())
                .orderId(shipment.getOrderId())
                .trackingNumber(shipment.getTrackingNumber())
                .carrierCode(shipment.getCarrierCode())
                .carrierName(shipment.getCarrierName())
                .status(shipment.getStatus())
                .statusLabel(shipment.getStatusLabel())
                .events(List.of())
                .queryUrl(shipment.getQueryUrl())
                .shippedAt(shipment.getShippedAt() != null ? iso.format(shipment.getShippedAt()) : null)
                .deliveredAt(shipment.getDeliveredAt() != null ? iso.format(shipment.getDeliveredAt()) : null)
                .build();
    }

    /** 设计师待办看设计驳回，建模师待办看建模驳回。 */
    private Page<OrderInfoDto> withPieceRevisionFlag(Page<Order> raw, boolean designSide) {
        List<Long> ids = raw.getContent().stream().map(Order::getId).filter(id -> id != null).toList();
        Set<Long> pending = new HashSet<>();
        if (!ids.isEmpty()) {
            List<Long> found = designSide
                    ? designInfoRepository.findOrderIdsWithOpenCustomerDesignReject(ids)
                    : modelingInfoRepository.findOrderIdsWithOpenCustomerModelReject(ids);
            if (found != null) {
                pending.addAll(found);
            }
        }
        List<OrderInfoDto> mapped = raw.getContent().stream().map(o -> {
            OrderInfoDto dto = OrderApiMapper.toOrderInfo(o, false);
            if (o.getId() != null && pending.contains(o.getId())) {
                dto.setPieceCustomerRevisionPending(Boolean.TRUE);
            }
            return dto;
        }).toList();
        return new PageImpl<>(mapped, raw.getPageable(), raw.getTotalElements());
    }
}
