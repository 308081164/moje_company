package com.jewelry.system.service;

import com.jewelry.system.dto.order.FileInfoDto;
import com.jewelry.system.entity.FileEntity;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.User;
import com.jewelry.system.enums.FileRelatedType;
import com.jewelry.system.enums.OrderStatus;
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
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
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

    /**
     * 将 Agent 会话中已上传至 OSS 的参考图复制到订单 design 目录并写入 files 表（与 create-with-files 一致）。
     */
    @Transactional
    public FileInfoDto attachGuestDesignFromOssUrl(long orderId, String ossUrl, String notes) {
        if (ossUrl == null || ossUrl.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "图片地址无效");
        }
        if (!aliyunOssService.isEnabled()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "对象存储 OSS 未就绪，无法关联参考图");
        }
        requireOrder(orderId);

        String sourceKey = aliyunOssService.resolveObjectKeyFromUrl(ossUrl.strip());
        if (sourceKey == null || sourceKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "无法解析 OSS 对象 key: " + ossUrl);
        }
        if (!aliyunOssService.objectExists(sourceKey)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "参考图在 OSS 中不存在: " + sourceKey);
        }

        String original = fileNameFromObjectKey(sourceKey);
        String ext = extensionOf(original);
        String storedFileName = buildStandardStoredFileName(orderId, "DESIGN", original, ext);
        String destKey = "order/" + orderId + "/design/" + storedFileName;

        if (!sourceKey.equals(destKey)) {
            aliyunOssService.copyObject(sourceKey, destKey);
        }

        FileEntity e = new FileEntity();
        e.setFileName(storedFileName);
        e.setOriginalName(original);
        e.setFilePath(destKey);
        e.setFileUrl(aliyunOssService.publicUrl(destKey));
        e.setFileSize(null);
        e.setFileType("DESIGN");
        if (!ext.isBlank()) {
            e.setFileExtension(ext.startsWith(".") ? ext.substring(1) : ext);
        }
        e.setRelatedType(FileRelatedType.ORDER);
        e.setRelatedId(orderId);
        e.setUploaderId(null);
        fileEntityRepository.save(e);
        return toDto(e);
    }

    private static String fileNameFromObjectKey(String objectKey) {
        int slash = objectKey.lastIndexOf('/');
        String name = slash >= 0 ? objectKey.substring(slash + 1) : objectKey;
        return name.isBlank() ? "reference.jpg" : name;
    }

    private static String extensionOf(String fileName) {
        int dot = fileName.lastIndexOf('.');
        return dot >= 0 ? fileName.substring(dot) : ".jpg";
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

    /** 跟单员在生产阶段上传过程记录附图 */
    @Transactional
    public FileInfoDto uploadProductionFollowImage(long orderId, MultipartFile file, String notes) throws IOException {
        long uid = SecurityUtils.currentStaffUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        Order order = requireOrder(orderId);
        if (order.getStatus() != OrderStatus.PRODUCING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "仅「生产中」订单可上传跟单过程图");
        }
        if (!isAdminRole()) {
            if (!"TRACKER".equals(SecurityUtils.currentRoleApi().orElse(""))) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅跟单员或管理员可上传跟单过程图");
            }
            User t = order.getFollowUp();
            if (t == null || t.getId() != uid) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅本单指派跟单员可上传跟单过程图");
            }
        }
        String n = notes != null && !notes.isBlank() ? notes : "生产过程记录附图";
        return save(orderId, file, "production-follow", "PRODUCTION_FOLLOW", n, uid);
    }

    @Transactional
    public FileInfoDto uploadArchiveMarkerFile(long orderId, MultipartFile file) throws IOException {
        return uploadArchiveMarkerFile(orderId, file, null);
    }

    @Transactional
    public FileInfoDto uploadArchiveMarkerFile(long orderId, MultipartFile file, String notes) throws IOException {
        assertArchiveMarkerRole();
        long uid = SecurityUtils.currentStaffUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        String n = notes != null && !notes.isBlank() ? notes : "建模归档样式标记";
        return save(orderId, file, "archive/markers", "ARCHIVE_MARKER", n, uid);
    }

    private void assertArchiveMarkerRole() {
        String r = SecurityUtils.currentRoleApi().orElse("");
        if (!("ADMIN".equals(r) || "SALES".equals(r) || "DATA_ARCHIVIST".equals(r))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无上传归档标记截图权限");
        }
    }

    private FileInfoDto save(long orderId, MultipartFile file, String subDir, String fileType, String notes, Long uploaderId) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "文件不能为空");
        }
        if (!aliyunOssService.isEnabled()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "对象存储 OSS 未就绪：请配置 OSS_ACCESS_KEY_ID、OSS_ACCESS_KEY_SECRET、桶名（OSS_BUCKET_NAME 或 OSS_BUCKET）、"
                            + "地域节点（ALIYUN_OSS_ENDPOINT 或 OSS_ENDPOINT，勿含 https://）。GitHub Actions 部署时 Secret 名需与 application.yml 一致，"
                            + "或在服务器 /mnt/newdisk/app/MOJE/.env 中填写后重新部署。"
            );
        }
        String original = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String ext = "";
        int dot = original.lastIndexOf('.');
        if (dot >= 0) {
            ext = original.substring(dot);
        }
        String storedFileName = buildStandardStoredFileName(orderId, fileType, original, ext);
        String objectKey = "order/" + orderId + "/" + subDir + "/" + storedFileName;

        // 所有文件强制上传到 OSS，不再保留本地副本
        String url;
        try {
            url = aliyunOssService.uploadObject(objectKey, file);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "上传文件到 OSS 失败", e);
        }

        FileEntity e = new FileEntity();
        e.setFileName(storedFileName);
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

    /**
     * 管理员上传 B 端门户公共素材（轮播、企业实拍等），OSS 路径为 public/portal/...，{@link FileRelatedType#PORTAL}。
     */
    @Transactional
    public FileInfoDto uploadPortalPublicFile(MultipartFile file, String subDir, String fileTypeLabel) throws IOException {
        if (!isAdminRole()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可上传门户展示素材");
        }
        long uid = SecurityUtils.currentStaffUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        return savePortalPublic(file, subDir, fileTypeLabel, uid);
    }

    public FileInfoDto toFileInfoDto(FileEntity e) {
        return toDto(e);
    }

    private FileInfoDto savePortalPublic(MultipartFile file, String subDir, String fileType, Long uploaderId) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "文件不能为空");
        }
        if (!aliyunOssService.isEnabled()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "对象存储 OSS 未就绪：请配置 OSS_ACCESS_KEY_ID、OSS_ACCESS_KEY_SECRET、桶名（OSS_BUCKET_NAME 或 OSS_BUCKET）、"
                            + "地域节点（ALIYUN_OSS_ENDPOINT 或 OSS_ENDPOINT，勿含 https://）。GitHub Actions 部署时 Secret 名需与 application.yml 一致，"
                            + "或在服务器 /mnt/newdisk/app/MOJE/.env 中填写后重新部署。"
            );
        }
        String original = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String ext = "";
        int dot = original.lastIndexOf('.');
        if (dot >= 0) {
            ext = original.substring(dot);
        }
        long pseudoOrderId = 0L;
        String storedFileName = buildStandardStoredFileName(pseudoOrderId, fileType, original, ext);
        String objectKey = "public/portal/" + subDir + "/" + storedFileName;

        String url;
        try {
            url = aliyunOssService.uploadObject(objectKey, file);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "上传文件到 OSS 失败", ex);
        }

        FileEntity ent = new FileEntity();
        ent.setFileName(storedFileName);
        ent.setOriginalName(original);
        ent.setFilePath(objectKey);
        ent.setFileUrl(url);
        ent.setFileSize(file.getSize());
        ent.setFileType(fileType);
        if (dot >= 0) {
            ent.setFileExtension(original.substring(dot + 1));
        }
        ent.setRelatedType(FileRelatedType.PORTAL);
        ent.setRelatedId(0L);
        ent.setUploaderId(uploaderId);
        fileEntityRepository.save(ent);
        return toDto(ent);
    }

    private static final SecureRandom RND = new SecureRandom();

    private static String buildStandardStoredFileName(long orderId, String fileType, String original, String ext) {
        String ts = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss").format(LocalDateTime.now());
        byte[] buf = new byte[4];
        RND.nextBytes(buf);
        String rand = HexFormat.of().formatHex(buf);
        String base = original;
        if (base.lastIndexOf('.') > 0) {
            base = base.substring(0, base.lastIndexOf('.'));
        }
        base = base.replaceAll("[^a-zA-Z0-9._\\-\\u4e00-\\u9fa5]+", "_");
        if (base.length() > 48) {
            base = base.substring(0, 48);
        }
        if (base.isBlank()) {
            base = "file";
        }
        return "jewelry_ord_" + orderId + "_" + fileType + "_" + ts + "_" + rand + "_" + base + ext;
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
