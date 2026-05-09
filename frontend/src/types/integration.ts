/** 与后端 IntegrationSettingsViewDto 对齐 */
export interface IntegrationSettings {
  dashscopeEnabled: boolean;
  dashscopeApiKeyConfigured: boolean;
  dashscopeImageModel: string;
  wecomEnabled: boolean;
  wecomCustomerSecretConfigured: boolean;
  wecomCorpId: string;
  wecomTemplateChatIds: string;
}
