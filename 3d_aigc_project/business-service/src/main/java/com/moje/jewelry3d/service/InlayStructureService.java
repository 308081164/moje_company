package com.moje.jewelry3d.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.config.InlayDbConfig;
import com.moje.jewelry3d.config.InlayV2Config;
import com.moje.jewelry3d.model.dto.InlayCategoryNode;
import com.moje.jewelry3d.model.dto.InlayQuery;
import com.moje.jewelry3d.model.dto.InlayStructureInfo;
import jakarta.annotation.PostConstruct;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Stream;

/**
 * 镶嵌结构管理服务
 * 负责扫描、查询和管理镶嵌结构数据库中的文件
 */
@Slf4j
@Service
public class InlayStructureService {

    private static final int INDEX_VERSION = 1;
    private static final String INDEX_FILENAME = ".inlay-index.json";

    /** 支持的3D模型文件格式 */
    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of(
            ".jcd", ".obj", ".glb", ".stl", ".step"
    );

    /** 可直接用于融合管线的 mesh 格式 */
    private static final Set<String> MESH_FORMATS = Set.of("OBJ", "GLB", "STL");

    private static final List<String> COMPANION_MESH_EXTENSIONS = List.of(".obj", ".glb", ".stl");

    /** 预览图扩展名 */
    private static final Set<String> PREVIEW_EXTENSIONS = Set.of(
            ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"
    );

    /** 日期格式化器 */
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final InlayDbConfig inlayDbConfig;
    private final ObjectMapper objectMapper;
    private final InlayV2Config inlayV2Config;

    /** 索引快照（结构列表 + 预计算的统计/分类树） */
    private final AtomicReference<IndexSnapshot> indexSnapshot = new AtomicReference<>();
    private final Object indexLock = new Object();
    private final AtomicBoolean refreshInProgress = new AtomicBoolean(false);

    @Autowired
    public InlayStructureService(
            InlayDbConfig inlayDbConfig,
            ObjectMapper objectMapper,
            InlayV2Config inlayV2Config
    ) {
        this.inlayDbConfig = inlayDbConfig;
        this.objectMapper = objectMapper;
        this.inlayV2Config = inlayV2Config;
    }

    @PostConstruct
    void warmIndexOnStartup() {
        if (!inlayV2Config.isV1IndexEnabled()) {
            log.info("v1 镶嵌结构内存索引已禁用（inlay-v2.v1-index-enabled=false）");
            return;
        }
        if (tryLoadIndexFromDisk()) {
            IndexSnapshot snapshot = indexSnapshot.get();
            log.info("镶嵌结构索引已从磁盘加载，共 {} 条", snapshot.structures().size());
            return;
        }
        log.info("未找到镶嵌结构索引文件，将在后台执行首次扫描...");
        refreshInProgress.set(true);
        CompletableFuture.runAsync(this::refreshStructureCacheSafe);
    }

    /**
     * 获取镶嵌结构数据库根目录的Path对象
     */
    private Path getDbRootPath() {
        return Paths.get(inlayDbConfig.getPath()).toAbsolutePath().normalize();
    }

    private Path getIndexFilePath() {
        return getDbRootPath().resolve(INDEX_FILENAME);
    }

    /**
     * 列出所有镶嵌结构文件（带缓存）
     */
    public List<InlayStructureInfo> listAllStructures() {
        if (!inlayV2Config.isV1IndexEnabled()) {
            throw new BusinessException(503, "v1 镶嵌库索引已禁用，请使用 /api/inlay/v2");
        }
        IndexSnapshot snapshot = indexSnapshot.get();
        if (snapshot != null) {
            return snapshot.structures();
        }
        synchronized (indexLock) {
            snapshot = indexSnapshot.get();
            if (snapshot != null) {
                return snapshot.structures();
            }
            return refreshStructureCache();
        }
    }

    /**
     * 强制刷新镶嵌结构索引
     */
    public List<InlayStructureInfo> refreshStructureCache() {
        synchronized (indexLock) {
            List<InlayStructureInfo> result = scanAllStructures();
            applySnapshot(result);
            persistIndexToDisk(result);
            log.info("镶嵌结构索引已刷新，共 {} 条", result.size());
            return result;
        }
    }

