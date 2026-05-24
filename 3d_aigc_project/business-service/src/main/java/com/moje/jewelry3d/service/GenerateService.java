package com.moje.jewelry3d.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.config.InlayDbConfig;
import com.moje.jewelry3d.model.dto.GenerateResponse;
import com.moje.jewelry3d.model.entity.GenerateTask;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 生成业务逻辑服务
 * 管理图片转3D和条件生成的完整生命周期
 */
@Slf4j
@Service
public class GenerateService {

    private final AiServiceClient aiServiceClient;
    private final InlayDbConfig inlayDbConfig;

    /** 上传文件存储目录 */
    @Value("${file.upload-dir:./uploads}")
    private String uploadDir;

    /** 输出文件存储目录 */
    @Value("${file.output-dir:./outputs}")
    private String outputDir;

    /** 内存任务存储（生产环境应替换为数据库） */
    private final Map<String, GenerateTask> taskStore = new ConcurrentHashMap<>();

    @Autowired
    public GenerateService(AiServiceClient aiServiceClient, InlayDbConfig inlayDbConfig) {
        this.aiServiceClient = aiServiceClient;
        this.inlayDbConfig = inlayDbConfig;
    }

    /**
     * 初始化时创建必要的目录
     */
    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(Paths.get(uploadDir));
            Files.createDirectories(Paths.get(outputDir));
            log.info("文件存储目录初始化完成 - 上传: {}, 输出: {}", uploadDir, outputDir);
        } catch (IOException e) {
            log.error("创建文件存储目录失败", e);
        }
    }

    /**
     * 图片转3D生成
     *
     * @param imageFile 上传的设计图
     * @return 生成响应
     */
    public GenerateResponse imageTo3d(MultipartFile imageFile) {
        // 保存上传文件
        String taskId = UUID.randomUUID().toString();
        GenerateTask task = createTask(taskId, "image-to-3d", imageFile);

        try {
            // 调用AI服务进行生成
            JsonNode aiResponse = aiServiceClient.callImageTo3d(task.getInputImagePath());

            // 解析AI服务响应
            handleAiResponse(task, aiResponse);
        } catch (BusinessException e) {
            task.setStatus("failed");
            task.setErrorMessage(e.getMessage());
            task.setUpdatedAt(LocalDateTime.now());
            taskStore.put(taskId, task);
            throw e;
        } catch (Exception e) {
            task.setStatus("failed");
            task.setErrorMessage("生成失败: " + e.getMessage());
            task.setUpdatedAt(LocalDateTime.now());
            taskStore.put(taskId, task);
            throw new BusinessException("图片转3D生成失败: " + e.getMessage(), e);
        }

        return buildResponse(task);
    }

    /**
     * 条件生成（设计图 + 镶嵌底座）
     *
     * @param imageFile               上传的设计图
     * @param inlayStructureFilename  镶嵌底座文件名
     * @param inlayStructureFile      镶嵌底座文件（可选，直接上传）
     * @return 生成响应
     */
    public GenerateResponse conditionGenerate(MultipartFile imageFile,
                                              String inlayStructureFilename,
                                              MultipartFile inlayStructureFile) {
        String taskId = UUID.randomUUID().toString();
        GenerateTask task = createTask(taskId, "condition-generate", imageFile);
        task.setInlayStructureFilename(inlayStructureFilename);

        try {
            // 处理镶嵌底座文件
            File inlayFile = null;
            if (inlayStructureFile != null && !inlayStructureFile.isEmpty()) {
                // 直接上传了镶嵌底座文件
                String inlayFilename = inlayStructureFile.getOriginalFilename();
                Path inlayPath = Paths.get(uploadDir, taskId, inlayFilename);
                Files.createDirectories(inlayPath.getParent());
                inlayStructureFile.transferTo(inlayPath.toFile());
                inlayFile = inlayPath.toFile();
                task.setInlayStructureFilename(inlayFilename);
            }

            // 调用AI服务
            JsonNode aiResponse = aiServiceClient.callConditionGenerate(
                    task.getInputImagePath().toFile(),
                    inlayFile,
                    inlayStructureFilename
            );

            // 解析AI服务响应
            handleAiResponse(task, aiResponse);
        } catch (BusinessException e) {
            task.setStatus("failed");
            task.setErrorMessage(e.getMessage());
            task.setUpdatedAt(LocalDateTime.now());
            taskStore.put(taskId, task);
            throw e;
        } catch (Exception e) {
            task.setStatus("failed");
            task.setErrorMessage("条件生成失败: " + e.getMessage());
            task.setUpdatedAt(LocalDateTime.now());
            taskStore.put(taskId, task);
            throw new BusinessException("条件生成失败: " + e.getMessage(), e);
        }

        return buildResponse(task);
    }

    /**
     * 获取所有任务列表
     *
     * @return 任务列表
     */
    public List<GenerateTask> getAllTasks() {
        List<GenerateTask> tasks = new ArrayList<>(taskStore.values());
        // 按创建时间倒序排列
        tasks.sort((a, b) -> {
            if (a.getCreatedAt() == null && b.getCreatedAt() == null) return 0;
            if (a.getCreatedAt() == null) return 1;
            if (b.getCreatedAt() == null) return -1;
            return b.getCreatedAt().compareTo(a.getCreatedAt());
        });
        return tasks;
    }

    /**
     * 获取任务详情
     *
     * @param taskId 任务ID
     * @return 任务实体
     */
    public GenerateTask getTask(String taskId) {
        GenerateTask task = taskStore.get(taskId);
        if (task == null) {
            throw new BusinessException(404, "任务不存在: " + taskId);
        }

        // 如果任务正在处理中，尝试从AI服务获取最新状态
        if ("processing".equals(task.getStatus()) || "pending".equals(task.getStatus())) {
            try {
                JsonNode aiStatus = aiServiceClient.getTaskStatus(taskId);
                if (aiStatus != null && aiStatus.has("status")) {
                    String newStatus = aiStatus.get("status").asText();
                    if (!task.getStatus().equals(newStatus)) {
                        task.setStatus(newStatus);
                        task.setUpdatedAt(LocalDateTime.now());
                        if ("completed".equals(newStatus) || "failed".equals(newStatus)) {
                            task.setCompletedAt(LocalDateTime.now());
                        }
                        taskStore.put(taskId, task);
                    }
                }
            } catch (Exception e) {
                log.warn("获取任务最新状态失败: {}", taskId, e);
            }
        }

        return task;
    }

    /**
     * 获取任务输出文件路径
     *
     * @param taskId 任务ID
     * @return 输出文件路径
     */
    public Path getOutputFile(String taskId) {
        GenerateTask task = getTask(taskId);

        if (!"completed".equals(task.getStatus())) {
            throw new BusinessException("任务尚未完成，当前状态: " + task.getStatus());
        }

        if (task.getOutputPath() == null) {
            throw new BusinessException("任务输出文件不存在");
        }

        Path outputPath = Paths.get(task.getOutputPath());
        if (!Files.exists(outputPath)) {
            throw new BusinessException(404, "输出文件不存在: " + task.getOutputFilename());
        }

        return outputPath;
    }

    /**
     * 删除任务
     *
     * @param taskId 任务ID
     */
    public void deleteTask(String taskId) {
        GenerateTask task = taskStore.remove(taskId);
        if (task == null) {
            throw new BusinessException(404, "任务不存在: " + taskId);
        }

        // 清理关联文件
        try {
            // 删除上传文件
            if (task.getInputImagePath() != null) {
                Path inputDir = Paths.get(task.getInputImagePath()).getParent();
                if (inputDir != null) {
                    deleteDirectory(inputDir);
                }
            }
            // 删除输出文件
            if (task.getOutputPath() != null) {
                Path outputDir = Paths.get(task.getOutputPath()).getParent();
                if (outputDir != null) {
                    deleteDirectory(outputDir);
                }
            }
            log.info("任务已删除: {}", taskId);
        } catch (IOException e) {
            log.warn("清理任务文件失败: {}", taskId, e);
        }
    }

    /**
     * 创建生成任务
     */
    private GenerateTask createTask(String taskId, String taskType, MultipartFile imageFile) {
        GenerateTask task = new GenerateTask();
        task.setTaskId(taskId);
        task.setTaskType(taskType);
        task.setStatus("pending");
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());

        // 保存上传的设计图
        try {
            String originalFilename = imageFile.getOriginalFilename();
            Path uploadPath = Paths.get(uploadDir, taskId, originalFilename);
            Files.createDirectories(uploadPath.getParent());
            imageFile.transferTo(uploadPath.toFile());

            task.setInputImageFilename(originalFilename);
            task.setInputImagePath(uploadPath);
            log.info("设计图已保存: {}", uploadPath);
        } catch (IOException e) {
            throw new BusinessException("保存上传文件失败: " + e.getMessage(), e);
        }

        taskStore.put(taskId, task);
        return task;
    }

    /**
     * 处理AI服务响应
     */
    private void handleAiResponse(GenerateTask task, JsonNode aiResponse) {
        if (aiResponse.has("task_id")) {
            // AI服务返回了任务ID，表示异步处理
            task.setStatus(aiResponse.has("status") ? aiResponse.get("status").asText() : "processing");
            task.setUpdatedAt(LocalDateTime.now());
        } else if (aiResponse.has("status") && "completed".equals(aiResponse.get("status").asText())) {
            // 同步完成
            task.setStatus("completed");
            task.setCompletedAt(LocalDateTime.now());
            task.setUpdatedAt(LocalDateTime.now());

            if (aiResponse.has("output_path")) {
                task.setOutputPath(aiResponse.get("output_path").asText());
            }
            if (aiResponse.has("output_filename")) {
                task.setOutputFilename(aiResponse.get("output_filename").asText());
            }
            if (aiResponse.has("preview_path")) {
                task.setPreviewPath(aiResponse.get("preview_path").asText());
            }
        } else if (aiResponse.has("error")) {
            task.setStatus("failed");
            task.setErrorMessage(aiResponse.get("error").asText());
            task.setCompletedAt(LocalDateTime.now());
            task.setUpdatedAt(LocalDateTime.now());
        } else {
            task.setStatus("processing");
            task.setUpdatedAt(LocalDateTime.now());
        }

        taskStore.put(task.getTaskId(), task);
    }

    /**
     * 构建生成响应DTO
     */
    private GenerateResponse buildResponse(GenerateTask task) {
        GenerateResponse response = new GenerateResponse();
        response.setTaskId(task.getTaskId());
        response.setStatus(task.getStatus());

        switch (task.getStatus()) {
            case "pending":
                response.setMessage("任务已提交，等待处理");
                break;
            case "processing":
                response.setMessage("任务正在处理中");
                break;
            case "completed":
                response.setMessage("生成完成");
                response.setDownloadUrl("/api/generate/download/" + task.getTaskId());
                if (task.getPreviewPath() != null) {
                    response.setPreviewUrl("/api/generate/preview/" + task.getTaskId());
                }
                break;
            case "failed":
                response.setMessage("生成失败: " + task.getErrorMessage());
                break;
            default:
                response.setMessage("未知状态");
        }

        return response;
    }

    /**
     * 递归删除目录
     */
    private void deleteDirectory(Path path) throws IOException {
        if (Files.exists(path)) {
            Files.walk(path)
                    .sorted(Comparator.reverseOrder())
                    .forEach(p -> {
                        try {
                            Files.delete(p);
                        } catch (IOException e) {
                            log.warn("删除文件失败: {}", p);
                        }
                    });
        }
    }
}
