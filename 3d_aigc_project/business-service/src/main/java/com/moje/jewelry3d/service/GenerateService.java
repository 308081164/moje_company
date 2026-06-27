package com.moje.jewelry3d.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.config.AiServiceConfig;
import com.moje.jewelry3d.config.FileStorageConfig;
import com.moje.jewelry3d.config.InlayDbConfig;
import com.moje.jewelry3d.model.dto.GenerateResponse;
import com.moje.jewelry3d.model.dto.TaskViewDto;
import com.moje.jewelry3d.model.entity.GenerateTask;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 生成业务逻辑服务
 * 管理任务生命周期，与 AI 服务异步协作
 */
@Slf4j
@Service
public class GenerateService {

    private static final DateTimeFormatter DT_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final Set<String> MESH_EXTENSIONS = Set.of(".obj", ".glb", ".stl", ".step");

    private final AiServiceClient aiServiceClient;
    private final AiServiceConfig aiServiceConfig;
    private final InlayDbConfig inlayDbConfig;
    private final InlayStructureService inlayStructureService;
    private final FileStorageConfig fileStorageConfig;

    private final Map<String, GenerateTask> taskStore = new ConcurrentHashMap<>();

    @Autowired
    public GenerateService(
            AiServiceClient aiServiceClient,
            AiServiceConfig aiServiceConfig,
            InlayDbConfig inlayDbConfig,
            InlayStructureService inlayStructureService,
            FileStorageConfig fileStorageConfig
    ) {
        this.aiServiceClient = aiServiceClient;
        this.aiServiceConfig = aiServiceConfig;
        this.inlayDbConfig = inlayDbConfig;
        this.inlayStructureService = inlayStructureService;
        this.fileStorageConfig = fileStorageConfig;
    }

    private static final List<String> VIEW_FACE_KEYS = List.of(
            "front", "back", "left", "right", "top", "bottom"
    );

    public GenerateResponse imageTo3d(
            MultipartFile imageFile,
            String prompt,
            String outputFormat,
            String inlayStructureFilename,
            boolean multiViewEnabled,
            Map<String, MultipartFile> viewFiles
    ) {
        String taskId = UUID.randomUUID().toString();
        GenerateTask task = createTask(
                taskId, "image-to-3d", imageFile, prompt, outputFormat,
                null, multiViewEnabled, viewFiles
        );

        try {
            String settingPath = resolveInlayMeshPath(inlayStructureFilename);
            Map<String, String> viewPaths = resolveViewPaths(taskId, viewFiles);
            String primaryImagePath = task.getInputImagePath();
            if (primaryImagePath == null && viewPaths.containsKey("front")) {
                primaryImagePath = viewPaths.get("front");
            } else if (primaryImagePath == null && !viewPaths.isEmpty()) {
                primaryImagePath = viewPaths.values().iterator().next();
            }
            JsonNode aiResponse = aiServiceClient.callImageTo3d(
                    taskId,
                    primaryImagePath,
                    settingPath,
                    prompt,
                    outputFormat,
                    multiViewEnabled,
                    viewPaths
            );
            applyAiSubmission(task, aiResponse);
        } catch (Exception e) {
            failTask(task, e.getMessage());
            throw new BusinessException("图片转3D提交失败: " + e.getMessage(), e);
        }
        return buildResponse(task);
    }

    public GenerateResponse conditionGenerate(
            MultipartFile imageFile,
            String inlayStructureFilename,
            MultipartFile inlayStructureFile,
            String prompt,
            String outputFormat,
            String inlayType,
            String gemType
    ) {
        String taskId = UUID.randomUUID().toString();
        GenerateTask task = createTask(taskId, "condition-generate", imageFile, prompt, outputFormat, inlayStructureFilename);

        try {
            String settingPath;
            if (inlayStructureFile != null && !inlayStructureFile.isEmpty()) {
                Path inlayPath = fileStorageConfig.getUploadPath().resolve(taskId).resolve(safeFilename(inlayStructureFile.getOriginalFilename()));
                saveMultipartFile(inlayStructureFile, inlayPath);
                settingPath = inlayPath.toString();
                task.setInlayStructureFilename(inlayStructureFile.getOriginalFilename());
            } else {
                settingPath = resolveInlayMeshPath(inlayStructureFilename);
                task.setInlayStructureFilename(inlayStructureFilename);
            }

            if (settingPath == null) {
                throw new BusinessException("无法解析镶嵌底座网格文件，请选择 OBJ/GLB/STL 格式或提供可转换的底座");
            }

            JsonNode aiResponse = aiServiceClient.callConditionGenerate(
                    taskId,
                    task.getInputImagePath().toString(),
                    settingPath,
                    prompt,
                    outputFormat,
                    inlayType,
                    gemType
            );
            applyAiSubmission(task, aiResponse);
        } catch (BusinessException e) {
            failTask(task, e.getMessage());
            throw e;
        } catch (Exception e) {
            failTask(task, e.getMessage());
            throw new BusinessException("条件生成提交失败: " + e.getMessage(), e);
        }
        return buildResponse(task);
    }