    /**
     * 异步刷新索引（不阻塞调用线程）
     */
    public boolean refreshStructureCacheAsync() {
        if (!refreshInProgress.compareAndSet(false, true)) {
            return false;
        }
        CompletableFuture.runAsync(() -> {
            try {
                refreshStructureCache();
            } catch (Exception e) {
                log.error("后台刷新镶嵌结构索引失败", e);
            } finally {
                refreshInProgress.set(false);
            }
        });
        return true;
    }

    public boolean isRefreshInProgress() {
        return refreshInProgress.get();
    }

    private void refreshStructureCacheSafe() {
        try {
            refreshStructureCache();
        } catch (Exception e) {
            log.error("镶嵌结构索引扫描失败", e);
        } finally {
            refreshInProgress.set(false);
        }
    }

    private void applySnapshot(List<InlayStructureInfo> structures) {
        List<InlayStructureInfo> immutable = List.copyOf(structures);
        indexSnapshot.set(new IndexSnapshot(
                immutable,
                buildFormatCounts(immutable),
                buildCategoryTree(immutable),
                buildFilenameIndex(immutable)
        ));
    }

    /**
     * 按条件分页查询镶嵌结构
     */
    public QueryResult queryStructures(InlayQuery query) {
        IndexSnapshot snapshot = requireSnapshot();
        List<InlayStructureInfo> all = snapshot.structures();
        String keyword = query.getKeyword() != null ? query.getKeyword().trim().toLowerCase() : "";
        String format = query.getFormat() != null ? query.getFormat().trim().toUpperCase() : "";
        String category = normalizeCategory(query.getCategory());
        Boolean hasPreview = query.getHasPreview();
        Boolean meshReady = query.getMeshReady();
        Boolean primaryOnly = query.getPrimaryOnly();

        List<InlayStructureInfo> filtered = new ArrayList<>();

        for (InlayStructureInfo info : all) {
            if (Boolean.TRUE.equals(primaryOnly) && !info.isPrimaryRecord()) {
                continue;
            }
            if (!matchesFormatFilter(info, format)) {
                continue;
            }
            if (meshReady != null && info.isMeshReady() != meshReady) {
                continue;
            }
            if (hasPreview != null && info.isHasPreview() != hasPreview) {
                continue;
            }
            if (!category.isEmpty() && !matchesCategory(info.getFilePath(), category)) {
                continue;
            }
            if (!keyword.isEmpty()) {
                String fn = info.getFilename().toLowerCase();
                String fp = info.getFilePath() != null ? info.getFilePath().toLowerCase() : "";
                if (!fn.contains(keyword) && !fp.contains(keyword)) {
                    continue;
                }
            }
            filtered.add(info);
        }

        int page = Math.max(query.getPage(), 1);
        int pageSize = Math.min(Math.max(query.getPageSize(), 1), 200);
        int from = (page - 1) * pageSize;
        int to = Math.min(from + pageSize, filtered.size());

        List<InlayStructureInfo> pageItems = from >= filtered.size()
                ? Collections.emptyList()
                : filtered.subList(from, to);

        return new QueryResult(pageItems, filtered.size(), page, pageSize, snapshot.formatCounts());
    }

    private IndexSnapshot requireSnapshot() {
        IndexSnapshot snapshot = indexSnapshot.get();
        if (snapshot != null) {
            return snapshot;
        }
        listAllStructures();
        snapshot = indexSnapshot.get();
        if (snapshot == null) {
            throw new BusinessException("镶嵌结构索引尚未就绪，请稍后重试");
        }
        return snapshot;
    }

    private static Map<String, Long> buildFormatCounts(List<InlayStructureInfo> items) {
        Map<String, Long> stats = new LinkedHashMap<>();
        for (InlayStructureInfo info : items) {
            stats.merge(info.getFormat(), 1L, Long::sum);
        }
        long meshTotal = stats.entrySet().stream()
                .filter(e -> MESH_FORMATS.contains(e.getKey().toUpperCase()))
                .mapToLong(Map.Entry::getValue)
                .sum();
        if (meshTotal > 0) {
            stats.put("MESH", meshTotal);
        }
        long meshReadyTotal = items.stream().filter(InlayStructureInfo::isMeshReady).count();
        if (meshReadyTotal > 0) {
            stats.put("MESH_READY", meshReadyTotal);
        }
        return stats;
    }

