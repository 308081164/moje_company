package com.moje.jewelry3d.service;

import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.config.InlayDbConfig;
import com.moje.jewelry3d.model.dto.InlayStructureInfo;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Stream;

/**
 * 镶嵌结构管理服务
 * 负责扫描、查询和管理镶嵌结构数据库中的文件
 */
@Slf4j
@Service
public class InlayStructureService {

    private final InlayDbConfig inlayDbConfig;

    /** 支持的3D模型文件格式 */
    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of(
            ".jcd", ".obj", ".glb", ".stl", ".step"
    );

    /** 预览图扩展名 */
    private static final Set<String> PREVIEW_EXTENSIONS = Set.of(
            ".png", ".jpg", ".jpeg", ".gif", ".webp"
    );

    /** 日期格式化器 */
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Autowired
    public InlayStructureService(InlayDbConfig inlayDbConfig) {
        this.inlayDbConfig = inlayDbConfig;
    }

    /**
     * 获取镶嵌结构数据库根目录的Path对象
     */
    private Path getDbRootPath() {
        return Paths.get(inlayDbConfig.getPath()).toAbsolutePath().normalize();
    }

    /**
     * 列出所有镶嵌结构文件
     *
     * @return 镶嵌结构信息列表
     */
    public List<InlayStructureInfo> listAllStructures() {
        Path dbPath = getDbRootPath();

        if (!Files.exists(dbPath) || !Files.isDirectory(dbPath)) {
            log.warn("镶嵌结构数据库目录不存在: {}", dbPath);
            return Collections.emptyList();
        }

        List<InlayStructureInfo> result = new ArrayList<>();

        // 递归扫描目录（最多3层深度）
        try (Stream<Path> paths = Files.walk(dbPath, 3)) {
            paths.filter(Files::isRegularFile)
                    .filter(this::isSupportedFormat)
                    .forEach(path -> {
                        try {
                            InlayStructureInfo info = buildStructureInfo(path, dbPath);
                            result.add(info);
                        } catch (Exception e) {
                            log.warn("读取镶嵌结构文件信息失败: {}", path, e);
                        }
                    });
        } catch (IOException e) {
            log.error("扫描镶嵌结构数据库失败", e);
            throw new BusinessException("扫描镶嵌结构数据库失败: " + e.getMessage());
        }

        // 按文件名排序
        result.sort(Comparator.comparing(InlayStructureInfo::getFilename));
        return result;
    }

    /**
     * 获取指定镶嵌结构的详细信息
     *
     * @param filename 文件名
     * @return 镶嵌结构信息
     */
    public InlayStructureInfo getStructureInfo(String filename) {
        Path dbPath = getDbRootPath();
        Path filePath = findFileByName(dbPath, filename);

        if (filePath == null || !Files.exists(filePath)) {
            throw new BusinessException(404, "未找到镶嵌结构文件: " + filename);
        }

        return buildStructureInfo(filePath, dbPath);
    }

    /**
     * 获取指定镶嵌结构的预览图
     *
     * @param filename 文件名
     * @return 预览图文件的Path，如果没有则返回null
     */
    public Path getPreviewPath(String filename) {
        Path dbPath = getDbRootPath();
        Path filePath = findFileByName(dbPath, filename);

        if (filePath == null || !Files.exists(filePath)) {
            throw new BusinessException(404, "未找到镶嵌结构文件: " + filename);
        }

        // 查找同名的预览图文件
        String baseName = getBaseName(filename);
        Path parentDir = filePath.getParent();

        if (parentDir == null) {
            return null;
        }

        for (String ext : PREVIEW_EXTENSIONS) {
            Path previewPath = parentDir.resolve(baseName + ext);
            if (Files.exists(previewPath)) {
                return previewPath;
            }
            // 也检查 _preview 后缀
            Path previewPath2 = parentDir.resolve(baseName + "_preview" + ext);
            if (Files.exists(previewPath2)) {
                return previewPath2;
            }
        }

        return null;
    }

    /**
     * 保存上传的镶嵌结构文件
     *
     * @param originalFilename 原始文件名
     * @param targetPath       目标路径
     */
    public void saveUploadedFile(String originalFilename, Path targetPath) {
        // 验证文件格式
        String extension = getExtension(originalFilename).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.contains(extension)) {
            throw new BusinessException("不支持的文件格式: " + extension +
                    "，支持的格式: " + String.join(", ", SUPPORTED_EXTENSIONS));
        }

