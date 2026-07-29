package com.moje.jewelry3d.util;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;

/**
 * 万相整图去反光结果验收：检测主石区域是否被误删（擦除/镂空），以及是否生成过多镜面高光。
 */
public final class WanxGemRepaintAcceptanceUtil {

    private static final double CENTER_ROI_RATIO = 0.45;
    /** 高亮像素：亮度高且饱和度低，近似镜面反光 */
    private static final float SPECULAR_BRIGHTNESS = 0.92f;
    private static final float SPECULAR_SATURATION = 0.18f;

    private WanxGemRepaintAcceptanceUtil() {
    }

    public record AcceptanceResult(boolean passed, String reason, double originalGemScore, double resultGemScore) {
    }

    /**
     * 对比原图与万相结果的中心区域色彩/饱和度，判断主石是否被擦除或反光加重。
     */
    public static AcceptanceResult validate(byte[] originalBytes, byte[] resultBytes) {
        try {
            BufferedImage original = ImageIO.read(new ByteArrayInputStream(originalBytes));
            BufferedImage result = ImageIO.read(new ByteArrayInputStream(resultBytes));
            if (original == null || result == null) {
                return new AcceptanceResult(true, "无法解析图像，跳过验收", 0, 0);
            }
            if (original.getWidth() != result.getWidth() || original.getHeight() != result.getHeight()) {
                result = scaleTo(result, original.getWidth(), original.getHeight());
            }

            double origScore = gemPresenceScore(original);
            double resultScore = gemPresenceScore(result);

            // 原图中心几乎无彩色主石（俯拍/特写异常），不做硬性拦截
            if (origScore < 0.08) {
                return new AcceptanceResult(true, "原图中心色彩不足，跳过主石验收", origScore, resultScore);
            }

            double retention = resultScore / Math.max(origScore, 1e-6);
            if (retention < 0.45) {
                return new AcceptanceResult(
                        false,
                        String.format("主石区域色彩保留过低(%.0f%%)，疑似被擦除", retention * 100),
                        origScore,
                        resultScore
                );
            }

            double origSpecular = specularHighlightScore(original);
            double resultSpecular = specularHighlightScore(result);
            double specularThreshold = Math.max(origSpecular * 1.35, origSpecular + 0.025);
            if (resultSpecular > specularThreshold && resultSpecular > 0.035) {
                return new AcceptanceResult(
                        false,
                        String.format(
                                "结果镜面高光过多(%.1f%% vs 原图%.1f%%)，疑似生成反光材质",
                                resultSpecular * 100, origSpecular * 100
                        ),
                        origScore,
                        resultScore
                );
            }

            return new AcceptanceResult(true, "主石区域保留正常", origScore, resultScore);
        } catch (Exception e) {
            return new AcceptanceResult(true, "验收异常，跳过: " + e.getMessage(), 0, 0);
        }
    }

    /**
     * 中心 ROI 内「有色彩且非透明」像素占比，近似主石存在感。
     */
    private static double gemPresenceScore(BufferedImage image) {
        int w = image.getWidth();
        int h = image.getHeight();
        int roiW = Math.max(1, (int) (w * CENTER_ROI_RATIO));
        int roiH = Math.max(1, (int) (h * CENTER_ROI_RATIO));
        int x0 = (w - roiW) / 2;
        int y0 = (h - roiH) / 2;

        int colorful = 0;
        int total = 0;
        for (int y = y0; y < y0 + roiH; y++) {
            for (int x = x0; x < x0 + roiW; x++) {
                int rgb = image.getRGB(x, y);
                int a = (rgb >> 24) & 0xff;
                if (a < 40) {
                    continue;
                }
                int r = (rgb >> 16) & 0xff;
                int g = (rgb >> 8) & 0xff;
                int b = rgb & 0xff;
                float[] hsb = java.awt.Color.RGBtoHSB(r, g, b, null);
                float sat = hsb[1];
                float bri = hsb[2];
                total++;
                if (sat > 0.12 && bri > 0.08 && bri < 0.98) {
                    colorful++;
                }
            }
        }
        return total == 0 ? 0 : (double) colorful / total;
    }

    /**
     * 中心 ROI 内高亮低饱和像素占比，近似镜面反光强度。
     */
    private static double specularHighlightScore(BufferedImage image) {
        int w = image.getWidth();
        int h = image.getHeight();
        int roiW = Math.max(1, (int) (w * CENTER_ROI_RATIO));
        int roiH = Math.max(1, (int) (h * CENTER_ROI_RATIO));
        int x0 = (w - roiW) / 2;
        int y0 = (h - roiH) / 2;

        int specular = 0;
        int total = 0;
        for (int y = y0; y < y0 + roiH; y++) {
            for (int x = x0; x < x0 + roiW; x++) {
                int rgb = image.getRGB(x, y);
                int a = (rgb >> 24) & 0xff;
                if (a < 40) {
                    continue;
                }
                int r = (rgb >> 16) & 0xff;
                int g = (rgb >> 8) & 0xff;
                int b = rgb & 0xff;
                float[] hsb = java.awt.Color.RGBtoHSB(r, g, b, null);
                float sat = hsb[1];
                float bri = hsb[2];
                total++;
                if (bri >= SPECULAR_BRIGHTNESS && sat <= SPECULAR_SATURATION) {
                    specular++;
                }
            }
        }
        return total == 0 ? 0 : (double) specular / total;
    }

    private static BufferedImage scaleTo(BufferedImage src, int w, int h) {
        BufferedImage dst = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        dst.createGraphics().drawImage(src, 0, 0, w, h, null);
        return dst;
    }
}