    public List<TaskViewDto> getAllTaskViews() {
        refreshProcessingTasks();
        List<TaskViewDto> views = new ArrayList<>();
        for (GenerateTask task : taskStore.values()) {
            views.add(toViewDto(task));
        }
        views.sort((a, b) -> {
            if (a.getCreatedAt() == null || b.getCreatedAt() == null) return 0;
            return b.getCreatedAt().compareTo(a.getCreatedAt());
        });
        return views;
    }

    public TaskViewDto getTaskView(String taskId) {
        GenerateTask task = getTask(taskId);
        return toViewDto(task);
    }

    public GenerateTask getTask(String taskId) {
        GenerateTask task = taskStore.get(taskId);
        if (task == null) {
            throw new BusinessException(404, "任务不存在: " + taskId);
        }
        if ("pending".equals(task.getStatus()) || "processing".equals(task.getStatus())) {
            refreshTaskFromAi(task);
        }
        return task;
    }

    public Path getOutputFile(String taskId) {
        GenerateTask task = taskStore.get(taskId);
        if (task != null) {
            if (!"completed".equals(task.getStatus())) {
                throw new BusinessException("任务尚未完成，当前状态: " + task.getStatus());
            }
            Path outputPath = resolveStoredOutputPath(task);
            if (outputPath == null || !Files.exists(outputPath)) {
                syncOutputFromAi(task);
                outputPath = resolveStoredOutputPath(task);
            }
            if (outputPath != null && Files.exists(outputPath)) {
                return outputPath;
            }
        }

        Path fallback = findOutputOnDisk(taskId);
        if (fallback != null) {
            return fallback;
        }

        String name = task != null && task.getOutputFilename() != null
                ? task.getOutputFilename() : "generated.glb";
        throw new BusinessException(404, "输出文件不存在: " + name);
    }

    /** 服务重启后内存任务丢失时，从 AI / 业务 outputs 目录按 taskId 查找 GLB */
    private Path findOutputOnDisk(String taskId) {
        for (String filename : List.of("generated.glb", "generated.obj")) {
            Path business = fileStorageConfig.getOutputPath().resolve(taskId).resolve(filename);
            if (Files.exists(business)) {
                return business.normalize();
            }
            Path ai = aiServiceConfig.getOutputPath().resolve(taskId).resolve(filename);
            if (Files.exists(ai)) {
                return ai.normalize();
            }
        }
        return null;
    }

    public void deleteTask(String taskId) {
        GenerateTask task = taskStore.remove(taskId);
        if (task == null) {
            throw new BusinessException(404, "任务不存在: " + taskId);
        }
        try {
            Path inputDir = fileStorageConfig.getUploadPath().resolve(taskId);
            deleteDirectory(inputDir);
            Path outputTaskDir = fileStorageConfig.getOutputPath().resolve(taskId);
            deleteDirectory(outputTaskDir);
        } catch (IOException e) {
            log.warn("清理任务文件失败: {}", taskId, e);
        }
    }

    private GenerateTask createTask(
            String taskId,
            String taskType,
            MultipartFile imageFile,
            String prompt,
            String outputFormat,
            String inlayFilename
    ) {
        return createTask(taskId, taskType, imageFile, prompt, outputFormat, inlayFilename, false, Map.of());
    }

    private GenerateTask createTask(
            String taskId,
            String taskType,
            MultipartFile imageFile,
            String prompt,
            String outputFormat,
            String inlayFilename,
            boolean multiViewEnabled,
            Map<String, MultipartFile> viewFiles
    ) {
        GenerateTask task = new GenerateTask();
        task.setTaskId(taskId);
        task.setTaskType(taskType);
        task.setStatus("pending");
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());
        task.setParams(buildParamsJson(prompt, outputFormat, inlayFilename, multiViewEnabled, viewFiles.keySet()));

