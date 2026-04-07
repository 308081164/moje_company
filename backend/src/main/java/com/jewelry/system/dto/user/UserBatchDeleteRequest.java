package com.jewelry.system.dto.user;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class UserBatchDeleteRequest {

    @NotEmpty
    private List<Long> userIds;
}
