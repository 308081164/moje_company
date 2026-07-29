package com.moje.jewelry3d.util;

import com.moje.jewelry3d.common.BusinessException;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

/**
 * 通义万相 API 要求宽高均在 512–4096 像素；预处理抠图/裁剪后可能低于下限。
 */
public final class WanxImageDimensionUtil {

    public static final int WANX_MIN_PX = 512;
    public static final int WANX_MAX_PX = 4096;

    private WanxImageDimensionUtil() {
    }

    public record FitResult(
            byte[] apiImageBytes,
            String mimeType,
            int originalWidth,
            int originalHeight,
            int apiWidth,
            int apiHeight,
            boolean scaledForApi
    ) {
    }

    /**
     * 将图像缩放到万相 API 可接受的尺寸范围，保持宽高比。
     */
    public static FitResult fitForWanx(byte[] inputBytes, String mimeType) {
        BufferedImage src = readImage(inputBytes);
        int w = src.getWidth();
        int h = src.getHeight();

        double sMin = Math.max((double) WANX_MIN_PX / w, (double) WANX_MIN_PX / h);
        double sMax = Math.min((double) WANX_MAX_PX / w, (double) WANX_MAX_PX / h);

        if (sMin > sMax + 1e-9) {
            throw new BusinessException(
                    "图像宽高比过大（" + w + "×" + h + "），无法同时满足万相要求的 "
                            + WANX_MIN_PX + "–" + WANX_MAX_PX + " 像素范围，请换一张构图更均衡的图"
            );
        }

        double scale;
        if (sMin <= 1.0 && 1.0 <= sMax) {
            scale = 1.0;
        } else if (sMin > 1.0) {
            scale = sMin;
        } else {
            scale = sMax;
        }

        if (Math.abs(scale - 1.0) < 1e-9) {
            return new FitResult(inputBytes, normalizeMime(mimeType), w, h, w, h, false);
        }

        int apiW = clampDimension((int) Math.round(w * scale));
        int apiH = clampDimension((int) Math.round(h * scale));
        BufferedImage scaled = resize(src, apiW, apiH);
        byte[] apiBytes = writePng(scaled);
        return new FitResult(apiBytes, "image/png", w, h, apiW, apiH, true);
    }

    /**
     * 将蒙版缩放到与万相 API 图相同的尺寸，并二值化为纯黑/纯白。
     */
    public static byte[] resizeMaskToApiSize(byte[] maskBytes, int apiWidth, int apiHeight) {
        BufferedImage mask = readImage(maskBytes);
        BufferedImage scaled = resizeMaskToDimensions(mask, apiWidth, apiHeight);
        return writePng(scaled);
    }

    public static BufferedImage resizeMaskToDimensions(BufferedImage mask, int targetW, int targetH) {
        BufferedImage scaled = resize(mask, targetW, targetH);
        BufferedImage binary = new BufferedImage(targetW, targetH, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < targetH; y++) {
            for (int x = 0; x < targetW; x++) {
                int rgb = scaled.getRGB(x, y);
                int r = (rgb >> 16) & 0xff;
                int g = (rgb >> 8) & 0xff;
                int b = rgb & 0xff;
                int v = (r + g + b) / 3 > 128 ? 0xffffff : 0x000000;
                binary.setRGB(x, y, v);
            }
        }
        return binary;
    }

    /**
     * 将万相返回图缩回原始尺寸（仅在提交 API 前做过放大/缩小时调用）。
     */
    public static byte[] resizeToOriginal(byte[] apiResultBytes, int originalWidth, int originalHeight) {
        if (originalWidth <= 0 || originalHeight <= 0) {
            return apiResultBytes;
        }
        BufferedImage src = readImage(apiResultBytes);
        if (src.getWidth() == originalWidth && src.getHeight() == originalHeight) {
            return apiResultBytes;
        }
        BufferedImage resized = resize(src, originalWidth, originalHeight);
        return writePng(resized);
    }

    private static BufferedImage readImage(byte[] bytes) {
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
            if (image == null) {
                throw new BusinessException("无法读取图像，请确认文件格式为 PNG/JPEG/WebP");
            }
            return image;
        } catch (IOException e) {
            throw new BusinessException("读取图像失败: " + e.getMessage(), e);
        }
    }

    private static BufferedImage resize(BufferedImage src, int targetW, int targetH) {
        int type = src.getColorModel().hasAlpha()
                ? BufferedImage.TYPE_INT_ARGB
                : BufferedImage.TYPE_INT_RGB;
        BufferedImage dst = new BufferedImage(targetW, targetH, type);
        Graphics2D g = dst.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.drawImage(src, 0, 0, targetW, targetH, null);
        g.dispose();
        return dst;
    }

    private static byte[] writePng(BufferedImage image) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            if (!ImageIO.write(image, "png", out)) {
                throw new BusinessException("图像编码为 PNG 失败");
            }
            return out.toByteArray();
        } catch (IOException e) {
            throw new BusinessException("图像编码失败: " + e.getMessage(), e);
        }
    }

    private static int clampDimension(int value) {
        return Math.max(WANX_MIN_PX, Math.min(WANX_MAX_PX, value));
    }

    private static String normalizeMime(String mimeType) {
        if (mimeType == null || mimeType.isBlank()) {
            return "image/png";
        }
        return mimeType;
    }
}
