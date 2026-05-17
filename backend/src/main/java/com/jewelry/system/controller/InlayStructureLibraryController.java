package com.jewelry.system.controller;

import com.jewelry.system.dto.inlay.*;
import com.jewelry.system.service.InlayStructureLibraryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/inlay-structures")
@RequiredArgsConstructor
@Tag(name = "镶嵌结构库", description = "OSS 镶嵌结构文件夹管理")
public class InlayStructureLibraryController {

    private final InlayStructureLibraryService libraryService;

    @GetMapping
    @Operation(summary = "列出目录内容")
    public ResponseEntity<InlayStructureListDto> list(@RequestParam(required = false, defaultValue = "") String path) {
        return ResponseEntity.ok(libraryService.list(path));
    }

    @GetMapping("/delete-quota")
    @Operation(summary = "今日删除配额")
    public ResponseEntity<InlayStructureDeleteQuotaDto> deleteQuota() {
        return ResponseEntity.ok(libraryService.deleteQuota());
    }

    @PostMapping("/directories")
    @Operation(summary = "新建文件夹")
    public ResponseEntity<InlayStructureEntryDto> createDirectory(@RequestBody InlayStructurePathRequest body) throws IOException {
        return ResponseEntity.ok(libraryService.createDirectory(body));
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传文件到指定目录")
    public ResponseEntity<InlayStructureEntryDto> upload(
            @RequestParam(required = false, defaultValue = "") String parentPath,
            @RequestPart("file") MultipartFile file
    ) throws IOException {
        return ResponseEntity.ok(libraryService.upload(parentPath, file));
    }

    @PutMapping("/rename")
    @Operation(summary = "重命名文件或文件夹")
    public ResponseEntity<InlayStructureEntryDto> rename(@RequestBody InlayStructureRenameRequest body) throws IOException {
        return ResponseEntity.ok(libraryService.rename(body));
    }

    @PostMapping("/move")
    @Operation(summary = "移动文件或文件夹")
    public ResponseEntity<InlayStructureEntryDto> move(@RequestBody InlayStructureMoveRequest body) throws IOException {
        return ResponseEntity.ok(libraryService.move(body));
    }

    @DeleteMapping
    @Operation(summary = "删除文件或文件夹")
    public ResponseEntity<Void> delete(@RequestBody InlayStructureDeleteRequest body) {
        libraryService.delete(body);
        return ResponseEntity.noContent().build();
    }
}
