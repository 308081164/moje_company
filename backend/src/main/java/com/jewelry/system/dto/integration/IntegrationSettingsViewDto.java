package com.jewelry.system.dto.integration;

import lombok.Builder;
import lombok.Data;

/** 管理员「销售助手」集成配置（不含密钥明文） */
@Data
@Builder
public class IntegrationSettingsViewDto {

    private boolean dashscopeEnabled;
    private boolean dashscopeApiKeyConfigured;
    private String dashscopeImageModel;

    private boolean wecomEnabled;
    private boolean wecomCustomerSecretConfigured;
    private String wecomCorpId;
    /** 种子客户群 chat_id，逗号或 JSON 数组字符串，供 add_join_way 使用 */
    private String wecomTemplateChatIds;
}
