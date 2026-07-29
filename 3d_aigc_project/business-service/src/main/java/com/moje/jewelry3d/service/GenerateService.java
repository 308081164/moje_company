package com.moje.jewelry3d.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.config.AiServiceConfig;
import com.moje.jewelry3d.config.FileStorageConfig;
import com.moje.jewelry3d.entity.GenerateTaskAssetEntity;
import com.moje.jewelry3d.entity.GenerateTaskEntity;
import com.moje.jewelry3d.inlay.entity.InlayItemEntity;
import com.moje.jewelry3d.inlay.repository.InlayItemRepository;
import com.moje.jewelry3d.inlay.service.LegacyPathResolver;
import com.moje.jewelry3d.model.dto.GenerateResponse;
import com.moje.jewelry3d.model.dto.TaskViewDto;
import com.moje.jewelry3d.repository.GenerateTaskAssetRepository;
import com.moje.jewelry3d.repository.GenerateTaskRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 生成业务逻辑服务
 * 任务元数据持久化至数据库，文件存储至 MinIO / 本地（与 inlay v2 模式一致）
 */
@Slf4j
@Service
public class GenerateService {

    private static final DateTimeFormatter DT_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    /** 历史任务未落库镶嵌 ID、仅能从分色产物推断时使用 */
    private static final String INLAY_BACKFILL_MARKER = "colored_merge";
    private static final List<String> VIEW_FACE_KEYS = List.of(
            "front", "back", "left", "right", "top", "bottom"
    );

    private final AiServiceClient aiServiceClient;
    private final AiServiceConfig aiServiceConfig;
    private final LegacyPathResolver legacyPathResolver;
    private final FileStorageConfig fileStorageConfig;
    private final GenerateTaskRepository taskRepository;
    private final GenerateTaskAssetRepository assetRepository;
    private final GenerateStorageService storageService;
    private final InlayItemRepository inlayItemRepository;

    @Autowired
    public GenerateService(
            AiServiceClient aiServiceClient,
            AiServiceConfig aiServiceConfig,
            LegacyPathResolver legacyPathResolver,
            FileStorageConfig fileStorageConfig,
            GenerateTaskRepository taskRepository,
            GenerateTaskAssetRepository assetRepository,
            GenerateStorageService storageService,
            InlayItemRepository inlayItemRepository
    ) {
        this.aiServiceClient = aiServiceClient;
        this.aiServiceConfig = aiServiceConfig;
        this.legacyPathResolver = legacyPathResolver;
        this.fileStorageConfig = fileStorageConfig;
        this.taskRepository = taskRepository;
        this.assetRepository = assetRepository;
        this.storageService = storageService;
        this.inlayItemRepository = inlayItemRepository;
    }

