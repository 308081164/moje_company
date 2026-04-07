package com.jewelry.system.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
public class FileStorageService {

    @Value("${app.upload-dir:uploads/jewelry}")
    private String uploadDir;

    /**
     * 保存文件到本地磁盘，文件名由调用方决定（便于与 OSS 对齐）。
     */
    public String saveOrderFile(long orderId, String subDir, String storedFileName, MultipartFile file) throws IOException {
        Path dir = Paths.get(uploadDir, "order", String.valueOf(orderId), subDir);
        Files.createDirectories(dir);
        Path target = dir.resolve(storedFileName);
        file.transferTo(target.toFile());
        return target.toAbsolutePath().toString();
    }
}

