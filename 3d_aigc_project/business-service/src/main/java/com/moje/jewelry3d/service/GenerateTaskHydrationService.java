package com.moje.jewelry3d.service;

import com.moje.jewelry3d.config.FileStorageConfig;
import com.moje.jewelry3d.entity.GenerateTaskAssetEntity;
import com.moje.jewelry3d.entity.GenerateTaskEntity;
import com.moje.jewelry3d.repository.GenerateTaskAssetRepository;
import com.moje.jewelry3d.repository.GenerateTaskRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * 启动时将磁盘上已有任务目录回填至数据库，避免升级后历史任务不可见
 */
@Slf4j
@Component
@Order(100)
public class GenerateTaskHydrationService implements ApplicationRunner {

    private final GenerateTaskRepository taskRepository;
    private final GenerateTaskAssetRepository assetRepository;
    private final GenerateStorageService storageService;
    private final FileStorageConfig fileStorageConfig;

    public GenerateTaskHydrationService(
            GenerateTaskRepository taskRepository,
            GenerateTaskAssetRepository assetRepository,
            GenerateStorageService storageService,
            FileStorageConfig fileStorageConfig
    ) {
        this.taskRepository = taskRepository;
        this.assetRepository = assetRepository;
        this.storageService = storageService;
        this.fileStorageConfig = fileStorageConfig;
    }

    @Override
    public void run(ApplicationArguments args) {
        hydrateFromDisk();
    }

    private void hydrateFromDisk() {
        Path uploadsRoot = fileStorageConfig.getUploadPath();
        Path outputsRoot = fileStorageConfig.getOutputPath();
        if (!Files.isDirectory(uploadsRoot) && !Files.isDirectory(outputsRoot)) {
            return;
        }

        int hydrated = 0;
        try (Stream<Path> uploadDirs = Files.isDirectory(uploadsRoot) ? Files.list(uploadsRoot) : Stream.empty()) {
            for (Path taskDir : uploadDirs.filter(Files::isDirectory).toList()) {
                String taskId = taskDir.getFileName().toString();
                if (!isUuid(taskId) || taskRepository.existsById(taskId)) {
                    continue;
                }
                if (hydrateTask(taskId, taskDir, outputsRoot)) {
                    hydrated++;
                }
            }
        } catch (Exception e) {
            log.warn("任务磁盘回填失败: {}", e.getMessage());
        }

        try (Stream<Path> outputDirs = Files.isDirectory(outputsRoot) ? Files.list(outputsRoot) : Stream.empty()) {
            for (Path taskDir : outputDirs.filter(Files::isDirectory).toList()) {
                String taskId = taskDir.getFileName().toString();
                if (!isUuid(taskId) || taskRepository.existsById(taskId)) {
                    continue;
                }
                if (hydrateTask(taskId, uploadsRoot.resolve(taskId), outputsRoot)) {
                    hydrated++;
                }
            }
        } catch (Exception e) {
            log.warn("输出目录任务回填失败: {}", e.getMessage());
        }

        if (hydrated > 0) {
            log.info("已从磁盘回填 {} 条历史生成任务", hydrated);
        }
    }

    private boolean hydrateTask(String taskId, Path uploadDir, Path outputsRoot) {
        Path outputDir = outputsRoot.resolve(taskId);
        Optional<Path> outputFile = findFirstMesh(outputDir);
        String status = outputFile.isPresent() ? "completed" : "processing";

        GenerateTaskEntity task = new GenerateTaskEntity();
        task.setTaskId(taskId);
        task.setTaskType("image-to-3d");
        task.setStatus(status);
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());
        if ("completed".equals(status)) {
            task.setCompletedAt(LocalDateTime.now());
            task.setOutputFilename(outputFile.get().getFileName().toString());
        }
        task.setParamsJson("{}");

        if (Files.isDirectory(uploadDir)) {
            findInputFile(uploadDir).ifPresent(input -> {
                task.setInputImageFilename(input.getFileName().toString());
                registerAsset(taskId, "input", storageService.inputBucket(), taskId + "/" + input.getFileName(), input);
            });
        }

        outputFile.ifPresent(output -> registerAsset(
                taskId, "output", storageService.outputBucket(),
                taskId + "/" + output.getFileName(), output
        ));

        taskRepository.save(task);
        return true;
    }

    private void registerAsset(String taskId, String assetType, String bucket, String key, Path localPath) {
        if (!Files.isRegularFile(localPath)) {
            return;
        }
        try {
            if (!storageService.exists(bucket, key)) {
                storageService.putFile(bucket, key, localPath, "application/octet-stream");
            }
            GenerateTaskAssetEntity asset = new GenerateTaskAssetEntity();
            asset.setId(UUID.randomUUID().toString());
            asset.setTaskId(taskId);
            asset.setAssetType(assetType);
            asset.setStorageBucket(bucket);
            asset.setStorageKey(key);
            asset.setSizeBytes(Files.size(localPath));
            asset.setCreatedAt(LocalDateTime.now());
            assetRepository.save(asset);
        } catch (Exception e) {
            log.debug("回填资产失败 {}: {}", key, e.getMessage());
        }
    }

    private Optional<Path> findInputFile(Path uploadDir) {
        try (var stream = Files.list(uploadDir)) {
            return stream.filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().startsWith("input."))
                    .findFirst();
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private Optional<Path> findFirstMesh(Path outputDir) {
        if (!Files.isDirectory(outputDir)) {
            return Optional.empty();
        }
        try (var stream = Files.list(outputDir)) {
            return stream.filter(Files::isRegularFile)
                    .filter(p -> {
                        String name = p.getFileName().toString().toLowerCase();
                        return name.endsWith(".glb") || name.endsWith(".obj");
                    })
                    .findFirst();
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private static boolean isUuid(String value) {
        try {
            UUID.fromString(value);
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
