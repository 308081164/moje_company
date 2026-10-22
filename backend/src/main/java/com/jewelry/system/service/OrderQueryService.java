package com.jewelry.system.service;

import com.jewelry.system.dto.order.OrderInfoDto;
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

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import jakarta.persistence.criteria.Predicate;

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
    private final OrderShipmentRepository shipmentRepository;

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
        // 列表：全员可浏览全部订单；具体操作权限在写接口与前端任务区控制
        return orderRepository.findAll(spec, pageable).map(o -> OrderApiMapper.toOrderInfo(o, false));
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
        ProcessReview pr = processReviewRepository.findTopByOrderIdOrderByIdDesc(id).orElse(null);
        Quotation q = quotationRepository.findByOrderId(id).orElse(null);
        return orderDetailAssembler.enrich(dto, o, od, di, mi, pr, q, pieces, allDesign, allModel);
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
        return orderRepository.findAll(spec, pageable).map(o -> OrderApiMapper.toOrderInfo(o, false));
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
        return orderRepository.findAll(spec, pageable).map(o -> OrderApiMapper.toOrderInfo(o, false));
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

    @Transactional(readOnly = true)
    public Page<OrderInfoDto> pageTrackerTodo(Pageable pageable, Long trackerId, Boolean isB2b) {
        Specification<Order> spec = (root, query, cb) -> {
            var predicates = new java.util.ArrayList<Predicate>();
            predicates.add(cb.equal(root.get("followUp").get("id"), trackerId));
            predicates.add(cb.equal(root.get("status"), OrderStatus.PENDING_REVIEW));
            if (isB2b != null) {
                predicates.add(cb.equal(root.get("isB2b"), isB2b));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return orderRepository.findAll(spec, pageable).map(o -> getOrder(o.getId()));
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
}