        try {
            if (imageFile != null && !imageFile.isEmpty()) {
                String displayFilename = displayFilename(imageFile.getOriginalFilename());
                String storedFilename = toStoredFilename(displayFilename);
                Path uploadPath = fileStorageConfig.getUploadPath().resolve(taskId).resolve(storedFilename);
                saveMultipartFile(imageFile, uploadPath);
                task.setInputImageFilename(displayFilename);
                task.setInputImagePath(uploadPath.toString());
            } else if (multiViewEnabled) {
                task.setInputImageFilename("multi-view(" + viewFiles.size() + " faces)");
            }

            if (multiViewEnabled && !viewFiles.isEmpty()) {
                Path viewsDir = fileStorageConfig.getUploadPath().resolve(taskId).resolve("views");
                Files.createDirectories(viewsDir);
                for (Map.Entry<String, MultipartFile> entry : viewFiles.entrySet()) {
                    String face = entry.getKey();
                    MultipartFile file = entry.getValue();
                    String ext = getExtension(displayFilename(file.getOriginalFilename()));
                    if (ext.isBlank()) {
                        ext = ".png";
                    }
                    Path viewPath = viewsDir.resolve(face + ext);
                    saveMultipartFile(file, viewPath);
                }
            }
        } catch (IOException e) {
            throw new BusinessException("保存上传文件失败: " + e.getMessage(), e);
        }