    private static boolean matchesFormatFilter(InlayStructureInfo info, String format) {
        if (format.isEmpty()) {
            return true;
        }
        if ("MESH".equals(format)) {
            return MESH_FORMATS.contains(info.getFormat().toUpperCase());
        }
        return format.equalsIgnoreCase(info.getFormat());
    }

    /**
     * 获取目录分类树（按文件相对路径层级聚合）
     */
    public List<InlayCategoryNode> getCategoryTree() {
        return requireSnapshot().categoryTree();
    }

    private static List<InlayCategoryNode> buildCategoryTree(List<InlayStructureInfo> structures) {
        MutableCategoryNode root = new MutableCategoryNode("", "");
        for (InlayStructureInfo info : structures) {
            addToCategoryTree(root, info.getFilePath());
        }
        return root.children.values().stream()
                .sorted(Comparator.comparing(n -> n.label))
                .map(MutableCategoryNode::toDto)
                .toList();
    }

    private static String normalizeCategory(String category) {
        if (category == null || category.isBlank()) {
            return "";
        }
        return category.replace('\\', '/').trim().replaceAll("/+$", "");
    }

    private static boolean matchesCategory(String filePath, String category) {
        if (category.isEmpty() || filePath == null || filePath.isBlank()) {
            return category.isEmpty();
        }
        String normalizedPath = filePath.replace('\\', '/');
        if (normalizedPath.equals(category)) {
            return true;
        }
        return normalizedPath.startsWith(category + "/");
    }

    private static void addToCategoryTree(MutableCategoryNode root, String filePath) {
        if (filePath == null || filePath.isBlank()) {
            root.count++;
            return;
        }
        String[] parts = filePath.replace('\\', '/').split("/");
        MutableCategoryNode current = root;
        current.count++;
        StringBuilder prefix = new StringBuilder();
        for (int i = 0; i < parts.length - 1; i++) {
            if (i > 0) {
                prefix.append('/');
            }
            prefix.append(parts[i]);
            final String segment = parts[i];
            final String key = prefix.toString();
            current = current.children.computeIfAbsent(key, k -> new MutableCategoryNode(segment, key));
            current.count++;
        }
    }

    private static final class MutableCategoryNode {
        private final String label;
        private final String value;
        private long count;
        private final Map<String, MutableCategoryNode> children = new LinkedHashMap<>();

        private MutableCategoryNode(String label, String value) {
            this.label = label;
            this.value = value;
        }

        private InlayCategoryNode toDto() {
            InlayCategoryNode dto = new InlayCategoryNode();
            dto.setLabel(label + " (" + count + ")");
            dto.setValue(value);
            dto.setCount(count);
            if (!children.isEmpty()) {
                dto.setChildren(children.values().stream()
                        .sorted(Comparator.comparing(n -> n.label))
                        .map(MutableCategoryNode::toDto)
                        .toList());
            }
            return dto;
        }
    }

    /**
     * 获取支持的文件格式列表及数量
     */
    public Map<String, Long> getFormatStatistics() {
        return requireSnapshot().formatCounts();
    }

