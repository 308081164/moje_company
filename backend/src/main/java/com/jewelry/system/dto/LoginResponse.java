package com.jewelry.system.dto;

import com.jewelry.system.enums.UserRole;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Schema(description = "登录响应")
public class LoginResponse {
    
    @Schema(description = "访问令牌", example = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
    private String accessToken;
    
    @Schema(description = "刷新令牌", example = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
    private String refreshToken;
    
    @Schema(description = "令牌类型", example = "Bearer")
    private String tokenType = "Bearer";
    
    @Schema(description = "过期时间（秒）", example = "86400")
    private Long expiresIn;
    
    @Schema(description = "用户ID", example = "1")
    private Long userId;
    
    @Schema(description = "用户名", example = "kuangjun")
    private String username;
    
    @Schema(description = "真实姓名", example = "系统管理员")
    private String realName;
    
    @Schema(description = "用户角色")
    private UserRole role;
    
    @Schema(description = "角色描述", example = "管理员")
    private String roleDescription;
    
    @Schema(description = "登录时间")
    private LocalDateTime loginTime;
    
    @Schema(description = "权限列表")
    private String[] permissions;
}