        taskStore.put(taskId, task);
        return task;
    }

    private Map<String, String> resolveViewPaths(String taskId, Map<String, MultipartFile> viewFiles) {
        if (viewFiles == null || viewFiles.isEmpty()) {
            return Map.of();
        }
        Map<String, String> paths = new LinkedHashMap<>();
        Path viewsDir = fileStorageConfig.getUploadPath().resolve(taskId).resolve("views");
        for (String face : VIEW_FACE_KEYS) {
            if (!viewFiles.containsKey(face)) {
                continue;
            }
            try (var stream = Files.list(viewsDir)) {
                stream.filter(Files::isRegularFile)
                        .filter(p -> p.getFileName().toString().startsWith(face + "."))
                        .findFirst()
                        .ifPresent(p -> paths.put(face, p.toString()));
            } catch (IOException e) {
                log.warn("读取多视图路径失败 {}: {}", face, e.getMessage());
            }
        }
        return paths;
    }

    private String buildParamsJson(
            String prompt,
            String outputFormat,
            String inlayFilename,
            boolean multiViewEnabled,
            Set<String> viewFaces
    ) {
        String viewsJson = viewFaces == null || viewFaces.isEmpty()
                ? "[]"
                : "[\"" + String.join("\",\"", viewFaces) + "\"]";
        return String.format(
                "{\"prompt\":\"%s\",\"output_format\":\"%s\",\"inlay_file\":\"%s\",\"multi_view\":%s,\"views\":%s}",
                prompt != null ? prompt.replace("\"", "'") : "",
                outputFormat != null ? outputFormat : "GLB",
                inlayFilename != null ? inlayFilename : "",
                multiViewEnabled,
                viewsJson
        );
    }

    private String buildParamsJson(String prompt, String outputFormat, String inlayFilename) {
        return buildParamsJson(prompt, outputFormat, inlayFilename, false, Set.of());
    }

    private void applyAiSubmission(GenerateTask task, JsonNode aiResponse) {
        String status = aiResponse.path("status").asText("processing");
        task.setStatus(status);
        task.setUpdatedAt(LocalDateTime.now());
        taskStore.put(task.getTaskId(), task);
    }

    private void refreshProcessingTasks() {
        taskStore.values().stream()
                .filter(t -> "pending".equals(t.getStatus()) || "processing".equals(t.getStatus()))
                .forEach(this::refreshTaskFromAi);
    }

    private void refreshTaskFromAi(GenerateTask task) {
        try {
            JsonNode statusNode = aiServiceClient.getTaskStatus(task.getTaskId());
            String status = statusNode.path("status").asText(task.getStatus());
            task.setStatus(status);
            task.setUpdatedAt(LocalDateTime.now());

            if ("completed".equals(status)) {
                syncOutputFromAi(task);
                task.setCompletedAt(LocalDateTime.now());
            } else if ("failed".equals(status)) {
                String detail = statusNode.path("error").asText(null);
                String message = statusNode.path("message").asText("AI生成失败");
                task.setErrorMessage(detail != null && !detail.isBlank() ? detail : message);
                task.setCompletedAt(LocalDateTime.now());
            }
            taskStore.put(task.getTaskId(), task);
        } catch (Exception e) {
            log.warn("刷新任务状态失败 {}: {}", task.getTaskId(), e.getMessage());
        }
    }

    /**
     * 将 AI 服务生成的模型文件复制到业务服务 outputs 目录，供下载与预览使用。
     */
    private void syncOutputFromAi(GenerateTask task) {
        try {
            JsonNode resultNode = aiServiceClient.getTaskResult(task.getTaskId());
            String aiPath = extractAiResultFilePath(resultNode);
            if (aiPath == null) {
                log.warn("任务 {} 无 AI 结果文件路径", task.getTaskId());
                return;
            }

            Path source = resolveAiSourcePath(aiPath, task.getTaskId());
            if (source == null || !Files.exists(source)) {
                log.warn("AI 输出文件不存在: taskId={} path={}", task.getTaskId(), aiPath);
                return;
            }

            String filename = source.getFileName().toString();
            Path destDir = fileStorageConfig.getOutputPath().resolve(task.getTaskId());
            Path dest = destDir.resolve(filename);
            Files.createDirectories(destDir);
            Files.copy(source, dest, StandardCopyOption.REPLACE_EXISTING);

            task.setOutputPath(dest.toString());
            task.setOutputFilename(filename);
            taskStore.put(task.getTaskId(), task);
            log.info("已同步 AI 输出: {} -> {}", source, dest);
        } catch (Exception e) {
            log.warn("同步 AI 输出失败 {}: {}", task.getTaskId(), e.getMessage());
        }
    }

    private String extractAiResultFilePath(JsonNode resultNode) {
        if (resultNode.has("result_files") && resultNode.get("result_files").isArray()
                && !resultNode.get("result_files").isEmpty()) {
            return resultNode.get("result_files").get(0).asText();
        }
        String resultUrl = resultNode.path("result_url").asText(null);
        if (resultUrl != null && !resultUrl.startsWith("/") && !resultUrl.startsWith("http")) {
            return resultUrl;
        }
        return null;
    }

    private Path resolveAiSourcePath(String aiPath, String taskId) {
        Path direct = Paths.get(aiPath);
        if (direct.isAbsolute() && Files.exists(direct)) {
            return direct.normalize();
        }

        String normalized = aiPath.replace('\\', '/');
        if (normalized.startsWith("./")) {
            normalized = normalized.substring(2);
        }

        if (normalized.startsWith("outputs/")) {
            Path underAiOutput = aiServiceConfig.getOutputPath().resolve(normalized.substring("outputs/".length()));
            if (Files.exists(underAiOutput)) {
                return underAiOutput.normalize();
            }
        }

        Path byTaskDir = aiServiceConfig.getOutputPath().resolve(taskId).resolve(direct.getFileName().toString());
        if (Files.exists(byTaskDir)) {
            return byTaskDir.normalize();
        }

        Path fromAiRoot = aiServiceConfig.getOutputPath().getParent().resolve(normalized).normalize();
        if (Files.exists(fromAiRoot)) {
            return fromAiRoot;
        }

        return direct;
    }

    private Path resolveStoredOutputPath(GenerateTask task) {
        if (task.getOutputPath() == null) {
            return null;
        }
        Path stored = Paths.get(task.getOutputPath());
        if (Files.exists(stored)) {
            return stored.normalize();
        }
        return resolveAiSourcePath(task.getOutputPath(), task.getTaskId());
    }

    private void failTask(GenerateTask task, String message) {
        task.setStatus("failed");
        task.setErrorMessage(message);
        task.setUpdatedAt(LocalDateTime.now());
        task.setCompletedAt(LocalDateTime.now());
        taskStore.put(task.getTaskId(), task);
    }

    private TaskViewDto toViewDto(GenerateTask task) {
        TaskViewDto dto = new TaskViewDto();
        dto.setTaskId(task.getTaskId());
        dto.setInputFile(task.getInputImageFilename());
        dto.setStatus(task.getStatus());
        dto.setInlayFile(task.getInlayStructureFilename());
        dto.setResultFile(task.getOutputFilename());
        dto.setErrorMessage(task.getErrorMessage());
        dto.setCreatedAt(formatTime(task.getCreatedAt()));
        dto.setUpdatedAt(formatTime(task.getUpdatedAt()));

        if (task.getParams() != null) {
            if (task.getParams().contains("output_format")) {
                int i = task.getParams().indexOf("output_format");
                String sub = task.getParams().substring(i);
                int start = sub.indexOf('"', sub.indexOf(':')) + 1;
                int end = sub.indexOf('"', start);
                if (start > 0 && end > start) {
                    dto.setOutputFormat(sub.substring(start, end));
                }
            }
            if (task.getParams().contains("prompt")) {
                int i = task.getParams().indexOf("prompt");
                String sub = task.getParams().substring(i);
                int start = sub.indexOf('"', sub.indexOf(':')) + 1;
                int end = sub.indexOf('"', start);
                if (start > 0 && end > start) {
                    dto.setPrompt(sub.substring(start, end));
                }
            }
        }
        return dto;
    }

    private String formatTime(LocalDateTime time) {
        return time == null ? null : time.format(DT_FMT);
    }

    /**
     * 从镶嵌库解析可用网格路径；.jcd 会尝试查找同目录下的 obj/glb/stl
     */
    private String resolveInlayMeshPath(String filename) {
        if (filename == null || filename.isBlank()) {
            return null;
        }
        Path dbRoot = Paths.get(inlayDbConfig.getPath()).toAbsolutePath().normalize();
        Path filePath = findFileByName(dbRoot, filename);
        if (filePath == null) {
            throw new BusinessException(404, "镶嵌结构不存在: " + filename);
        }

        String ext = getExtension(filename).toLowerCase();
        if (MESH_EXTENSIONS.contains(ext)) {
            return filePath.toString();
        }

        // .jcd 等格式：尝试同目录 mesh 伴生文件
        String baseName = getBaseName(filename);
        Path parent = filePath.getParent();
        for (String meshExt : List.of(".obj", ".glb", ".stl")) {
            Path candidate = parent.resolve(baseName + meshExt);
            if (Files.exists(candidate)) {
                log.info("镶嵌文件 {} 使用伴生网格 {}", filename, candidate);
                return candidate.toString();
            }
        }
        throw new BusinessException("镶嵌文件 " + filename + " 缺少 OBJ/GLB/STL 伴生网格，请先转换格式");
    }

    private Path findFileByName(Path root, String filename) {
        Path direct = root.resolve(filename);
        if (Files.exists(direct)) {
            return direct;
        }
        try (var stream = Files.walk(root, 4)) {
            return stream.filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().equals(filename))
                    .findFirst()
                    .orElse(null);
        } catch (IOException e) {
            return null;
        }
    }

    private String getExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot) : "";
    }

    private String getBaseName(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(0, dot) : filename;
    }

    private GenerateResponse buildResponse(GenerateTask task) {
        GenerateResponse response = new GenerateResponse();
        response.setTaskId(task.getTaskId());
        response.setStatus(task.getStatus());
        response.setMessage(switch (task.getStatus()) {
            case "pending" -> "任务已提交，等待处理";
            case "processing" -> "任务正在处理中";
            case "completed" -> "生成完成";
            case "failed" -> "生成失败: " + task.getErrorMessage();
            default -> "未知状态";
        });
        if ("completed".equals(task.getStatus())) {
            response.setDownloadUrl("/api/generate/download/" + task.getTaskId());
        }
        return response;
    }

    private void deleteDirectory(Path path) throws IOException {
        if (!Files.exists(path)) return;
        Files.walk(path)
                .sorted(Comparator.reverseOrder())
                .forEach(p -> {
                    try {
                        Files.deleteIfExists(p);
                    } catch (IOException ignored) {
                    }
                });
    }

    private static void saveMultipartFile(MultipartFile file, Path destination) throws IOException {
        Path parent = destination.getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
        try (InputStream inputStream = file.getInputStream()) {
            Files.copy(inputStream, destination, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static String displayFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return "upload.bin";
        }
        String name = Paths.get(filename).getFileName().toString();
        return name.isBlank() ? "upload.bin" : name;
    }

    /** 磁盘存储使用 ASCII 文件名，避免 OpenCV / 部分 AI 库在 Windows 下无法读取中文路径 */
    private static String toStoredFilename(String displayName) {
        int dot = displayName.lastIndexOf('.');
        String ext = dot >= 0 ? displayName.substring(dot).toLowerCase() : "";
        if (ext.isBlank()) {
            ext = ".png";
        }
        return "input" + ext;
    }

    private static String safeFilename(String filename) {
        return displayFilename(filename);
    }
}
