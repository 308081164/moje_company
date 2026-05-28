package com.jewelry.system.util;

import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/** 栅格图上传辅助：识别 BMP，存储/AI 分析前转换为 PNG。 */
public final class ImageUploadSupport {

    private static final Set<String> BMP_MIME_TYPES = Set.of("image/bmp", "image/x-ms-bmp");
    private static final Pattern BMP_EXT = Pattern.compile("\\.bmp$", Pattern.CASE_INSENSITIVE);

    private ImageUploadSupport() {
    }

    public record NormalizedUpload(MultipartFile file, boolean convertedFromBmp) {
    }

    public static boolean isBmp(MultipartFile file) {
        if (file == null) {
            return false;
        }
        String mime = normalizeMime(file.getContentType());
        if (mime != null && BMP_MIME_TYPES.contains(mime)) {
            return true;
        }
        return isBmpFileName(file.getOriginalFilename());
    }

    public static boolean isBmpFileName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return false;
        }
        return BMP_EXT.matcher(fileName.strip()).find();
    }

    public static String resolveImageMimeType(MultipartFile file) {
        String mime = normalizeMime(file != null ? file.getContentType() : null);
        if (mime != null && mime.startsWith("image/")) {
            return mime;
        }
        String name = file != null ? file.getOriginalFilename() : null;
        if (name != null) {
            String lower = name.toLowerCase(Locale.ROOT);
            if (lower.endsWith(".bmp")) {
                return "image/bmp";
            }
            if (lower.endsWith(".png")) {
                return "image/png";
            }
            if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
                return "image/jpeg";
            }
            if (lower.endsWith(".gif")) {
                return "image/gif";
            }
            if (lower.endsWith(".webp")) {
                return "image/webp";
            }
        }
        return "image/jpeg";
    }

    public static NormalizedUpload normalizeRasterUpload(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty() || !isBmp(file)) {
            return new NormalizedUpload(file, false);
        }
        BufferedImage image;
        try (InputStream in = file.getInputStream()) {
            image = ImageIO.read(in);
        }
        if (image == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "无法读取 BMP 图片，请确认文件未损坏");
        }
        ByteArrayOutputStream pngOut = new ByteArrayOutputStream();
        if (!ImageIO.write(image, "png", pngOut)) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "BMP 转 PNG 失败");
        }
        String pngName = replaceExtension(file.getOriginalFilename(), ".png");
        MultipartFile converted = new BytesMultipartFile(
                file.getName(),
                pngName,
                "image/png",
                pngOut.toByteArray());
        return new NormalizedUpload(converted, true);
    }

    public static String replaceBmpExtensionInKey(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return objectKey;
        }
        return BMP_EXT.matcher(objectKey).replaceAll(".png");
    }

    public static String replaceExtension(String fileName, String newExt) {
        String base = fileName != null && !fileName.isBlank() ? fileName.strip() : "image";
        int dot = base.lastIndexOf('.');
        if (dot > 0) {
            base = base.substring(0, dot);
        }
        String ext = newExt.startsWith(".") ? newExt : "." + newExt;
        return base + ext;
    }

    private static String normalizeMime(String mime) {
        if (mime == null || mime.isBlank() || "application/octet-stream".equalsIgnoreCase(mime.strip())) {
            return null;
        }
        return mime.strip().toLowerCase(Locale.ROOT);
    }
}
