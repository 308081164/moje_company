package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/** C 端设计稿/建模稿详情弹窗：结构化规格说明 */
@Data
@Builder
public class CustomerSubmitSpecDto {
    private List<CustomerSubmitSpecItemDto> items;
    /** 字印参考图（与设计稿图分开展示） */
    private List<String> engravingImages;
}
