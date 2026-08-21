package com.jewelry.system.dto.portal;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class PortalHomeCPublicDto {
    private String contactPhone;
    private String contactEmail;
    private String address;
    private String businessHours;
    /** 首页区块（hero/services/works/process/craft/cta 等，多语言文案） */
    private List<HomeBlockDto> blocks;
}
