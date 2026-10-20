package com.jewelry.system.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.entity.OrderPiece;
import com.jewelry.system.repository.OrderPieceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderPieceService {

    public static final int MAX_PIECES_PER_ORDER = 5;

    private final OrderPieceRepository orderPieceRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<OrderPiece> listByOrderId(long orderId) {
        return orderPieceRepository.findByOrderIdOrderBySeqAsc(orderId);
    }

    @Transactional
    public OrderPiece ensureDefaultPiece(long orderId) {
        List<OrderPiece> existing = orderPieceRepository.findByOrderIdOrderBySeqAsc(orderId);
        if (!existing.isEmpty()) {
            return existing.get(0);
        }
        OrderPiece piece = new OrderPiece();
        piece.setOrderId(orderId);
        piece.setSeq(1);
        piece.setName("主件");
        piece.setDesignConfirmed(false);
        piece.setModelConfirmed(false);
        return orderPieceRepository.save(piece);
    }

    @Transactional(readOnly = true)
    public OrderPiece requirePiece(long orderId, Long pieceId) {
        if (pieceId == null) {
            List<OrderPiece> list = orderPieceRepository.findByOrderIdOrderBySeqAsc(orderId);
            if (list.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "订单尚无单件，请先创建");
            }
            return list.get(0);
        }
        return orderPieceRepository.findById(pieceId)
                .filter(p -> p.getOrderId().equals(orderId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "单件不存在"));
    }

    @Transactional
    public OrderPiece createPiece(long orderId, String name) {
        int count = orderPieceRepository.countByOrderId(orderId);
        if (count >= MAX_PIECES_PER_ORDER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "每单最多 " + MAX_PIECES_PER_ORDER + " 件");
        }
        String pieceName = StringUtils.hasText(name) ? name.trim() : ("单件" + (count + 1));
        if (pieceName.length() > 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "单件名称过长");
        }
        OrderPiece piece = new OrderPiece();
        piece.setOrderId(orderId);
        piece.setSeq(count + 1);
        piece.setName(pieceName);
        piece.setDesignConfirmed(false);
        piece.setModelConfirmed(false);
        return orderPieceRepository.save(piece);
    }

    @Transactional
    public OrderPiece renamePiece(long orderId, long pieceId, String name) {
        if (!StringUtils.hasText(name)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "名称不能为空");
        }
        String trimmed = name.trim();
        if (trimmed.length() > 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "单件名称过长");
        }
        OrderPiece piece = requirePiece(orderId, pieceId);
        piece.setName(trimmed);
        return orderPieceRepository.save(piece);
    }

    @Transactional
    public void setReferenceImages(OrderPiece piece, List<String> urls) {
        if (urls == null || urls.isEmpty()) {
            piece.setReferenceImagesJson(null);
        } else {
            piece.setReferenceImagesJson(toJson(urls));
        }
        orderPieceRepository.save(piece);
    }

    @Transactional(readOnly = true)
    public boolean allDesignConfirmed(long orderId) {
        List<OrderPiece> pieces = listByOrderId(orderId);
        if (pieces.isEmpty()) {
            return false;
        }
        return pieces.stream().allMatch(p -> Boolean.TRUE.equals(p.getDesignConfirmed()));
    }

    @Transactional(readOnly = true)
    public boolean allModelConfirmed(long orderId) {
        List<OrderPiece> pieces = listByOrderId(orderId);
        if (pieces.isEmpty()) {
            return false;
        }
        return pieces.stream().allMatch(p -> Boolean.TRUE.equals(p.getModelConfirmed()));
    }

    @Transactional
    public void resetDesignConfirmation(long orderId, long pieceId) {
        OrderPiece piece = requirePiece(orderId, pieceId);
        piece.setDesignConfirmed(false);
        orderPieceRepository.save(piece);
    }

    @Transactional
    public void resetModelConfirmation(long orderId, long pieceId) {
        OrderPiece piece = requirePiece(orderId, pieceId);
        piece.setModelConfirmed(false);
        orderPieceRepository.save(piece);
    }

    @Transactional
    public void markDesignConfirmed(long orderId, long pieceId) {
        OrderPiece piece = requirePiece(orderId, pieceId);
        piece.setDesignConfirmed(true);
        orderPieceRepository.save(piece);
    }

    @Transactional
    public void markModelConfirmed(long orderId, long pieceId) {
        OrderPiece piece = requirePiece(orderId, pieceId);
        piece.setModelConfirmed(true);
        orderPieceRepository.save(piece);
    }

    public List<String> parseReferenceImages(OrderPiece piece) {
        if (piece == null || !StringUtils.hasText(piece.getReferenceImagesJson())) {
            return Collections.emptyList();
        }
        try {
            List<String> list = objectMapper.readValue(
                    piece.getReferenceImagesJson(),
                    objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
            return list != null ? list : Collections.emptyList();
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private String toJson(Object o) {
        try {
            return objectMapper.writeValueAsString(o);
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "JSON 序列化失败");
        }
    }
}