    private List<InlayStructureInfo> scanAllStructures() {
        Path dbPath = getDbRootPath();

        if (!Files.exists(dbPath) || !Files.isDirectory(dbPath)) {
            log.warn("镶嵌结构数据库目录不存在: {}", dbPath);
            return Collections.emptyList();
        }

        Set<String> allRelativePaths = new HashSet<>();
        List<ScannedFile> supportedFiles = new ArrayList<>();

        try (Stream<Path> paths = Files.walk(dbPath)) {
            paths.filter(Files::isRegularFile).forEach(path -> {
                String rel = dbPath.relativize(path).toString().replace('\\', '/');
                allRelativePaths.add(rel);
                if (isSupportedFormat(path) && !isArchivePath(rel)) {
                    try {
                        BasicFileAttributes attrs = Files.readAttributes(path, BasicFileAttributes.class);
                        supportedFiles.add(new ScannedFile(path, rel, attrs));
                    } catch (IOException e) {
                        log.warn("读取文件属性失败: {}", path, e);
                    }
                }
            });
        } catch (IOException e) {
            log.error("扫描镶嵌结构数据库失败", e);
            throw new BusinessException("扫描镶嵌结构数据库失败: " + e.getMessage());
        }

        List<InlayStructureInfo> result = new ArrayList<>(supportedFiles.size());
        for (ScannedFile scanned : supportedFiles) {
            result.add(buildStructureInfo(scanned, allRelativePaths));
        }

        result.sort(Comparator.comparing(InlayStructureInfo::getFilename));
        return result;
    }

    private boolean tryLoadIndexFromDisk() {
        Path indexPath = getIndexFilePath();
        if (!Files.isRegularFile(indexPath)) {
            return false;
        }
        try {
            PersistedIndex persisted = objectMapper.readValue(indexPath.toFile(), PersistedIndex.class);
            if (persisted.getVersion() != INDEX_VERSION) {
                log.info("镶嵌结构索引版本不匹配，将重新扫描");
                return false;
            }
            String currentDbPath = getDbRootPath().toString();
            if (persisted.getDbPath() == null || !currentDbPath.equals(persisted.getDbPath())) {
                log.info("镶嵌结构数据库路径已变更，将重新扫描");
                return false;
            }
            List<InlayStructureInfo> items = persisted.getItems();
            if (items == null || items.isEmpty()) {
                return false;
            }
            applySnapshot(items);
            return true;
        } catch (IOException e) {
            log.warn("读取镶嵌结构索引文件失败，将重新扫描: {}", indexPath, e);
            return false;
        }
    }

    private void persistIndexToDisk(List<InlayStructureInfo> structures) {
        Path indexPath = getIndexFilePath();
        try {
            PersistedIndex persisted = new PersistedIndex();
            persisted.setVersion(INDEX_VERSION);
            persisted.setDbPath(getDbRootPath().toString());
            persisted.setScannedAt(LocalDateTime.now(ZoneId.systemDefault()).format(DATE_FORMATTER));
            persisted.setItems(structures);
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(indexPath.toFile(), persisted);
            log.debug("镶嵌结构索引已写入: {}", indexPath);
        } catch (IOException e) {
            log.warn("写入镶嵌结构索引文件失败: {}", indexPath, e);
        }
    }

    /**
     * 分页查询结果
     */
    public record QueryResult(
            List<InlayStructureInfo> items,
            long total,
            int page,
            int pageSize,
            Map<String, Long> formatCounts
    ) {}

    private record IndexSnapshot(
            List<InlayStructureInfo> structures,
            Map<String, Long> formatCounts,
            List<InlayCategoryNode> categoryTree,
            Map<String, String> filenameIndex
    ) {}

    private record ScannedFile(Path path, String relativePath, BasicFileAttributes attrs) {}

    @Data
    private static class PersistedIndex {
        private int version;
        private String dbPath;
        private String scannedAt;
        private List<InlayStructureInfo> items;
    }

    /**
     * 获取指定镶嵌结构的详细信息
     */
    public InlayStructureInfo getStructureInfo(String identifier) {
        Path filePath = resolveStructureFile(identifier);
        if (filePath == null) {
            throw new BusinessException(404, "未找到镶嵌结构文件: " + identifier);
        }

        IndexSnapshot snapshot = indexSnapshot.get();
        if (snapshot != null) {
            String rel = getDbRootPath().relativize(filePath).toString().replace('\\', '/');
            for (InlayStructureInfo info : snapshot.structures()) {
                if (rel.equals(info.getFilePath())) {
                    return info;
                }
            }
        }

        try {
            return buildStructureInfo(
                    new ScannedFile(filePath,
                            getDbRootPath().relativize(filePath).toString().replace('\\', '/'),
                            Files.readAttributes(filePath, BasicFileAttributes.class)),
                    Collections.emptySet()
            );
        } catch (IOException e) {
            throw new BusinessException("读取镶嵌结构文件信息失败: " + e.getMessage());
        }
    }

