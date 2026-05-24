package com.moje.jewelry3d.controller;

import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.common.Result;
import com.moje.jewelry3d.model.dto.GenerateResponse;
import com.moje.jewelry3d.model.entity.GenerateTask;
import com.moje.jewelry3d.service.GenerateService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;

/**
 * 3D生成控制器
 * 提供图片转3D、条件生成、任务管理等REST API
 * 服务端口: 8854
 */
@Slf4j
@RestController
@RequestMapping("/api/generate")
public class GenerateController {

    private final GenerateService generateService;

    @Autowired
    public GenerateController(GenerateService generateService) {
        this.generateService = generateService;
    }

    /**
     * 图片转3D生成
     * 上传设计图，调用AI服务生成3D模型
     *
     * @param image 设计图文件
     * @return 生成任务响应
     */
    @PostMapping("/image-to-3d")
    public Result<GenerateResponse> imageTo3d(
            @RequestParam("image") MultipartFile image) {

        if (image.isEmpty()) {
            throw new BusinessException("请上传设计图文件");
        }

        log.info("收到图片转3D请求，文件名: {}, 大小: {} bytes",
                image.getOriginalFilename(), image.getSize());

        GenerateResponse response = generateService.imageTo3d(image);
        return Result.success("生成任务已提交", response);
    }

    /**
     * 条件生成
     * 上传设计图并选择镶嵌底座，进行条件生成
     *
     * @param image                  设计图文件
     * @param inlayStructureFilename 镶嵌底座文件名（从数据库中选择）
     * @param inlayStructureFile     镶嵌底座文件（直接上传，可选）
     * @return 生成任务响应
     */
    @PostMapping("/condition-generate")
    public Result<GenerateResponse> conditionGenerate(
            @RequestParam("image") MultipartFile image,
            @RequestParam(value = "inlay_structure_filename", required = false) String inlayStructureFilename,
            @RequestParam(value = "inlay_structure_file", required = false) MultipartFile inlayStructureFile) {

        if (image.isEmpty()) {
            throw new BusinessException("请上传设计图文件");
        }

        if ((inlayStructureFilename == null || inlayStructureFilename.isEmpty())
                && (inlayStructureFile == null || inlayStructureFile.isEmpty())) {
            throw new BusinessException("请选择或上传镶嵌底座");
        }

        log.info("收到条件生成请求，设计图: {}, 镶嵌底座: {}",
                image.getOriginalFilename(),
                inlayStructureFilename != null ? inlayStructureFilename : inlayStructureFile.getOriginalFilename());

        GenerateResponse response = generateService.conditionGenerate(image, inlayStructureFilename, inlayStructureFile);
        return Result.success("条件生成任务已提交", response);
    }

    /**
     * 获取任务列表
     *
     * @return 所有生成任务列表
     */
    @GetMapping("/tasks")
    public Result<List<GenerateTask>> getTasks() {
        List<GenerateTask> tasks = generateService.getAllTasks();
        return Result.success(tasks);
    }

    /**
     * 获取任务详情
     *
     * @param taskId 任务ID
     * @return 任务详细信息
     */
    @GetMapping("/tasks/{taskId}")
    public Result<GenerateTask> getTaskDetail(@PathVariable String taskId) {
        GenerateTask task = generateService.getTask(taskId);
        return Result.success(task);
    }

    /**
     * 下载生成结果
     *
     * @param taskId 任务ID
     * @return 生成结果文件
     */
    @GetMapping("/download/{taskId}")
    public ResponseEntity<Resource> downloadResult(@PathVariable String taskId) {
        Path outputPath = generateService.getOutputFile(taskId);
        File file = outputPath.toFile();

        Resource resource = new FileSystemResource(file);
        String encodedFilename = URLEncoder.encode(file.getName(), StandardCharsets.UTF_8)
                .replace("+", "%20");

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename*=UTF-8''" + encodedFilename)
                .body(resource);
    }

    /**
     * 删除任务
     *
     * @param taskId 任务ID
     * @return 操作结果
     */
    @DeleteMapping("/tasks/{taskId}")
    public Result<Void> deleteTask(@PathVariable String taskId) {
        generateService.deleteTask(taskId);
        return Result.success("任务已删除", null);
    }
}
