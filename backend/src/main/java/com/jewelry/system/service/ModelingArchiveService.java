package com.jewelry.system.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.modeling.ModelingArchiveComponentRowDto;
import com.jewelry.system.dto.modeling.ModelingArchiveDto;
import com.jewelry.system.dto.modeling.ModelingArchiveInlayRowDto;
import com.jewelry.system.dto.order.OrderInfoDto;
import com.jewelry.system.entity.OrderModelingArchive;
import com.jewelry.system.entity.User;
import com.jewelry.system.repository.ModelingInfoRepository;
import com.jewelry.system.repository.OrderModelingArchiveRepository;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.UserRepository;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ModelingArchiveService {

    private static final TypeReference<List<Long>> LONG_LIST = new TypeReference<>() {};
    private static final TypeReference<List<ModelingArchiveComponentRowDto>> COMP_LIST = new TypeReference<>() {};
    private static final TypeReference<List<ModelingArchiveInlayRowDto>> INLAY_LIST = new TypeReference<>() {};

    private final OrderModelingArchiveRepository archiveRepository;
    private final OrderRepository orderRepository;
    private final ModelingInfoRepository modelingInfoRepository;
    private final UserRepository userRepository;
    private final OrderQueryService orderQueryService;
    private final ObjectMapper objectMapper;

    public void assertArchiveRole() {
        String r = SecurityUtils.currentRoleApi().orElse("");
        if (!("ADMIN".equals(r) || "SALES".equals(r) || "DATA_ARCHIVIST".equals(r))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员、售中客服或信息化数据归档师可处理建模归档");
        }
    }

    @Transactional(readOnly = true)
    public Page<OrderInfoDto> pageSharedPool(Pageable pageable) {
        assertArchiveRole();
        return orderRepository.pageModelingArchiveSharedPool(pageable)
                .map(o -> orderQueryService.getOrder(o.getId()));
    }

    @Transactional(readOnly = true)
    public ModelingArchiveDto getArchive(long orderId) {
        assertArchiveRole();
        assertOrderExists(orderId);
        assertHasModeling(orderId);
        OrderModelingArchive e = archiveRepository.findByOrderId(orderId).orElse(null);
        if (e == null) {
            ModelingArchiveDto dto = new ModelingArchiveDto();
            dto.setOrderId(orderId);
            return dto;
        }
        return toDto(e);
    }

    @Transactional
    public ModelingArchiveDto saveDraft(long orderId, ModelingArchiveDto body) {
        assertArchiveRole();
        assertOrderExists(orderId);
        assertHasModeling(orderId);
        Long uid = SecurityUtils.currentStaffUserId().orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));

        OrderModelingArchive e = archiveRepository.findByOrderId(orderId).orElseGet(() -> {
            OrderModelingArchive n = new OrderModelingArchive();
            n.setOrderId(orderId);
            return n;
        });

        e.setMainStructureComplexity(body.getMainStructureComplexity());
        e.setTextureComplexity(body.getTextureComplexity());
        e.setMainMarkerFileIdsJson(writeLongList(body.getMainMarkerFileIds()));
        e.setTextureMarkerFileIdsJson(writeLongList(body.getTextureMarkerFileIds()));
        List<ModelingArchiveComponentRowDto> comps = Optional.ofNullable(body.getComponents()).orElse(List.of());
        List<ModelingArchiveInlayRowDto> inlays = Optional.ofNullable(body.getInlays()).orElse(List.of());
        e.setSmallComponentCount(comps.size());
        e.setInlayStructureCount(inlays.size());
        e.setComponentsJson(writeJson(comps));
        e.setInlaysJson(writeJson(inlays));
        e.setLastSavedByUserId(uid);
        archiveRepository.save(e);
        return toDto(e);
    }

    @Transactional
    public ModelingArchiveDto submit(long orderId) {
        assertArchiveRole();
        assertOrderExists(orderId);
        assertHasModeling(orderId);
        Long uid = SecurityUtils.currentStaffUserId().orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));

        OrderModelingArchive e = archiveRepository.findByOrderId(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "请先保存归档草稿后再提交"));
        if (e.getCompletedAt() != null) {
            User who = e.getCompletedByUserId() != null
                    ? userRepository.findById(e.getCompletedByUserId()).orElse(null)
                    : null;
            String name = who != null ? firstNonBlank(who.getRealName(), who.getUsername(), "其他用户") : "其他用户";
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "该订单建模归档已由「" + name + "」提交锁定。您仍可修改内容并保存，但无法再次点击「提交归档」；如需变更流程请联系管理员。");
        }
        e.setCompletedAt(LocalDateTime.now());
        e.setCompletedByUserId(uid);
        e.setLastSavedByUserId(uid);
        archiveRepository.save(e);
        return toDto(e);
    }

    private static String firstNonBlank(String a, String b, String d) {
        if (a != null && !a.isBlank()) {
            return a;
        }
        if (b != null && !b.isBlank()) {
            return b;
        }
        return d;
    }

    private void assertOrderExists(long orderId) {
        orderRepository.findById(orderId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
    }

    private void assertHasModeling(long orderId) {
        modelingInfoRepository.findByOrderId(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "该订单尚无建模信息，无需归档"));
    }

    private ModelingArchiveDto toDto(OrderModelingArchive e) {
        ModelingArchiveDto dto = new ModelingArchiveDto();
        dto.setOrderId(e.getOrderId());
        dto.setMainStructureComplexity(e.getMainStructureComplexity());
        dto.setTextureComplexity(e.getTextureComplexity());
        dto.setMainMarkerFileIds(readLongList(e.getMainMarkerFileIdsJson()));
        dto.setTextureMarkerFileIds(readLongList(e.getTextureMarkerFileIdsJson()));
        dto.setSmallComponentCount(e.getSmallComponentCount());
        dto.setInlayStructureCount(e.getInlayStructureCount());
        dto.setComponents(readCompList(e.getComponentsJson()));
        dto.setInlays(readInlayList(e.getInlaysJson()));
        dto.setCompletedAt(e.getCompletedAt());
        dto.setCompletedByUserId(e.getCompletedByUserId());
        if (e.getCompletedByUserId() != null) {
            userRepository.findById(e.getCompletedByUserId()).ifPresent(u ->
                    dto.setCompletedByDisplayName(firstNonBlank(u.getRealName(), u.getUsername(), null)));
        }
        return dto;
    }

    private List<Long> readLongList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, LONG_LIST);
        } catch (Exception ex) {
            return List.of();
        }
    }

    private String writeLongList(List<Long> ids) {
        try {
            return objectMapper.writeValueAsString(Optional.ofNullable(ids).orElse(List.of()));
        } catch (Exception e) {
            return "[]";
        }
    }

    private List<ModelingArchiveComponentRowDto> readCompList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, COMP_LIST);
        } catch (Exception ex) {
            return List.of();
        }
    }

    private List<ModelingArchiveInlayRowDto> readInlayList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, INLAY_LIST);
        } catch (Exception ex) {
            return List.of();
        }
    }

    private String writeJson(Object o) {
        try {
            return objectMapper.writeValueAsString(o);
        } catch (Exception e) {
            return "[]";
        }
    }
}
