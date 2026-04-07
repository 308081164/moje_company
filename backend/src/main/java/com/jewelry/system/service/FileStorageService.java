package com.jewelry.system.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Service
public class FileStorageService {

    @Value("${app.upload-dir:uploads/jewelry}")
    private String uploadDir;

    public String saveOrderFile(long orderId, String subDir, MultipartFile file) throws IOException {
        String original = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String ext = "";
        int dot = original.lastIndexOf('.');
        if (dot >= 0) {
            ext = original.substring(dot);
        }
        String stored = UUID.randomUUID() + ext;
        Path dir = Paths.get(uploadDir, "order", String.valueOf(orderId), subDir);
        Files.createDirectories(dir);
        Path target = dir.resolve(stored);
        file.transferTo(target.toFile());
        return target.toAbsolutePath().toString();
    }
}
