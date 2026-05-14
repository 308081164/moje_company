package com.jewelry.system.service;

import com.jewelry.system.dto.order.FileInfoDto;
import com.jewelry.system.entity.FileEntity;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.User;
import com.jewelry.system.enums.FileRelatedType;
import com.jewelry.system.repository.FileEntityRepository;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.UserRepository;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderFileService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final FileEntityRepository fileEntityRepository;
    private final FileStorageService fileStorageService;
    private final AliyunOssService aliyunOssService;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;

    @Transactional(readOnly = true)
    public List<FileInfoDto> listForOrder(long orderId) {
        return fileEntityRepository.findByRelatedTypeAndRelatedIdOrderByIdDesc(FileRelatedType.ORDER, orderId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public FileInfoDto uploadDesignFile(long orderId, MultipartFile file, String notes) throws IOException {
        long uid = SecurityUtils.currentStaffUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        assertCanUploadDesign(orderId, uid);
        return save(orderId, file, "design", "DESIGN", notes, uid);
    }

    /**
     * B2B 门户匿名创建订单时上传附件，无 JWT 登录态，{@code uploaderId} 存空。
     */
    @Transactional
    public FileInfoDto uploadDesignFileForGuest(long orderId, MultipartFile file, String notes) throws IOException {
        return save(orderId, file, "design", "DESIGN", notes, null);
    }

    @Transactional
    public FileInfoDto uploadModelFile(long orderId, MultipartFile file, String notes) throws IOException {
        long uid = SecurityUtils.currentStaffUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        assertCanUploadModel(orderId, uid);
        return save(orderId, file, "model", "MODEL", notes, uid);
    }

    /** 建模效果图（图片），与源文件 {@link #uploadModelFile} 区分 fileType=MODEL_EFFECT */
    @Transactional
    public FileInfoDto uploadModelEffectImage(long orderId, MultipartFile file, String notes) throws IOException {
        long uid = SecurityUtils.currentStaffUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        assertCanUploadModel(orderId, uid);
        return save(orderId, file, "model/effect", "MODEL_EFFECT", notes, uid);
    }

    private FileInfoDto save(long orderId, MultipartFile file, String subDir, String fileType, String notes, Long uploaderId) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "文件不能为空");
        }
        if (!aliyunOssService.isEnabled()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "OSS 未配置，无法上传文件");
        }
        String original = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String ext = "";
        int dot = original.lastIndexOf('.');
        if (dot >= 0) {
            ext = original.substring(dot);
        }
        String storedFileName = java.util.UUID.randomUUID() + ext;
        String objectKey = "order/" + orderId + "/" + subDir + "/" + storedFileName;

        // 所有文件强制上传到 OSS，不再保留本地副本
        String url;
        try {
            url = aliyunOssService.uploadObject(objectKey, file);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "上传文件到 OSS 失败", e);
        }

        FileEntity e = new FileEntity();
        e.setFileName(original);
        e.setOriginalName(original);
        e.setFilePath(objectKey);
        e.setFileUrl(url);
        e.setFileSize(file.getSize());
        e.setFileType(fileType);
        if (dot >= 0) {
            e.setFileExtension(original.substring(dot + 1));
        }
        e.setRelatedType(FileRelatedType.ORDER);
        e.setRelatedId(orderId);
        e.setUploaderId(uploaderId);
        fileEntityRepository.save(e);
        return toDto(e);
    }

    private FileInfoDto toDto(FileEntity e) {
        String uploaderName = null;
        if (e.getUploaderId() != null) {
            uploaderName = userRepository.findById(e.getUploaderId())
                    .map(u -> {
                        if (u.getRealName() != null && !u.getRealName().isBlank()) {
                            return u.getRealName();
                        }
                        return u.getUsername();
                    })
                    .orElse(null);
        }
        return FileInfoDto.builder()
                .id(e.getId())
                .fileName(e.getFileName())
                .filePath(e.getFilePath())
                .fileUrl(e.getFileUrl())
                .fileType(e.getFileType())
                .fileSize(e.getFileSize())
                .uploaderId(e.getUploaderId() != null ? e.getUploaderId() : 0L)
                .uploaderName(uploaderName)
                .uploadTime(e.getCreatedAt() != null ? ISO.format(e.getCreatedAt()) : null)
                .isLatest(true)
                .notes(null)
                .build();
    }

    private Order requireOrder(long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
    }

    private boolean isAdminRole() {
        return "ADMIN".equals(SecurityUtils.currentRoleApi().orElse(null));
    }

    private void assertCanUploadDesign(long orderId, long uid) {
        Order order = requireOrder(orderId);
        if (isAdminRole()) {
            return;
        }
        if (!"DESIGNER".equals(SecurityUtils.currentRoleApi().orElse(""))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅设计师或管理员可上传设计文件");
        }
        User d = order.getDesigner();
        if (d != null && d.getId() != uid) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅本单指派设计师可上传设计文件");
        }
    }

    private void assertCanUploadModel(long orderId, long uid) {
        Order order = requireOrder(orderId);
        if (isAdminRole()) {
            return;
        }
        if (!"MODELER".equals(SecurityUtils.currentRoleApi().orElse(""))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅建模师或管理员可上传建模相关文件");
        }
        User m = order.getModeler();
        if (m != null && m.getId() != uid) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅本单指派建模师可上传建模相关文件");
        }
    }
}
