package com.jewelry.system.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.order.OrderProductionFollowCreateRequest;
import com.jewelry.system.dto.order.OrderProductionFollowLogDto;
import com.jewelry.system.entity.FileEntity;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.OrderProductionFollowLog;
import com.jewelry.system.entity.User;
import com.jewelry.system.enums.FileRelatedType;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.repository.FileEntityRepository;
import com.jewelry.system.repository.OrderProductionFollowLogRepository;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.UserRepository;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class OrderProductionFollowService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final OrderRepository orderRepository;
    private final OrderProductionFollowLogRepository logRepository;
    private final FileEntityRepository fileEntityRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<OrderProductionFollowLogDto> list(long orderId) {
        Order order = loadOrder(orderId);
        assertCanViewProductionFollow(order);
        return logRepository.findByOrderIdOrderByIdAsc(orderId).stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public OrderProductionFollowLogDto add(long orderId, OrderProductionFollowCreateRequest req) {
        Order order = loadOrder(orderId);
        assertCanEditProductionFollow(order);
        String note = req.getNote() != null ? req.getNote().trim() : "";
        List<Long> ids = req.getImageFileIds() == null ? List.of() : req.getImageFileIds().stream().filter(Objects::nonNull).toList();
        if (note.isEmpty() && ids.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请填写工序说明或上传至少一张过程图");
        }
        verifyFileIdsBelongToOrder(orderId, ids);
        long uid = SecurityUtils.currentStaffUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        OrderProductionFollowLog row = new OrderProductionFollowLog();
        row.setOrderId(orderId);
        row.setAuthorUserId(uid);
        row.setNote(note.isEmpty() ? null : note);
        try {
            row.setImageFileIdsJson(ids.isEmpty() ? null : objectMapper.writeValueAsString(ids));
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "图片 ID 列表序列化失败");
        }
        logRepository.save(row);
        return toDto(row);
    }

    private void verifyFileIdsBelongToOrder(long orderId, List<Long> fileIds) {
        for (Long fid : fileIds) {
            FileEntity fe = fileEntityRepository.findById(fid)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "附件不存在: " + fid));
            if (fe.getRelatedType() != FileRelatedType.ORDER || !Long.valueOf(orderId).equals(fe.getRelatedId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "附件不属于该订单: " + fid);
            }
        }
    }

    private OrderProductionFollowLogDto toDto(OrderProductionFollowLog row) {
        User u = userRepository.findById(row.getAuthorUserId()).orElse(null);
        String name = u != null
                ? (u.getRealName() != null && !u.getRealName().isBlank() ? u.getRealName() : u.getUsername())
                : ("用户" + row.getAuthorUserId());
        List<Long> ids = new ArrayList<>();
        if (row.getImageFileIdsJson() != null && !row.getImageFileIdsJson().isBlank()) {
            try {
                ids.addAll(objectMapper.readValue(row.getImageFileIdsJson(),
                        objectMapper.getTypeFactory().constructCollectionType(List.class, Long.class)));
            } catch (JsonProcessingException ignored) {
            }
        }
        return OrderProductionFollowLogDto.builder()
                .id(row.getId())
                .orderId(row.getOrderId())
                .authorUserId(row.getAuthorUserId())
                .authorName(name)
                .note(row.getNote())
                .imageFileIds(ids)
                .createdAt(row.getCreatedAt() != null ? ISO.format(row.getCreatedAt()) : null)
                .build();
    }

    private Order loadOrder(long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
    }

    private void assertCanViewProductionFollow(Order order) {
        if ("ADMIN".equals(SecurityUtils.currentRoleApi().orElse(""))) {
            return;
        }
        if (!"TRACKER".equals(SecurityUtils.currentRoleApi().orElse(""))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅跟单员或管理员可查看跟单记录");
        }
        Long uid = SecurityUtils.currentStaffUserId().orElse(null);
        if (order.getFollowUp() == null || uid == null || !uid.equals(order.getFollowUp().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅本单跟单员可查看该订单的跟单记录");
        }
    }

    private void assertCanEditProductionFollow(Order order) {
        if (order.getStatus() != OrderStatus.PRODUCING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "仅「生产中」订单可添加跟单过程记录");
        }
        if ("ADMIN".equals(SecurityUtils.currentRoleApi().orElse(""))) {
            return;
        }
        assertCanViewProductionFollow(order);
    }
}
