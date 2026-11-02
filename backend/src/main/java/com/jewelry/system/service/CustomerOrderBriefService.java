package com.jewelry.system.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.customerbrief.CustomerBriefCatalog;
import com.jewelry.system.dto.order.CustomerBriefViewDto;
import com.jewelry.system.dto.portal.CustomerBriefFormDto;
import com.jewelry.system.dto.portal.CustomerBriefSubmitRequest;
import com.jewelry.system.entity.DesignInfo;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.OrderConversation;
import com.jewelry.system.entity.OrderCustomerBrief;
import com.jewelry.system.entity.OrderDetail;
import com.jewelry.system.entity.OrderPiece;
import com.jewelry.system.enums.JewelryType;
import com.jewelry.system.repository.DesignInfoRepository;
import com.jewelry.system.repository.OrderConversationRepository;
import com.jewelry.system.repository.OrderCustomerBriefRepository;
import com.jewelry.system.repository.OrderDetailRepository;
import com.jewelry.system.repository.OrderPieceRepository;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.PortalCustomerOrderBindingRepository;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerOrderBriefService {

    private static final TypeReference<List<CustomerBriefSubmitRequest.Piece>> PIECE_LIST =
            new TypeReference<>() {};

    private final OrderCustomerBriefRepository briefRepository;
    private final OrderRepository orderRepository;
    private final OrderPieceRepository pieceRepository;
    private final OrderDetailRepository orderDetailRepository;
    private final DesignInfoRepository designInfoRepository;
    private final PortalCustomerOrderBindingRepository bindingRepository;
    private final OrderConversationRepository conversationRepository;
    private final ConversationService conversationService;
    private final ObjectMapper objectMapper;
    private final FulfillmentDispatchService fulfillmentDispatchService;

    @Transactional(readOnly = true)
    public CustomerBriefFormDto formForCustomer(long orderId) {
        requireOwner(orderId);
        Order order = requireOrder(orderId);
        OrderDetail detail = orderDetailRepository.findByOrderId(orderId).orElse(null);
        String metal = detail != null ? detail.getMaterialType() : null;
        OrderCustomerBrief brief = briefRepository.findByOrderId(orderId).orElse(null);
        Map<Long, CustomerBriefSubmitRequest.Piece> saved = index(readPieces(brief));
        List<OrderPiece> pieces = pieceRepository.findByOrderIdOrderBySeqAsc(orderId);
        List<CustomerBriefSubmitRequest.Piece> answers = new ArrayList<>();
        List<CustomerBriefFormDto.PieceName> names = new ArrayList<>();
        for (OrderPiece piece : pieces) {
            names.add(CustomerBriefFormDto.PieceName.builder()
                    .pieceId(piece.getId())
                    .seq(piece.getSeq())
                    .name(piece.getName())
                    .build());
            CustomerBriefSubmitRequest.Piece answer = saved.get(piece.getId());
            if (answer == null) {
                answer = new CustomerBriefSubmitRequest.Piece();
                answer.setPieceId(piece.getId());
                if (piece.getJewelryType() != null) {
                    answer.setJewelryType(piece.getJewelryType().name());
                }
            }
            answer.setPieceId(piece.getId());
            answers.add(answer);
        }
        return CustomerBriefFormDto.builder()
                .orderId(orderId)
                .orderNumber(order.getOrderNumber())
                .metalCode(metal)
                .metalLabel(labelOrInfo(metal, order.getMaterialInfo()))
                .inlayAllowed(CustomerBriefCatalog.allowsInlay(metal))
                .budgetBand(brief != null ? brief.getBudgetBand() : null)
                .submitted(brief != null && brief.getSubmittedAt() != null)
                .pieces(answers)
                .pieceNames(names)
                .build();
    }

    @Transactional
    public void submit(long orderId, CustomerBriefSubmitRequest request) {
        requireOwner(orderId);
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请填写问卷");
        }
        Order order = requireOrder(orderId);
        List<OrderPiece> pieces = pieceRepository.findByOrderIdOrderBySeqAsc(orderId);
        if (pieces.stream().anyMatch(p -> Boolean.TRUE.equals(p.getDesignConfirmed()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "已有单件确认了设计，不能再改问卷");
        }
        OrderDetail detail = orderDetailRepository.findByOrderId(orderId).orElse(null);
        String metal = detail != null ? detail.getMaterialType() : null;
        Set<Long> expected = pieces.stream().map(OrderPiece::getId).collect(Collectors.toSet());
        CustomerBriefCatalog.validate(metal, request.getBudgetBand(), request.getPieces(), expected);

        OrderCustomerBrief brief = briefRepository.findByOrderId(orderId).orElseGet(() -> {
            OrderCustomerBrief created = new OrderCustomerBrief();
            created.setOrderId(orderId);
            return created;
        });
        boolean first = brief.getSubmittedAt() == null;
        Map<Long, CustomerBriefSubmitRequest.Piece> previous = index(readPieces(brief));
        Map<Long, String> names = new HashMap<>();
        for (OrderPiece piece : pieces) {
            names.put(piece.getId(), piece.getName());
        }
        String nextSize = CustomerBriefCatalog.sizeSummary(request.getPieces(), names);
        if (detail == null) {
            detail = new OrderDetail();
            detail.setOrderId(orderId);
        }
        // 多件尺寸只按单件写入 design_info；订单级 hand_size 仅在单件订单时同步，避免每件都显示全量汇总
        String previousSize = brief.getSizeSummary();
        if (pieces.size() == 1) {
            String only = CustomerBriefCatalog.sizeOnly(request.getPieces().get(0));
            if (!StringUtils.hasText(detail.getHandSize()) || detail.getHandSize().equals(previousSize)
                    || detail.getHandSize().equals(only)) {
                detail.setHandSize(StringUtils.hasText(only) ? only : null);
            }
        } else if (StringUtils.hasText(detail.getHandSize()) && detail.getHandSize().equals(previousSize)) {
            // 清掉历史「件A：…；件B：…」汇总，改由各件 design_info.hand_size 展示
            detail.setHandSize(null);
        }
        orderDetailRepository.save(detail);

        for (CustomerBriefSubmitRequest.Piece answer : request.getPieces()) {
            OrderPiece piece = pieces.stream()
                    .filter(p -> p.getId().equals(answer.getPieceId()))
                    .findFirst()
                    .orElseThrow();
            piece.setJewelryType(JewelryType.parse(answer.getJewelryType()));
            pieceRepository.save(piece);
            applyPlating(orderId, answer, previous.get(answer.getPieceId()));
            applyHandSize(orderId, answer, previous.get(answer.getPieceId()));
        }

        brief.setBudgetBand(request.getBudgetBand().trim());
        brief.setPiecesJson(writePieces(request.getPieces()));
        brief.setSizeSummary(nextSize);
        brief.setSubmittedAt(LocalDateTime.now());
        briefRepository.save(brief);

        fulfillmentDispatchService.onBriefSubmitted(orderId);
        notifyChat(order, first);
    }

    /** 已提交问卷时返回指定单件的尺寸文案；未提交或无该件则空。用于多件订单展示本件尺寸。 */
    @Transactional(readOnly = true)
    public String sizeLabelForPiece(long orderId, Long pieceId) {
        if (pieceId == null) {
            return "";
        }
        OrderCustomerBrief brief = briefRepository.findByOrderId(orderId).orElse(null);
        if (brief == null || brief.getSubmittedAt() == null) {
            return "";
        }
        for (CustomerBriefSubmitRequest.Piece piece : readPieces(brief)) {
            if (pieceId.equals(piece.getPieceId())) {
                return CustomerBriefCatalog.sizeOnly(piece);
            }
        }
        return "";
    }

    @Transactional(readOnly = true)
    public boolean pieceWantsEngraving(long orderId, long pieceId) {
        OrderCustomerBrief brief = briefRepository.findByOrderId(orderId).orElse(null);
        if (brief == null || brief.getSubmittedAt() == null) {
            return false;
        }
        for (CustomerBriefSubmitRequest.Piece piece : readPieces(brief)) {
            if (pieceId == piece.getPieceId()) {
                return CustomerBriefCatalog.wantsEngraving(piece);
            }
        }
        return false;
    }

    /** pieceId -> 是否需要刻字；未提交问卷的件不在 map 中 */
    @Transactional(readOnly = true)
    public Map<Long, Boolean> engravingWantsByPiece(long orderId) {
        OrderCustomerBrief brief = briefRepository.findByOrderId(orderId).orElse(null);
        if (brief == null || brief.getSubmittedAt() == null) {
            return Map.of();
        }
        Map<Long, Boolean> out = new HashMap<>();
        for (CustomerBriefSubmitRequest.Piece piece : readPieces(brief)) {
            if (piece.getPieceId() != null) {
                out.put(piece.getPieceId(), CustomerBriefCatalog.wantsEngraving(piece));
            }
        }
        return out;
    }

    @Transactional(readOnly = true)
    public CustomerBriefViewDto viewFor(Order order, OrderDetail detail) {
        if (order == null || order.getId() == null) {
            return null;
        }
        String metal = detail != null ? detail.getMaterialType() : null;
        OrderCustomerBrief brief = briefRepository.findByOrderId(order.getId()).orElse(null);
        List<CustomerBriefViewDto.Piece> pieceViews = new ArrayList<>();
        if (brief != null && brief.getSubmittedAt() != null) {
            for (CustomerBriefSubmitRequest.Piece piece : readPieces(brief)) {
                pieceViews.add(CustomerBriefViewDto.Piece.builder()
                        .pieceId(piece.getPieceId())
                        .summary(CustomerBriefCatalog.summarizePiece(piece))
                        .build());
            }
        }
        boolean submitted = brief != null && brief.getSubmittedAt() != null;
        if (!submitted && !StringUtils.hasText(metal) && !StringUtils.hasText(order.getMaterialInfo())) {
            return null;
        }
        return CustomerBriefViewDto.builder()
                .submitted(submitted)
                .metalCode(metal)
                .metalLabel(labelOrInfo(metal, order.getMaterialInfo()))
                .inlayAllowed(CustomerBriefCatalog.allowsInlay(metal))
                .budgetBand(brief != null ? brief.getBudgetBand() : null)
                .budgetLabel(brief != null ? CustomerBriefCatalog.budgetLabel(brief.getBudgetBand()) : "")
                .pieces(pieceViews)
                .build();
    }

    private void applyPlating(long orderId, CustomerBriefSubmitRequest.Piece answer,
                              CustomerBriefSubmitRequest.Piece previous) {
        String next = CustomerBriefCatalog.platingLabel(answer.getPlating());
        if (!StringUtils.hasText(next)) {
            return;
        }
        String prev = previous == null ? "" : CustomerBriefCatalog.platingLabel(previous.getPlating());
        DesignInfo design = designInfoFor(orderId, answer.getPieceId());
        String current = design.getPlating();
        if (!StringUtils.hasText(current) || current.equals(prev)) {
            design.setPlating(next);
            designInfoRepository.save(design);
        }
    }

    private void applyHandSize(long orderId, CustomerBriefSubmitRequest.Piece answer,
                               CustomerBriefSubmitRequest.Piece previous) {
        String next = CustomerBriefCatalog.sizeOnly(answer);
        String prev = previous == null ? "" : CustomerBriefCatalog.sizeOnly(previous);
        DesignInfo design = designInfoFor(orderId, answer.getPieceId());
        String current = design.getHandSize();
        if (!StringUtils.hasText(current) || current.equals(prev)) {
            design.setHandSize(StringUtils.hasText(next) ? next : null);
            designInfoRepository.save(design);
        }
    }

    private DesignInfo designInfoFor(long orderId, Long pieceId) {
        return designInfoRepository.findByPieceId(pieceId).orElseGet(() -> {
            DesignInfo created = new DesignInfo();
            created.setOrderId(orderId);
            created.setPieceId(pieceId);
            return created;
        });
    }

    private void notifyChat(Order order, boolean first) {
        try {
            OrderConversation conversation = conversationRepository.findByOrderId(order.getId()).orElse(null);
            if (conversation == null) {
                return;
            }
            String text = first
                    ? "已收到您的定制细节问卷。设计师会参考这些选择，并在材质、工艺和预算允许的范围内尽可能采纳。您还可以在这里补充风格，或发送参考图。"
                    : "问卷已更新，我已同步给设计师。设计师会参考这些选择，并尽可能采纳，但不能保证每一项都原样实现。";
            conversationService.postAiAssistantMessage(conversation.getId(), text);
        } catch (Exception e) {
            log.warn("brief chat notice failed orderId={}", order.getId(), e);
        }
    }

    private void requireOwner(long orderId) {
        Long accountId = SecurityUtils.currentPortalCustomerId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
        bindingRepository.findByPortalCustomerIdAndOrderId(accountId, orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "无权操作该订单或未绑定"));
    }

    private Order requireOrder(long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
    }

    private List<CustomerBriefSubmitRequest.Piece> readPieces(OrderCustomerBrief brief) {
        if (brief == null || !StringUtils.hasText(brief.getPiecesJson())) {
            return List.of();
        }
        try {
            List<CustomerBriefSubmitRequest.Piece> list = objectMapper.readValue(brief.getPiecesJson(), PIECE_LIST);
            return list == null ? List.of() : list;
        } catch (Exception e) {
            return List.of();
        }
    }

    private String writePieces(List<CustomerBriefSubmitRequest.Piece> pieces) {
        try {
            return objectMapper.writeValueAsString(pieces);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "问卷保存失败");
        }
    }

    private static Map<Long, CustomerBriefSubmitRequest.Piece> index(List<CustomerBriefSubmitRequest.Piece> pieces) {
        Map<Long, CustomerBriefSubmitRequest.Piece> map = new HashMap<>();
        for (CustomerBriefSubmitRequest.Piece piece : pieces) {
            if (piece != null && piece.getPieceId() != null) {
                map.put(piece.getPieceId(), piece);
            }
        }
        return map;
    }

    private static String labelOrInfo(String metalCode, String materialInfo) {
        String label = CustomerBriefCatalog.materialLabel(metalCode);
        if (StringUtils.hasText(label) && !label.equals(metalCode)) {
            return label;
        }
        if (StringUtils.hasText(materialInfo)) {
            return materialInfo.trim();
        }
        return label;
    }
}
