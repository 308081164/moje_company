package com.jewelry.system.dto.inlay;

import lombok.Data;

@Data
public class InlayStructureDeleteQuotaDto {
    private int dailyLimit;
    private int usedToday;
    private int remainingFree;
    private boolean requiresSecondaryPassword;
}
