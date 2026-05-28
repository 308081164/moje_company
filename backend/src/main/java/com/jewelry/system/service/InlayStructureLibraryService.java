package com.jewelry.system.service;

import com.jewelry.system.dto.inlay.*;
import com.jewelry.system.entity.InlayStructureDeleteLog;
import com.jewelry.system.repository.InlayStructureDeleteLogRepository;
import com.jewelry.system.util.ImageUploadSupport;
import com.jewelry.system.util.ImageUploadSupport.NormalizedUpload;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class InlayStructureLibraryService {

    private final AliyunOssService ossService;
    private final InlayStructureDeleteLogRepository deleteLogRepository;
    private final SensitiveOperationService sensitiveOperationService;

    @Value("${app.inlay-structure.oss-prefix:inlay-structure-library/}")
    private String ossRootPrefix;

    @Value("${app.inlay-structure.daily-delete-limit:3}")
    private int dailyDeleteLimit;

    private String rootPrefix() {
        String p = ossRootPrefix == null ? "inlay-structure-library/" : ossRootPrefix.strip();
        if (!p.endsWith("/")) {
            p = p + "/";
        }
        return p;
    }

    private void assertOssReady() {
        if (!ossService.isEnabled()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "阿里云 OSS 未配置，无法使用镶嵌结构库");
        }
    }

    private void assertCanBrowse() {
        String role = SecurityUtils.currentRoleApi().orElse("");
        if (!Set.of("ADMIN", "MODELER", "DATA_ARCHIVIST", "DESIGNER", "SALES", "TRACKER").contains(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权访问镶嵌结构库");
        }
    }

    private void assertCanWrite() {
        String role = SecurityUtils.currentRoleApi().orElse("");
        if (!Set.of("ADMIN", "MODELER", "DATA_ARCHIVIST").contains(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅建模师、数据归档师或管理员可修改镶嵌结构库");
        }
    }

  private String normalizeRelative(String path) {
        if (path == null || path.isBlank() || "/".equals(path.trim())) {
            return "";
        }
        String p = path.replace('\\', '/').trim();
        while (p.startsWith("/")) {
            p = p.substring(1);
        }
        if (p.contains("..")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "路径非法");
        }
        return p;
    }

    private String toOssKey(String relativePath) {
        return rootPrefix() + normalizeRelative(relativePath);
    }

    private String relativeFromOssKey(String ossKey) {
        String root = rootPrefix();
        if (!ossKey.startsWith(root)) {
            return ossKey;
        }
        return ossKey.substring(root.length());
    }

    @Transactional(readOnly = true)
    public InlayStructureListDto list(String relativePath) {
        assertOssReady();
        assertCanBrowse();
        String rel = normalizeRelative(relativePath);
        String prefix = toOssKey(rel);
        if (!rel.isEmpty() && !prefix.endsWith("/")) {
            prefix = prefix + "/";
        }
        AliyunOssService.OssListResult raw = ossService.listObjectsV2(prefix, "/", 1000);
        InlayStructureListDto dto = new InlayStructureListDto();
        dto.setCurrentPath(rel.isEmpty() ? "/" : rel);
        Set<String> names = new HashSet<>();

        for (String cp : raw.commonPrefixes()) {
            String relChild = relativeFromOssKey(cp);
            String name = childName(relChild, true);
            if (name.isEmpty() || names.contains(name)) {
                continue;
            }
            names.add(name);
            InlayStructureEntryDto e = new InlayStructureEntryDto();
            e.setDirectory(true);
            e.setName(name);
            e.setPath(relChild);
            dto.getEntries().add(e);
        }

        for (AliyunOssService.OssObjectItem obj : raw.objects()) {
            String relChild = relativeFromOssKey(obj.key());
            if (relChild.endsWith(".dir")) {
                continue;
            }
            String name = childName(relChild, false);
            if (name.isEmpty() || names.contains(name)) {
                continue;
            }
            names.add(name);
            InlayStructureEntryDto e = new InlayStructureEntryDto();
            e.setDirectory(false);
            e.setName(name);
            e.setPath(relChild);
            e.setSize(obj.size());
            e.setLastModified(obj.lastModified());
            e.setUrl(ossService.publicUrl(obj.key()));
            dto.getEntries().add(e);
        }

        dto.getEntries().sort(Comparator
                .comparing(InlayStructureEntryDto::isDirectory).reversed()
                .thenComparing(InlayStructureEntryDto::getName, String.CASE_INSENSITIVE_ORDER));
        return dto;
    }

    private static String childName(String relPath, boolean directory) {
        String p = relPath == null ? "" : relPath.replace('\\', '/');
        if (p.endsWith("/")) {
            p = p.substring(0, p.length() - 1);
        }
        int i = p.lastIndexOf('/');
        String name = i >= 0 ? p.substring(i + 1) : p;
        if (directory && name.isEmpty() && p.contains("/")) {
            return p.substring(p.lastIndexOf('/', p.length() - 2) + 1);
        }
        return name;
    }

    @Transactional
    public InlayStructureEntryDto createDirectory(InlayStructurePathRequest req) throws IOException {
        assertCanWrite();
        String parent = normalizeRelative(req.getParentPath());
        String name = sanitizeName(req.getName());
        String rel = parent.isEmpty() ? name + "/" : parent + name + "/";
        String ossPrefix = toOssKey(rel);
        ossService.ensureDirectoryPlaceholder(ossPrefix);
        InlayStructureEntryDto e = new InlayStructureEntryDto();
        e.setDirectory(true);
        e.setName(name);
        e.setPath(rel);
        return e;
    }

    @Transactional
    public InlayStructureEntryDto upload(String parentPath, MultipartFile file) throws IOException {
        assertCanWrite();
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择文件");
        }
        NormalizedUpload normalized = ImageUploadSupport.normalizeRasterUpload(file);
        MultipartFile uploadFile = normalized.file();
        String parent = normalizeRelative(parentPath);
        String name = sanitizeFileName(uploadFile.getOriginalFilename());
        String rel = parent.isEmpty() ? name : parent + name;
        String key = toOssKey(rel);
        if (ossService.objectExists(key)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "同名文件已存在");
        }
        ossService.putObjectStream(key, uploadFile.getInputStream(), uploadFile.getSize(), uploadFile.getContentType());
        InlayStructureEntryDto e = new InlayStructureEntryDto();
        e.setDirectory(false);
        e.setName(name);
        e.setPath(rel);
        e.setSize(uploadFile.getSize());
        e.setUrl(ossService.publicUrl(key));
        return e;
    }

    @Transactional
    public InlayStructureEntryDto rename(InlayStructureRenameRequest req) throws IOException {
        assertCanWrite();
        String rel = normalizeRelative(req.getPath());
        if (rel.endsWith("/")) {
            rel = rel.substring(0, rel.length() - 1);
        }
        String newName = sanitizeName(req.getNewName());
        int slash = rel.lastIndexOf('/');
        String parent = slash >= 0 ? rel.substring(0, slash + 1) : "";
        String newRel = parent + newName + (isDirectoryPath(req.getPath()) ? "/" : "");

        if (isDirectoryPath(req.getPath())) {
            moveDirectoryTree(rel + "/", newRel);
        } else {
            String oldKey = toOssKey(rel);
            String newKey = toOssKey(newRel);
            if (!ossService.objectExists(oldKey)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "文件不存在");
            }
            if (ossService.objectExists(newKey)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "目标名称已存在");
            }
            ossService.copyObject(oldKey, newKey);
            ossService.deleteObject(oldKey);
        }

        InlayStructureEntryDto e = new InlayStructureEntryDto();
        e.setDirectory(isDirectoryPath(newRel));
        e.setName(newName);
        e.setPath(newRel);
        return e;
    }

    @Transactional
    public InlayStructureEntryDto move(InlayStructureMoveRequest req) throws IOException {
        assertCanWrite();
        String from = normalizeRelative(req.getFromPath());
        String toDir = normalizeRelative(req.getToDirectoryPath());
        if (!toDir.isEmpty() && !toDir.endsWith("/")) {
            toDir = toDir + "/";
        }
        String name = childName(from, from.endsWith("/"));
        String newRel = toDir + name + (from.endsWith("/") ? "/" : "");
        if (from.endsWith("/")) {
            moveDirectoryTree(from, newRel);
        } else {
            String oldKey = toOssKey(from);
            String newKey = toOssKey(newRel);
            if (!ossService.objectExists(oldKey)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "文件不存在");
            }
            if (ossService.objectExists(newKey)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "目标位置已存在同名项");
            }
            ossService.copyObject(oldKey, newKey);
            ossService.deleteObject(oldKey);
        }
        InlayStructureEntryDto e = new InlayStructureEntryDto();
        e.setDirectory(newRel.endsWith("/"));
        e.setName(name);
        e.setPath(newRel);
        return e;
    }

    private void moveDirectoryTree(String fromDir, String toDir) throws IOException {
        String fromPrefix = toOssKey(fromDir.endsWith("/") ? fromDir : fromDir + "/");
        String toPrefix = toOssKey(toDir.endsWith("/") ? toDir : toDir + "/");
        AliyunOssService.OssListResult all = ossService.listObjectsV2(fromPrefix, null, 1000);
        if (all.objects().isEmpty() && all.commonPrefixes().isEmpty()) {
            ossService.ensureDirectoryPlaceholder(toPrefix);
            return;
        }
        for (AliyunOssService.OssObjectItem obj : all.objects()) {
            String suffix = obj.key().substring(fromPrefix.length());
            String dest = toPrefix + suffix;
            ossService.copyObject(obj.key(), dest);
            ossService.deleteObject(obj.key());
        }
        ossService.ensureDirectoryPlaceholder(toPrefix);
        ossService.deleteObjectsUnderPrefix(fromPrefix);
    }

    @Transactional(readOnly = true)
    public InlayStructureDeleteQuotaDto deleteQuota() {
        assertCanBrowse();
        long uid = SecurityUtils.currentStaffUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        int used = countDeletesToday(uid);
        InlayStructureDeleteQuotaDto q = new InlayStructureDeleteQuotaDto();
        q.setDailyLimit(dailyDeleteLimit);
        q.setUsedToday(used);
        q.setRemainingFree(Math.max(0, dailyDeleteLimit - used));
        q.setRequiresSecondaryPassword(used >= dailyDeleteLimit);
        return q;
    }

    @Transactional
    public void delete(InlayStructureDeleteRequest req) {
        assertCanWrite();
        long uid = SecurityUtils.currentStaffUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        int used = countDeletesToday(uid);
        if (used >= dailyDeleteLimit) {
            sensitiveOperationService.verifySecondaryPassword(req.getSecondaryPassword());
        }
        String rel = normalizeRelative(req.getPath());
        if (rel.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不能删除库根目录");
        }
        String key = toOssKey(rel);
        if (rel.endsWith("/") || isDirectoryPlaceholder(rel)) {
            String prefix = key.endsWith("/") ? key : key + "/";
            ossService.deleteObjectsUnderPrefix(prefix);
        } else {
            if (!ossService.objectExists(key)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "不存在");
            }
            ossService.deleteObject(key);
        }
        InlayStructureDeleteLog log = new InlayStructureDeleteLog();
        log.setUserId(uid);
        log.setOssObjectKey(key);
        log.setDeletedAt(LocalDateTime.now());
        deleteLogRepository.save(log);
    }

    private int countDeletesToday(long userId) {
        LocalDate today = LocalDate.now();
        LocalDateTime start = today.atStartOfDay();
        LocalDateTime end = today.plusDays(1).atStartOfDay();
        return (int) deleteLogRepository.countByUserIdAndDeletedAtBetween(userId, start, end);
    }

    private static boolean isDirectoryPath(String path) {
        return path != null && path.endsWith("/");
    }

    private static boolean isDirectoryPlaceholder(String rel) {
        return rel.endsWith(".dir");
    }

    private static String sanitizeName(String name) {
        if (!StringUtils.hasText(name)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "名称不能为空");
        }
        String n = name.trim().replace('\\', '/');
        if (n.contains("/") || n.contains("..")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "名称不能包含路径分隔符");
        }
        return n;
    }

    private static String sanitizeFileName(String original) {
        if (!StringUtils.hasText(original)) {
            return "file.bin";
        }
        String n = original.replace('\\', '/');
        int i = n.lastIndexOf('/');
        n = i >= 0 ? n.substring(i + 1) : n;
        if (n.contains("..")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "文件名非法");
        }
        return n.isBlank() ? "file.bin" : n;
    }
}
