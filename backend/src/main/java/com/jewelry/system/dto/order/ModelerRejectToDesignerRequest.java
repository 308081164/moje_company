package com.jewelry.system.dto.order;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ModelerRejectToDesignerRequest {

    @NotBlank
    private String message;

    /** 可选：已上传到本订单的附件文件 ID（与 files 表 related_id=订单 id 一致） */
    private List<Long> attachmentFileIds;
}
