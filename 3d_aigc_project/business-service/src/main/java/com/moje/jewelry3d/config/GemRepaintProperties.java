package com.moje.jewelry3d.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 云端宝石去反光（通义万相等）配置
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "gem.repaint")
public class GemRepaintProperties {

    /** wanx | flatten */
    private String provider = "wanx";

    private String primaryModel = "wanx2.1-imageedit";

    private boolean fallbackEnabled = false;

    private int timeoutSeconds = 90;

    private double defaultStrength = 0.20;

    private int defaultMaskDilatePx = 8;

    private String defaultPrompt =
            "修改戒指主石宝石的表面光影：将镜面反光和过曝高光改为柔和自然的哑光漫反射"
                    + "（matte, non-reflective, diffuse gem surface, jewelry product photo style）；"
                    + "禁止生成镜面高光、玻璃质感、强烈镜面反射"
                    + "（no mirror highlights, no glass reflection, no specular shine）；"
                    + "宝石必须完整保留在原位置，保持原有形状、体积、颜色、透明度和切面结构；"
                    + "严禁删除、擦除、镂空或移除宝石；金属爪镶、戒圈与背景完全不变。";

    /** 蒙版局部重绘专用 prompt（编辑区=宝石） */
    private String defaultMaskPrompt =
            "在蒙版区域内，将宝石表面镜面反光和过曝高光改为柔和自然的哑光漫反射"
                    + "（matte, non-reflective, diffuse gem surface, jewelry product photo style）；"
                    + "禁止生成镜面高光、玻璃质感、强烈镜面反射"
                    + "（no mirror highlights, no glass reflection, no specular shine）；"
                    + "保持宝石原有颜色、透明度、切面结构与形状，不要生成空白或镂空。";

    private DashScope dashscope = new DashScope();

    @Getter
    @Setter
    public static class DashScope {
        private String apiKey = "";
        private String baseUrl = "https://dashscope.aliyuncs.com/api/v1";
    }
}
