package com.moje.jewelry3d.service.cloud;

import com.fasterxml.jackson.databind.JsonNode;
import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.config.GemRepaintProperties;
import com.moje.jewelry3d.util.WanxGemRepaintAcceptanceUtil;
import com.moje.jewelry3d.util.WanxGemRepaintAcceptanceUtil.AcceptanceResult;
import com.moje.jewelry3d.util.WanxImageDimensionUtil;
import com.moje.jewelry3d.util.WanxImageDimensionUtil.FitResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * 云端宝石去反光：万相整图或蒙版局部重绘 + 结果验收与重试。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CloudGemRepaintService {

    private static final int MAX_ATTEMPTS = 3;
    private static final double[] RETRY_STRENGTHS = {1.0, 0.75, 0.55};

    private final DashScopeRepaintClient dashScopeRepaintClient;
    private final GemRepaintProperties properties;

    public RepaintOutcome repaint(Path inputImage, String prompt, double strength) {
        return runRepaint(inputImage, null, prompt, strength, false);
    }

    public RepaintOutcome repaintWithMask(Path inputImage, Path maskImage, String prompt, double strength) {
        return runRepaint(inputImage, maskImage, prompt, strength, true);
    }

    private RepaintOutcome runRepaint(
            Path inputImage,
            Path maskImage,
            String prompt,
            double strength,
            boolean useMask
    ) {
        String basePrompt = resolvePrompt(prompt, useMask);
        double baseStrength = strength > 0 ? strength : properties.getDefaultStrength();

        byte[] inputBytes;
        byte[] maskBytes = null;
        try {
            inputBytes = Files.readAllBytes(inputImage);
            if (useMask) {
                maskBytes = Files.readAllBytes(maskImage);
            }
        } catch (java.io.IOException e) {
            throw new BusinessException("读取待重绘图像失败: " + e.getMessage(), e);
        }

        String mimeType = guessMime(inputImage);
        FitResult fit = WanxImageDimensionUtil.fitForWanx(inputBytes, mimeType);
        if (fit.scaledForApi()) {
            log.info(
                    "万相输入尺寸适配: {}x{} -> {}x{}",
                    fit.originalWidth(), fit.originalHeight(), fit.apiWidth(), fit.apiHeight()
            );
        }

        byte[] apiMask = useMask
                ? WanxImageDimensionUtil.resizeMaskToApiSize(maskBytes, fit.apiWidth(), fit.apiHeight())
                : null;

        BusinessException lastError = null;
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            double attemptStrength = clampStrength(baseStrength * RETRY_STRENGTHS[attempt]);
            String attemptPrompt = buildAttemptPrompt(basePrompt, attempt, useMask);
            log.info(
                    "AI 去反光尝试 {}/{} mode={} strength={}",
                    attempt + 1, MAX_ATTEMPTS, useMask ? "mask" : "full", attemptStrength
            );

            byte[] repainted = useMask
                    ? dashScopeRepaintClient.repaintWithMask(
                            fit.apiImageBytes(), apiMask, fit.mimeType(), attemptPrompt, attemptStrength
                    )
                    : dashScopeRepaintClient.repaintFullImage(
                            fit.apiImageBytes(), fit.mimeType(), attemptPrompt, attemptStrength
                    );

            if (fit.scaledForApi()) {
                repainted = WanxImageDimensionUtil.resizeToOriginal(
                        repainted, fit.originalWidth(), fit.originalHeight()
                );
            }

            AcceptanceResult acceptance = WanxGemRepaintAcceptanceUtil.validate(inputBytes, repainted);
            log.info(
                    "万相结果验收: passed={} reason={} origScore={} resultScore={}",
                    acceptance.passed(), acceptance.reason(),
                    acceptance.originalGemScore(), acceptance.resultGemScore()
            );

            if (acceptance.passed()) {
                String prefix = useMask ? "wanx_mask" : "wanx_full";
                String method = attempt == 0 ? prefix : prefix + "_retry" + attempt;
                return new RepaintOutcome(repainted, method, null);
            }
            boolean hasRetry = attempt + 1 < MAX_ATTEMPTS;
            lastError = new BusinessException(
                    hasRetry
                            ? "万相结果未通过验收（" + acceptance.reason() + "），正在以更低强度重试…"
                            : (useMask
                                    ? "万相蒙版去反光失败：主石区域未保留，请扩大蒙版或降低强度后重试"
                                    : "万相去反光失败：主石被误删，请启用蒙版模式或降低强度后重试")
            );
        }

        throw lastError != null ? lastError : new BusinessException("万相去反光失败");
    }

    private String resolvePrompt(String prompt, boolean useMask) {
        if (prompt != null && !prompt.isBlank()) {
            return prompt.trim();
        }
        if (useMask) {
            return properties.getDefaultMaskPrompt();
        }
        return properties.getDefaultPrompt();
    }

    private static String buildAttemptPrompt(String basePrompt, int attempt, boolean useMask) {
        if (attempt == 0) {
            return basePrompt;
        }
        String reinforce = useMask
                ? "再次强调：仅在蒙版区域内将宝石表面改为哑光非反光漫反射，禁止镜面高光、玻璃质感与强烈镜面反射，"
                        + "保持宝石实体完整、形状与颜色不变。"
                : "再次强调：主石宝石实体必须完整保留在原位，只可将表面改为哑光非反光漫反射，"
                        + "禁止镜面高光、玻璃质感与强烈镜面反射，"
                        + "严禁删除、擦除、镂空、移除或透明化宝石；保持宝石形状体积与颜色不变。";
        return attempt == 1 ? basePrompt + " " + reinforce : reinforce + " " + basePrompt;
    }

    private static double clampStrength(double value) {
        return Math.max(0.08, Math.min(0.45, value));
    }

    public record RepaintOutcome(byte[] imageBytes, String repaintMethod, JsonNode segmentResult) {}

    private static String guessMime(Path path) {
        String name = path.getFileName().toString().toLowerCase();
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        if (name.endsWith(".webp")) {
            return "image/webp";
        }
        return "image/png";
    }
}