    public GenerateResponse imageTo3d(
            MultipartFile imageFile,
            String prompt,
            String outputFormat,
            String inlayStructureFilename,
            boolean multiViewEnabled,
            Map<String, MultipartFile> viewFiles,
            String generationMode
    ) {
        String taskId = UUID.randomUUID().toString();
        // 必须写入镶嵌文件名：否则任务详情无 preview_url，前端会回退到灰模 STL 下载
        GenerateTaskEntity task = createTask(
                taskId, "image-to-3d", imageFile, prompt, outputFormat,
                inlayStructureFilename, multiViewEnabled, viewFiles, generationMode
        );

        try {
            String settingPath = resolveInlayMeshPath(inlayStructureFilename);
            if (inlayStructureFilename != null && !inlayStructureFilename.isBlank()) {
                task.setInlayStructureFilename(inlayStructureFilename);
                saveTask(task);
            }
            Map<String, String> viewPaths = resolveViewPaths(taskId, viewFiles);
            String primaryImagePath = resolvePrimaryImagePath(taskId, viewPaths);
            JsonNode aiResponse = aiServiceClient.callImageTo3d(
                    taskId,
                    primaryImagePath,
                    settingPath,
                    prompt,
                    outputFormat,
                    multiViewEnabled,
                    viewPaths,
                    generationMode
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
            String gemType,
            String generationMode
    ) {
        String taskId = UUID.randomUUID().toString();
        GenerateTaskEntity task = createTask(
                taskId, "condition-generate", imageFile, prompt, outputFormat,
                inlayStructureFilename, false, Map.of(), generationMode
        );

        try {
            String settingPath;
            if (inlayStructureFile != null && !inlayStructureFile.isEmpty()) {
                Path inlayPath = fileStorageConfig.getUploadPath().resolve(taskId).resolve(safeFilename(inlayStructureFile.getOriginalFilename()));
                saveMultipartFile(inlayStructureFile, inlayPath);
                settingPath = inlayPath.toString();
                task.setInlayStructureFilename(inlayStructureFile.getOriginalFilename());
                registerAsset(taskId, "inlay", storageService.inputBucket(), taskId + "/inlay/" + inlayPath.getFileName(), inlayPath, guessContentType(inlayPath.getFileName().toString()));
                saveTask(task);
            } else {
                settingPath = resolveInlayMeshPath(inlayStructureFilename);
                task.setInlayStructureFilename(inlayStructureFilename);
                saveTask(task);
            }

            if (settingPath == null) {
                throw new BusinessException("无法解析镶嵌底座网格文件，请选择 OBJ/GLB/STL 格式或提供可转换的底座");
            }

            String inputPath = resolveInputLocalPath(taskId)
                    .map(Path::toString)
                    .orElseThrow(() -> new BusinessException("输入图片路径不存在"));

            JsonNode aiResponse = aiServiceClient.callConditionGenerate(
                    taskId,
                    inputPath,
                    settingPath,
                    prompt,
                    outputFormat,
                    inlayType,
                    gemType,
                    generationMode
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
        return taskRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, Integer.MAX_VALUE))
                .map(this::toViewDtoWithInlayBackfill)
                .getContent();
    }

    public Page<TaskViewDto> getTaskViews(int page, int pageSize) {
        refreshProcessingTasks();
        return taskRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(Math.max(0, page - 1), pageSize))
                .map(this::toViewDtoWithInlayBackfill);
    }

    public TaskViewDto getTaskView(String taskId) {
        GenerateTaskEntity task = getTask(taskId);
        return toViewDtoWithInlayBackfill(task);
    }

    private TaskViewDto toViewDtoWithInlayBackfill(GenerateTaskEntity task) {
        ensureInlayMetadata(task);
        return toViewDto(task);
    }

    /**
     * 任务详情/列表展示前补齐镶嵌字段：
     * 1) params_json.inlay_file（创建时写入但列为空）
     * 2) 磁盘/AI 侧 final.glb、colored.glb（历史 image-to-3d 未落库）
     */
    private void ensureInlayMetadata(GenerateTaskEntity task) {
        if (task == null) {
            return;
        }
        String existing = task.getInlayStructureFilename();
        if (existing != null && !existing.isBlank()) {
            return;
        }

        String fromParams = extractParamsField(task.getParamsJson(), "inlay_file");
        if (fromParams != null && !fromParams.isBlank()) {
            task.setInlayStructureFilename(fromParams);
            saveTask(task);
            log.info("已从 params_json 回填镶嵌字段: taskId={} inlay={}", task.getTaskId(), fromParams);
            return;
        }

        if (findPreviewOnDisk(task.getTaskId()) != null) {
            task.setInlayStructureFilename(INLAY_BACKFILL_MARKER);
            saveTask(task);
            log.info("已从分色产物回填镶嵌字段: taskId={} -> {}", task.getTaskId(), INLAY_BACKFILL_MARKER);
        }
    }

    public GenerateTaskEntity getTask(String taskId) {
        GenerateTaskEntity task = taskRepository.findById(taskId)
                .orElseThrow(() -> new BusinessException(404, "任务不存在: " + taskId));
        if ("pending".equals(task.getStatus()) || "queued".equals(task.getStatus())
                || "processing".equals(task.getStatus())) {
            refreshTaskFromAi(task);
        }
        return task;
    }

    public Path getOutputFile(String taskId) {
        GenerateTaskEntity task = taskRepository.findById(taskId).orElse(null);

        if (task != null) {
            if (!"completed".equals(task.getStatus())) {
                throw new BusinessException("任务尚未完成，当前状态: " + task.getStatus());
            }
            tryResyncColoredFinalFromAi(task);
            Path outputPath = resolveDownloadPath(task);
            if (outputPath != null && Files.exists(outputPath)) {
                return outputPath;
            }
            syncOutputFromAi(task);
            outputPath = resolveDownloadPath(task);
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

    /**
     * 3D 预览文件：镶嵌分色任务优先 final.glb / colored.glb（保留 COLOR_0 与双节点）。
     */
    /**
     * 用户上传的平面输入图（单图或多视图首图），供任务列表缩略图展示。
     */
    public Path getInputImageFile(String taskId) {
        return resolveInputPreviewPath(taskId)
                .filter(Files::exists)
                .orElseThrow(() -> new BusinessException(404, "输入图片不存在"));
    }

    public Path getPreviewFile(String taskId) {
        GenerateTaskEntity task = taskRepository.findById(taskId).orElse(null);
        if (task != null) {
            if (!"completed".equals(task.getStatus())) {
                throw new BusinessException("任务尚未完成，当前状态: " + task.getStatus());
            }
            tryResyncColoredFinalFromAi(task);
            Path preview = resolvePreviewPath(task);
            if (preview != null && Files.exists(preview)) {
                return preview;
            }
            syncOutputFromAi(task);
            preview = resolvePreviewPath(task);
            if (preview != null && Files.exists(preview)) {
                return preview;
            }
        }

        Path glbFallback = findPreviewOnDisk(taskId);
        if (glbFallback != null) {
            return glbFallback;
        }

        throw new BusinessException(404, "分色预览 GLB 不存在，请下载 STL 或使用白模预览");
    }

    /**
     * 分色预览补同步：不依赖 inlay 字段（历史任务可能未落库），只要 AI 侧有 final/colored.glb 就同步。
     */
    private void tryResyncColoredFinalFromAi(GenerateTaskEntity task) {
        Path taskDir = fileStorageConfig.getOutputPath().resolve(task.getTaskId());
        boolean syncedAny = false;
        for (String previewName : List.of("final.glb", "colored.glb")) {
            Path aiPreview = aiServiceConfig.getOutputPath()
                    .resolve(task.getTaskId())
                    .resolve(previewName);
            if (!Files.isRegularFile(aiPreview)) {
                continue;
            }
            try {
                Files.createDirectories(taskDir);
                Path dest = taskDir.resolve(previewName);
                Files.copy(aiPreview, dest, StandardCopyOption.REPLACE_EXISTING);
                registerAsset(
                        task.getTaskId(),
                        "preview",
                        storageService.outputBucket(),
                        task.getTaskId() + "/" + previewName,
                        dest,
                        guessContentType(previewName)
                );
                syncedAny = true;
                log.info("已补同步分色预览 {}: taskId={} <- {}", previewName, task.getTaskId(), aiPreview);
            } catch (Exception e) {
                log.warn("补同步 {} 失败 {}: {}", previewName, task.getTaskId(), e.getMessage());
            }
        }
        // 历史 image-to-3d 任务未写入 inlay 字段时，用磁盘产物回填，便于 API 返回 preview_url
        if (syncedAny
                && (task.getInlayStructureFilename() == null || task.getInlayStructureFilename().isBlank())) {
            task.setInlayStructureFilename(INLAY_BACKFILL_MARKER);
            saveTask(task);
        }
    }

    @Transactional
    public void deleteTask(String taskId) {
        GenerateTaskEntity task = taskRepository.findById(taskId)
                .orElseThrow(() -> new BusinessException(404, "任务不存在: " + taskId));

        String storagePrefix = taskId + "/";
        for (GenerateTaskAssetEntity asset : assetRepository.findByTaskId(taskId)) {
            storageService.deleteObject(asset.getStorageBucket(), asset.getStorageKey());
        }
        storageService.deleteObjectsByPrefix(storageService.inputBucket(), storagePrefix);
        storageService.deleteObjectsByPrefix(storageService.outputBucket(), storagePrefix);
        assetRepository.deleteByTaskId(taskId);
        taskRepository.delete(task);

        try {
            deleteDirectory(fileStorageConfig.getUploadPath().resolve(taskId));
            deleteDirectory(fileStorageConfig.getOutputPath().resolve(taskId));
            deleteDirectory(aiServiceConfig.getOutputPath().resolve(taskId));
        } catch (IOException e) {
            log.warn("清理任务本地文件失败: {}", taskId, e);
        }
        log.info("任务已永久删除: {}", taskId);
    }

    private GenerateTaskEntity createTask(
            String taskId,
            String taskType,
            MultipartFile imageFile,
            String prompt,
            String outputFormat,
            String inlayFilename
    ) {
        return createTask(taskId, taskType, imageFile, prompt, outputFormat, inlayFilename, false, Map.of(), "quality");
    }

    private GenerateTaskEntity createTask(
            String taskId,
            String taskType,
            MultipartFile imageFile,
            String prompt,
            String outputFormat,
            String inlayFilename,
            boolean multiViewEnabled,
            Map<String, MultipartFile> viewFiles
    ) {
        return createTask(taskId, taskType, imageFile, prompt, outputFormat, inlayFilename, multiViewEnabled, viewFiles, "quality");
    }

    private GenerateTaskEntity createTask(
            String taskId,
            String taskType,
            MultipartFile imageFile,
            String prompt,
            String outputFormat,
            String inlayFilename,
            boolean multiViewEnabled,
            Map<String, MultipartFile> viewFiles,
            String generationMode
    ) {
        GenerateTaskEntity task = new GenerateTaskEntity();
        task.setTaskId(taskId);
        task.setTaskType(taskType);
        task.setStatus("pending");
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());
        task.setParamsJson(buildParamsJson(
                prompt, outputFormat, inlayFilename, multiViewEnabled, viewFiles.keySet(), generationMode
        ));
        if (inlayFilename != null && !inlayFilename.isBlank()) {
            task.setInlayStructureFilename(inlayFilename);
        }

        try {
            if (imageFile != null && !imageFile.isEmpty()) {
                String displayFilename = displayFilename(imageFile.getOriginalFilename());
                String storedFilename = toStoredFilename(displayFilename);
                Path uploadPath = fileStorageConfig.getUploadPath().resolve(taskId).resolve(storedFilename);
                saveMultipartFile(imageFile, uploadPath);
                task.setInputImageFilename(displayFilename);
                registerAsset(taskId, "input", storageService.inputBucket(), taskId + "/" + storedFilename, uploadPath, guessContentType(storedFilename));
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
                    registerAsset(taskId, "view", storageService.inputBucket(), taskId + "/views/" + face + ext, viewPath, guessContentType(face + ext));
                }
            }
        } catch (IOException e) {
            throw new BusinessException("保存上传文件失败: " + e.getMessage(), e);
        }

        return saveTask(task);
    }

    private void registerAsset(String taskId, String assetType, String bucket, String key, Path localPath, String contentType) {
        if (localPath == null || !Files.isRegularFile(localPath)) {
            return;
        }
        try {
            assetRepository.findFirstByTaskIdAndAssetTypeOrderByCreatedAtDesc(taskId, assetType)
                    .ifPresent(existing -> {
                        if (!existing.getStorageKey().equals(key)) {
                            storageService.deleteObject(existing.getStorageBucket(), existing.getStorageKey());
                        }
                        assetRepository.delete(existing);
                    });
            storageService.putFile(bucket, key, localPath, contentType);
            GenerateTaskAssetEntity asset = new GenerateTaskAssetEntity();
            asset.setId(UUID.randomUUID().toString());
            asset.setTaskId(taskId);
            asset.setAssetType(assetType);
            asset.setStorageBucket(bucket);
            asset.setStorageKey(key);
            asset.setSizeBytes(Files.size(localPath));
            asset.setContentType(contentType);
            asset.setCreatedAt(LocalDateTime.now());
            assetRepository.save(asset);
        } catch (Exception e) {
            log.warn("注册任务资产失败 taskId={} type={}: {}", taskId, assetType, e.getMessage());
        }
    }

    private Optional<Path> resolveInputPreviewPath(String taskId) {
        Optional<Path> input = resolveInputLocalPath(taskId);
        if (input.isPresent()) {
            return input;
        }
        for (String face : VIEW_FACE_KEYS) {
            Optional<Path> view = resolveViewLocalPath(taskId, face);
            if (view.isPresent()) {
                return view;
            }
        }
        return Optional.empty();
    }

    private Optional<Path> resolveViewLocalPath(String taskId, String face) {
        for (GenerateTaskAssetEntity asset : assetRepository.findByTaskId(taskId)) {
            if (!"view".equals(asset.getAssetType())) {
                continue;
            }
            String key = asset.getStorageKey();
            if (key == null || !key.contains("/views/" + face + ".")) {
                continue;
            }
            Optional<Path> materialized = storageService.materializeLocal(asset.getStorageBucket(), key);
            if (materialized.isPresent()) {
                return materialized;
            }
        }
        Path viewsDir = fileStorageConfig.getUploadPath().resolve(taskId).resolve("views");
        if (!Files.isDirectory(viewsDir)) {
            return Optional.empty();
        }
        try (var stream = Files.list(viewsDir)) {
            return stream.filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().startsWith(face + "."))
                    .findFirst();
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    private Optional<Path> resolveInputLocalPath(String taskId) {
        Optional<GenerateTaskAssetEntity> inputAsset = assetRepository.findFirstByTaskIdAndAssetTypeOrderByCreatedAtDesc(taskId, "input");
        if (inputAsset.isPresent()) {
            GenerateTaskAssetEntity asset = inputAsset.get();
            Optional<Path> materialized = storageService.materializeLocal(asset.getStorageBucket(), asset.getStorageKey());
            if (materialized.isPresent()) {
                return materialized;
            }
        }
        Path uploadDir = fileStorageConfig.getUploadPath().resolve(taskId);
        if (!Files.isDirectory(uploadDir)) {
            return Optional.empty();
        }
        try (var stream = Files.list(uploadDir)) {
            return stream.filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().startsWith("input."))
                    .findFirst();
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    private String resolvePrimaryImagePath(String taskId, Map<String, String> viewPaths) {
        Optional<Path> input = resolveInputLocalPath(taskId);
        if (input.isPresent()) {
            return input.get().toString();
        }
        if (viewPaths.containsKey("front")) {
            return viewPaths.get("front");
        }
        if (!viewPaths.isEmpty()) {
            return viewPaths.values().iterator().next();
        }
        return null;
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
            Set<String> viewFaces,
            String generationMode
    ) {
        String viewsJson = viewFaces == null || viewFaces.isEmpty()
                ? "[]"
                : "[\"" + String.join("\",\"", viewFaces) + "\"]";
        String mode = generationMode != null && !generationMode.isBlank() ? generationMode : "quality";
        return String.format(
                "{\"prompt\":\"%s\",\"output_format\":\"%s\",\"inlay_file\":\"%s\",\"multi_view\":%s,\"views\":%s,\"generation_mode\":\"%s\"}",
                prompt != null ? prompt.replace("\"", "'") : "",
                outputFormat != null ? outputFormat : "GLB",
                inlayFilename != null ? inlayFilename : "",
                multiViewEnabled,
                viewsJson,
                mode.replace("\"", "'")
        );
    }

    private void applyAiSubmission(GenerateTaskEntity task, JsonNode aiResponse) {
        task.setStatus(aiResponse.path("status").asText("processing"));
        saveTask(task);
    }

    private void refreshProcessingTasks() {
        taskRepository.findByStatusInOrderByCreatedAtDesc(
                List.of("pending", "queued", "processing")
        ).forEach(this::refreshTaskFromAi);
    }

    private void refreshTaskFromAi(GenerateTaskEntity task) {
        try {
            JsonNode statusNode = aiServiceClient.getTaskStatus(task.getTaskId());
            String status = statusNode.path("status").asText(task.getStatus());
            task.setStatus(status);

            if ("completed".equals(status)) {
                syncOutputFromAi(task);
                task.setCompletedAt(LocalDateTime.now());
            } else if ("failed".equals(status)) {
                String detail = statusNode.path("error").asText(null);
                String message = statusNode.path("message").asText("AI生成失败");
                task.setErrorMessage(detail != null && !detail.isBlank() ? detail : message);
                task.setCompletedAt(LocalDateTime.now());
            }
            saveTask(task);
        } catch (Exception e) {
            log.warn("刷新任务状态失败 {}: {}", task.getTaskId(), e.getMessage());
        }
    }

    private void syncOutputFromAi(GenerateTaskEntity task) {
        try {
            JsonNode resultNode = aiServiceClient.getTaskResult(task.getTaskId());
            String aiPath = extractAiResultFilePath(resultNode, task);
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

            task.setOutputFilename(filename);
            saveTask(task);

            String storageKey = task.getTaskId() + "/" + filename;
            registerAsset(task.getTaskId(), "output", storageService.outputBucket(), storageKey, dest, guessContentType(filename));

            syncPreviewArtifactsFromAi(task, destDir);
            log.info("已同步 AI 输出: {} -> {}", source, dest);
        } catch (Exception e) {
            log.warn("同步 AI 输出失败 {}: {}", task.getTaskId(), e.getMessage());
        }
    }

    private void syncPreviewArtifactsFromAi(GenerateTaskEntity task, Path destDir) {
        boolean syncedAny = false;
        for (String previewName : List.of("final.glb", "colored.glb")) {
            Path aiPreview = aiServiceConfig.getOutputPath()
                    .resolve(task.getTaskId())
                    .resolve(previewName);
            if (!Files.isRegularFile(aiPreview)) {
                continue;
            }
            try {
                Path dest = destDir.resolve(previewName);
                Files.copy(aiPreview, dest, StandardCopyOption.REPLACE_EXISTING);
                registerAsset(
                        task.getTaskId(),
                        "preview",
                        storageService.outputBucket(),
                        task.getTaskId() + "/" + previewName,
                        dest,
                        guessContentType(previewName)
                );
                syncedAny = true;
            } catch (Exception e) {
                log.warn("同步预览文件失败 {} {}: {}", task.getTaskId(), previewName, e.getMessage());
            }
        }
        if (syncedAny
                && (task.getInlayStructureFilename() == null || task.getInlayStructureFilename().isBlank())) {
            task.setInlayStructureFilename(INLAY_BACKFILL_MARKER);
            saveTask(task);
        }
    }

    private Path resolveDownloadPath(GenerateTaskEntity task) {
        Optional<GenerateTaskAssetEntity> outputAsset = assetRepository.findFirstByTaskIdAndAssetTypeOrderByCreatedAtDesc(task.getTaskId(), "output");
        if (outputAsset.isPresent()) {
            Optional<Path> materialized = storageService.materializeLocal(outputAsset.get().getStorageBucket(), outputAsset.get().getStorageKey());
            if (materialized.isPresent()) {
                return materialized.get();
            }
        }

        if (task.getOutputFilename() != null) {
            Path local = fileStorageConfig.getOutputPath().resolve(task.getTaskId()).resolve(task.getOutputFilename());
            if (Files.exists(local)) {
                return local.normalize();
            }
        }
        return findDownloadOnDisk(task.getTaskId(), task);
    }

    private Path resolvePreviewPath(GenerateTaskEntity task) {
        Optional<GenerateTaskAssetEntity> previewAsset = assetRepository.findFirstByTaskIdAndAssetTypeOrderByCreatedAtDesc(task.getTaskId(), "preview");
        if (previewAsset.isPresent()) {
            Optional<Path> materialized = storageService.materializeLocal(previewAsset.get().getStorageBucket(), previewAsset.get().getStorageKey());
            if (materialized.isPresent()) {
                return materialized.get();
            }
        }
        return findPreviewOnDisk(task.getTaskId());
    }

    /** @deprecated 使用 resolveDownloadPath */
    private Path resolveOutputPath(GenerateTaskEntity task) {
        return resolveDownloadPath(task);
    }

    private String extractAiResultFilePath(JsonNode resultNode, GenerateTaskEntity task) {
        if (resultNode.has("result_files") && resultNode.get("result_files").isArray()) {
            JsonNode files = resultNode.get("result_files");
            if (!files.isEmpty()) {
                String preferredExt = extractOutputFormatExt(task);
                if (preferredExt != null) {
                    for (JsonNode fileNode : files) {
                        String path = fileNode.asText("");
                        if (path.isBlank()) {
                            continue;
                        }
                        String base = Paths.get(path.replace('\\', '/')).getFileName().toString().toLowerCase();
                        if (base.startsWith("final.") && base.endsWith("." + preferredExt)) {
                            return path;
                        }
                    }
                }
                // 镶嵌分色：若无匹配扩展名，仍优先 final.glb 供预览同步
                for (JsonNode fileNode : files) {
                    String path = fileNode.asText("");
                    if (path.isBlank()) {
                        continue;
                    }
                    String base = Paths.get(path.replace('\\', '/')).getFileName().toString().toLowerCase();
                    if (base.equals("final.glb")) {
                        return path;
                    }
                }
                for (JsonNode fileNode : files) {
                    String path = fileNode.asText("");
                    if (path.isBlank()) {
                        continue;
                    }
                    String base = Paths.get(path.replace('\\', '/')).getFileName().toString().toLowerCase();
                    if (base.startsWith("final.")) {
                        return path;
                    }
                }
                return files.get(files.size() - 1).asText();
            }
        }
        String resultUrl = resultNode.path("result_url").asText(null);
        if (resultUrl != null && !resultUrl.startsWith("/") && !resultUrl.startsWith("http")) {
            return resultUrl;
        }
        return null;
    }

    private String extractOutputFormatExt(GenerateTaskEntity task) {
        if (task == null || task.getParamsJson() == null) {
            return null;
        }
        String params = task.getParamsJson();
        if (!params.contains("output_format")) {
            return null;
        }
        int i = params.indexOf("output_format");
        String sub = params.substring(i);
        int start = sub.indexOf('"', sub.indexOf(':')) + 1;
        int end = sub.indexOf('"', start);
        if (start > 0 && end > start) {
            return sub.substring(start, end).toLowerCase();
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

    private Path findDownloadOnDisk(String taskId, GenerateTaskEntity task) {
        String preferredExt = extractOutputFormatExt(task);
        if (preferredExt != null) {
            Path preferred = fileStorageConfig.getOutputPath().resolve(taskId).resolve("final." + preferredExt);
            if (Files.exists(preferred)) {
                return preferred.normalize();
            }
            preferred = aiServiceConfig.getOutputPath().resolve(taskId).resolve("final." + preferredExt);
            if (Files.exists(preferred)) {
                return preferred.normalize();
            }
        }
        return findOutputOnDisk(taskId);
    }

    private Path findPreviewOnDisk(String taskId) {
        for (String filename : List.of("final.glb", "colored.glb")) {
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

    private Path findOutputOnDisk(String taskId) {
        for (String filename : List.of("final.glb", "colored.glb", "generated.glb", "generated.obj")) {
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

    private void failTask(GenerateTaskEntity task, String message) {
        task.setStatus("failed");
        task.setErrorMessage(message);
        task.setCompletedAt(LocalDateTime.now());
        saveTask(task);
    }

    private GenerateTaskEntity saveTask(GenerateTaskEntity task) {
        task.setUpdatedAt(LocalDateTime.now());
        return taskRepository.save(task);
    }

    private TaskViewDto toViewDto(GenerateTaskEntity task) {
        TaskViewDto dto = new TaskViewDto();
        dto.setTaskId(task.getTaskId());
        dto.setInputFile(task.getInputImageFilename());
        dto.setStatus(task.getStatus());
        dto.setInlayFile(resolveInlayDisplayName(task.getInlayStructureFilename()));
        dto.setResultFile(task.getOutputFilename());
        // 仅当磁盘上存在分色 GLB 时才返回 preview_url（避免仅有 inlay 字段但融合失败时前端 404）
        boolean hasColoredPreview = findPreviewOnDisk(task.getTaskId()) != null;
        if (hasColoredPreview) {
            dto.setPreviewUrl("/api/tasks/" + task.getTaskId() + "/preview");
        }
        if (resolveInputPreviewPath(task.getTaskId()).isPresent()) {
            dto.setInputPreviewUrl("/api/tasks/" + task.getTaskId() + "/input-preview");
        }
        dto.setErrorMessage(task.getErrorMessage());
        dto.setCreatedAt(formatTime(task.getCreatedAt()));
        dto.setUpdatedAt(formatTime(task.getUpdatedAt()));

        String params = task.getParamsJson();
        if (params != null) {
            String outputFormat = extractParamsField(params, "output_format");
            if (outputFormat != null) {
                dto.setOutputFormat(outputFormat);
            }
            String prompt = extractParamsField(params, "prompt");
            if (prompt != null) {
                dto.setPrompt(prompt);
            }
            // 列为空但 params 有值时，详情仍应展示（ensureInlayMetadata 通常已回填）
            if (dto.getInlayFile() == null || dto.getInlayFile().isBlank()) {
                String inlayFromParams = extractParamsField(params, "inlay_file");
                if (inlayFromParams != null && !inlayFromParams.isBlank()) {
                    dto.setInlayFile(resolveInlayDisplayName(inlayFromParams));
                }
            }
        }
        return dto;
    }

    /**
     * 将 UUID / legacy 路径解析为可读名称；colored_merge 保持原样由前端本地化。
     */
    private String resolveInlayDisplayName(String inlayRef) {
        if (inlayRef == null || inlayRef.isBlank()) {
            return null;
        }
        if (INLAY_BACKFILL_MARKER.equals(inlayRef)) {
            return inlayRef;
        }
        try {
            Optional<InlayItemEntity> byId = inlayItemRepository.findById(inlayRef);
            if (byId.isPresent()) {
                InlayItemEntity item = byId.get();
                if (item.getDisplayName() != null && !item.getDisplayName().isBlank()) {
                    return item.getDisplayName();
                }
                if (item.getLegacyPath() != null && !item.getLegacyPath().isBlank()) {
                    return item.getLegacyPath();
                }
            }
            Optional<InlayItemEntity> byPath = inlayItemRepository.findByLegacyPath(inlayRef);
            if (byPath.isPresent() && byPath.get().getDisplayName() != null
                    && !byPath.get().getDisplayName().isBlank()) {
                return byPath.get().getDisplayName();
            }
        } catch (Exception e) {
            log.debug("解析镶嵌显示名失败 {}: {}", inlayRef, e.getMessage());
        }
        return inlayRef;
    }

    private String extractParamsField(String params, String field) {
        if (params == null || field == null || !params.contains(field)) {
            return null;
        }
        int i = params.indexOf(field);
        String sub = params.substring(i);
        int start = sub.indexOf('"', sub.indexOf(':')) + 1;
        int end = sub.indexOf('"', start);
        if (start > 0 && end > start) {
            return sub.substring(start, end);
        }
        return null;
    }

    private String formatTime(LocalDateTime time) {
        return time == null ? null : time.format(DT_FMT);
    }

    private String resolveInlayMeshPath(String filename) {
        if (filename == null || filename.isBlank()) {
            return null;
        }
        String resolved = legacyPathResolver.resolveMeshPath(filename);
        if (resolved != null) {
            return resolved;
        }
        throw new BusinessException(404, "镶嵌结构不存在: " + filename);
    }

    private GenerateResponse buildResponse(GenerateTaskEntity task) {
        GenerateResponse response = new GenerateResponse();
        response.setTaskId(task.getTaskId());
        response.setStatus(task.getStatus());
        response.setMessage(switch (task.getStatus()) {
            case "pending" -> "任务已提交，等待处理";
            case "queued" -> "任务排队中，等待 GPU 推理";
            case "processing" -> "任务正在处理中";
            case "completed" -> "生成完成";
            case "failed" -> "生成失败: " + task.getErrorMessage();
            default -> "未知状态";
        });
        if ("completed".equals(task.getStatus())) {
            response.setDownloadUrl("/api/generate/download/" + task.getTaskId());
            if (findPreviewOnDisk(task.getTaskId()) != null) {
                response.setPreviewUrl("/api/tasks/" + task.getTaskId() + "/preview");
            }
        }
        return response;
    }

    private static void deleteDirectory(Path path) throws IOException {
        if (!Files.exists(path)) {
            return;
        }
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

    private static String getExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot) : "";
    }

    private static String guessContentType(String filename) {
        String lower = filename.toLowerCase();
        if (lower.endsWith(".png")) {
            return "image/png";
        }
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        if (lower.endsWith(".glb")) {
            return "model/gltf-binary";
        }
        if (lower.endsWith(".obj")) {
            return "model/obj";
        }
        return "application/octet-stream";
    }
}