    /**
     * 获取指定镶嵌结构的预览图
     */
    public Path getPreviewPath(String identifier) {
        Path filePath = resolveStructureFile(identifier);
        if (filePath == null) {
            throw new BusinessException(404, "未找到镶嵌结构文件: " + identifier);
        }

        IndexSnapshot snapshot = indexSnapshot.get();
        if (snapshot != null) {
            String rel = getDbRootPath().relativize(filePath).toString().replace('\\', '/');
            for (InlayStructureInfo info : snapshot.structures()) {
                if (rel.equals(info.getFilePath()) && info.isHasPreview() && info.getPreviewFilename() != null) {
                    Path parentDir = filePath.getParent();
                    if (parentDir != null) {
                        Path preview = parentDir.resolve(info.getPreviewFilename());
                        if (Files.isRegularFile(preview)) {
                            return preview;
                        }
                    }
                }
            }
        }

        String filename = filePath.getFileName().toString();
        String baseName = getBaseName(filename);
        Path parentDir = filePath.getParent();
        if (parentDir == null) {
            return null;
        }
        return resolvePreviewPath(parentDir, baseName);
    }

    /**
     * 保存上传的镶嵌结构文件
     */
    public void saveUploadedFile(String originalFilename, Path targetPath) {
        String extension = getExtension(originalFilename).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.contains(extension)) {
            throw new BusinessException("不支持的文件格式: " + extension +
                    "，支持的格式: " + String.join(", ", SUPPORTED_EXTENSIONS));
        }

        Path dbPath = getDbRootPath();
        Path destination = dbPath.resolve(originalFilename).normalize();

        if (!destination.startsWith(dbPath)) {
            throw new BusinessException("非法的文件路径");
        }