        Path dbPath = getDbRootPath();
        Path destination = dbPath.resolve(originalFilename).normalize();

        // 安全检查：确保目标路径在数据库目录内
        if (!destination.startsWith(dbPath)) {
            throw new BusinessException("非法的文件路径");
        }

        try {
            Files.createDirectories(destination.getParent());
            Files.copy(targetPath, destination, StandardCopyOption.REPLACE_EXISTING);
            log.info("镶嵌结构文件已保存: {}", destination);
        } catch (IOException e) {
            log.error("保存镶嵌结构文件失败", e);
            throw new BusinessException("保存文件失败: " + e.getMessage());
        }
    }

    /**
     * 判断文件是否为支持的3D模型格式
     */
    private boolean isSupportedFormat(Path path) {
        String filename = path.getFileName().toString().toLowerCase();
        String extension = getExtension(filename);
        return SUPPORTED_EXTENSIONS.contains(extension);
    }

    /**
     * 在数据库目录中按文件名查找文件
     */
    private Path findFileByName(Path dbPath, String filename) {
        // 先尝试直接匹配
        Path directPath = dbPath.resolve(filename);
        if (Files.exists(directPath)) {
            return directPath;
        }

        // 递归搜索（最多3层）
        try (Stream<Path> paths = Files.walk(dbPath, 3)) {
            return paths
                    .filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().equals(filename))
                    .findFirst()
                    .orElse(null);
        } catch (IOException e) {
            log.error("搜索文件失败: {}", filename, e);
            return null;
        }
    }

    /**
     * 构建镶嵌结构信息对象
     */
    private InlayStructureInfo buildStructureInfo(Path filePath, Path dbPath) throws IOException {
        InlayStructureInfo info = new InlayStructureInfo();
        String filename = filePath.getFileName().toString();

        info.setFilename(filename);
        info.setFormat(getExtension(filename).replace(".", "").toUpperCase());
        info.setFileSize(Files.size(filePath));
        info.setFileSizeReadable(formatFileSize(Files.size(filePath)));
        info.setFilePath(dbPath.relativize(filePath).toString());

        // 最后修改时间
        long lastModified = Files.getLastModifiedTime(filePath).toMillis();
        info.setLastModified(LocalDateTime.ofInstant(
                java.time.Instant.ofEpochMilli(lastModified),
                ZoneId.systemDefault()
        ).format(DATE_FORMATTER));

        // 检查预览图
        String baseName = getBaseName(filename);
        Path parentDir = filePath.getParent();
        if (parentDir != null) {
            for (String ext : PREVIEW_EXTENSIONS) {
                Path previewPath = parentDir.resolve(baseName + ext);
                if (Files.exists(previewPath)) {
                    info.setHasPreview(true);
                    info.setPreviewFilename(baseName + ext);
                    break;
                }
                Path previewPath2 = parentDir.resolve(baseName + "_preview" + ext);
                if (Files.exists(previewPath2)) {
                    info.setHasPreview(true);
                    info.setPreviewFilename(baseName + "_preview" + ext);
                    break;
                }
            }
        }

        return info;
    }

    /**
     * 获取文件扩展名（包含点号，如 ".obj"）
     */
    private String getExtension(String filename) {
        int lastDot = filename.lastIndexOf('.');
        return lastDot >= 0 ? filename.substring(lastDot).toLowerCase() : "";
    }

    /**
     * 获取文件名（不含扩展名）
     */
    private String getBaseName(String filename) {
        int lastDot = filename.lastIndexOf('.');
        return lastDot >= 0 ? filename.substring(0, lastDot) : filename;
    }

    /**
     * 格式化文件大小为可读字符串
     */
    private String formatFileSize(long bytes) {
        if (bytes < 1024) {
            return bytes + " B";
        } else if (bytes < 1024 * 1024) {
            return String.format("%.1f KB", bytes / 1024.0);
        } else if (bytes < 1024 * 1024 * 1024) {
            return String.format("%.1f MB", bytes / (1024.0 * 1024));
        } else {
            return String.format("%.2f GB", bytes / (1024.0 * 1024 * 1024));
        }
    }
}
