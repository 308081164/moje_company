package com.moje.jewelry3d.util;

import com.moje.jewelry3d.common.BusinessException;

import javax.imageio.ImageIO;
import java.awt.AlphaComposite;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Path;

/**
 * 宝石蒙版 PNG（白=编辑区）的覆盖率与预览叠加图。
 */
public final class GemMaskArtifactUtil {

    private GemMaskArtifactUtil() {
    }

    public static double computeWhiteCoverage(Path maskPath) throws IOException {
        BufferedImage mask = ImageIO.read(maskPath.toFile());
        if (mask == null) {
            return 0;
        }
        int w = mask.getWidth();
        int h = mask.getHeight();
        int white = 0;
        int total = w * h;
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int rgb = mask.getRGB(x, y);
                int r = (rgb >> 16) & 0xff;
                int g = (rgb >> 8) & 0xff;
                int b = rgb & 0xff;
                if (r > 200 && g > 200 && b > 200) {
                    white++;
                }
            }
        }
        return total == 0 ? 0 : (double) white / total;
    }

    public static void writeOverlayPreview(Path basePath, Path maskPath, Path overlayPath) throws IOException {
        BufferedImage base = ImageIO.read(basePath.toFile());
        BufferedImage mask = ImageIO.read(maskPath.toFile());
        if (base == null || mask == null) {
            throw new BusinessException("无法读取图像或蒙版以生成预览");
        }
        if (base.getWidth() != mask.getWidth() || base.getHeight() != mask.getHeight()) {
            mask = WanxImageDimensionUtil.resizeMaskToDimensions(
                    ImageIO.read(maskPath.toFile()), base.getWidth(), base.getHeight()
            );
        }

        BufferedImage overlay = new BufferedImage(base.getWidth(), base.getHeight(), BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = overlay.createGraphics();
        g.drawImage(base, 0, 0, null);
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.42f));
        g.setColor(new java.awt.Color(103, 194, 58));
        for (int y = 0; y < base.getHeight(); y++) {
            for (int x = 0; x < base.getWidth(); x++) {
                int rgb = mask.getRGB(x, y);
                int r = (rgb >> 16) & 0xff;
                if (r > 128) {
                    g.fillRect(x, y, 1, 1);
                }
            }
        }
        g.dispose();
        ImageIO.write(overlay, "png", overlayPath.toFile());
    }
}