        try {
            Files.createDirectories(destination.getParent());
            Files.copy(targetPath, destination, StandardCopyOption.REPLACE_EXISTING);
            log.info("镶嵌结构文件已保存: {}", destination);
            refreshStructureCacheAsync();
        } catch (IOException e) {
            log.error("保存镶嵌结构文件失败", e);
            throw new BusinessException("保存文件失败: " + e.getMessage());
        }
    }

    private boolean isSupportedFormat(Path path) {
        String filename = path.getFileName().toString().toLowerCase();
        String extension = getExtension(filename);
        return SUPPORTED_EXTENSIONS.contains(extension);
    }

    /**
     * 按相对路径或文件名解析镶嵌结构文件（相对路径优先，保证唯一性）
     */
    public Path resolveStructureFile(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return null;
        }

        Path dbPath = getDbRootPath();
        String normalizedIdentifier = identifier.replace('\\', '/');
        Path relativePath = dbPath.resolve(normalizedIdentifier).normalize();
        if (relativePath.startsWith(dbPath)
                && Files.exists(relativePath)
                && Files.isRegularFile(relativePath)
                && isSupportedFormat(relativePath)) {
            return relativePath;
        }

        IndexSnapshot snapshot = indexSnapshot.get();
        if (snapshot != null) {
            String cachedRel = snapshot.filenameIndex().get(identifier);
            if (cachedRel != null) {
                Path cached = dbPath.resolve(cachedRel).normalize();
                if (cached.startsWith(dbPath) && Files.isRegularFile(cached)) {
                    return cached;
                }
            }
        }

        return findFileByName(dbPath, identifier);
    }

    private static Map<String, String> buildFilenameIndex(List<InlayStructureInfo> structures) {
        Map<String, String> index = new HashMap<>();
        for (InlayStructureInfo info : structures) {
            index.putIfAbsent(info.getFilename(), info.getFilePath());
        }
        return index;
    }

    /**
     * 在数据库目录中按文件名查找文件（索引未命中时的兜底）
     */
    private Path findFileByName(Path dbPath, String filename) {
        Path directPath = dbPath.resolve(filename);
        if (Files.exists(directPath)) {
            return directPath;
        }

        try (Stream<Path> paths = Files.walk(dbPath)) {
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

    private InlayStructureInfo buildStructureInfo(ScannedFile scanned, Set<String> allRelativePaths) {
        InlayStructureInfo info = new InlayStructureInfo();
        String filename = scanned.path().getFileName().toString();
        String relativePath = scanned.relativePath();

        info.setFilename(filename);
        info.setFormat(getExtension(filename).replace(".", "").toUpperCase());
        long fileSize = scanned.attrs().size();
        info.setFileSize(fileSize);
        info.setFileSizeReadable(formatFileSize(fileSize));
        info.setFilePath(relativePath);

        long lastModified = scanned.attrs().lastModifiedTime().toMillis();
        info.setLastModified(LocalDateTime.ofInstant(
                java.time.Instant.ofEpochMilli(lastModified),
                ZoneId.systemDefault()
        ).format(DATE_FORMATTER));

        String baseName = getBaseName(filename);
        String parentRel = parentRelativePath(relativePath);
        String previewRel = findPreviewRelativePath(parentRel, baseName, allRelativePaths);
        info.setHasPreview(previewRel != null);
        if (previewRel != null) {
            info.setPreviewFilename(Path.of(previewRel).getFileName().toString());
        }

        info.setMeshReady(computeMeshReady(info.getFormat(), parentRel, baseName, allRelativePaths));
        info.setPrimaryRecord(computePrimaryRecord(info.getFormat(), parentRel, baseName, allRelativePaths));

        return info;
    }

    private static boolean computePrimaryRecord(
            String format,
            String parentRel,
            String baseName,
            Set<String> allRelativePaths
    ) {
        if ("JCD".equalsIgnoreCase(format)) {
            return true;
        }
        if (MESH_FORMATS.contains(format.toUpperCase())) {
            return !allRelativePaths.contains(joinRelativePath(parentRel, baseName + ".jcd"));
        }
        return true;
    }

    private static String parentRelativePath(String relativePath) {
        int slash = relativePath.lastIndexOf('/');
        return slash >= 0 ? relativePath.substring(0, slash) : "";
    }

    private static String joinRelativePath(String parentRel, String filename) {
        return parentRel.isEmpty() ? filename : parentRel + "/" + filename;
    }

    private static String findPreviewRelativePath(String parentRel, String baseName, Set<String> allRelativePaths) {
        for (String ext : PREVIEW_EXTENSIONS) {
            String candidate = joinRelativePath(parentRel, baseName + ext);
            if (allRelativePaths.contains(candidate)) {
                return candidate;
            }
            String previewCandidate = joinRelativePath(parentRel, baseName + "_preview" + ext);
            if (allRelativePaths.contains(previewCandidate)) {
                return previewCandidate;
            }
        }
        return null;
    }

    private static boolean computeMeshReady(
            String format,
            String parentRel,
            String baseName,
            Set<String> allRelativePaths
    ) {
        if (MESH_FORMATS.contains(format.toUpperCase())) {
            return true;
        }
        if ("JCD".equalsIgnoreCase(format)) {
            for (String ext : COMPANION_MESH_EXTENSIONS) {
                if (allRelativePaths.contains(joinRelativePath(parentRel, baseName + ext))) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean isArchivePath(String rel) {
        return rel.contains("/_jcd_archive/") || rel.startsWith("_jcd_archive/");
    }

    private Path resolvePreviewPath(Path parentDir, String baseName) {
        for (String ext : PREVIEW_EXTENSIONS) {
            Path previewPath = parentDir.resolve(baseName + ext);
            if (Files.exists(previewPath)) {
                return previewPath;
            }
            Path previewPath2 = parentDir.resolve(baseName + "_preview" + ext);
            if (Files.exists(previewPath2)) {
                return previewPath2;
            }
        }
        return null;
    }

    private String getExtension(String filename) {
        int lastDot = filename.lastIndexOf('.');
        return lastDot >= 0 ? filename.substring(lastDot).toLowerCase() : "";
    }

    private String getBaseName(String filename) {
        int lastDot = filename.lastIndexOf('.');
        return lastDot >= 0 ? filename.substring(0, lastDot) : filename;
    }

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
