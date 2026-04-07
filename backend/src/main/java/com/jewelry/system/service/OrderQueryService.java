package com.jewelry.system.service;

import com.jewelry.system.dto.order.OrderInfoDto;
import com.jewelry.system.entity.*;
import com.jewelry.system.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

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
        return orderRepository.findAll(spec, pageable).map(OrderApiMapper::toOrderInfo);
    }

    @Transactional(readOnly = true)
    public OrderInfoDto getOrder(long id) {
        Order o = orderRepository.findWithGraphById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        OrderInfoDto dto = OrderApiMapper.toOrderInfo(o);
        OrderDetail od = orderDetailRepository.findByOrderId(id).orElse(null);
        DesignInfo di = designInfoRepository.findByOrderId(id).orElse(null);
        ModelingInfo mi = modelingInfoRepository.findByOrderId(id).orElse(null);
        ProcessReview pr = processReviewRepository.findTopByOrderIdOrderByIdDesc(id).orElse(null);
        Quotation q = quotationRepository.findByOrderId(id).orElse(null);
        return orderDetailAssembler.enrich(dto, o, od, di, mi, pr, q);
    }

    @Transactional(readOnly = true)
    public List<OrderInfoDto> search(String keyword, int limit) {
        int size = Math.min(Math.max(limit, 1), 50);
        Pageable p = PageRequest.of(0, size);
        Specification<Order> spec = OrderSpecifications.build(keyword, null, null, null, null, null, null);
        return orderRepository.findAll(spec, p).stream().map(OrderApiMapper::toOrderInfo).toList();
    }
}
