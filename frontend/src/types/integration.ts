/** 与后端 IntegrationSettingsViewDto 对齐（API 配置，仅保留大模型接入字段） */
export interface IntegrationSettings {
  llmProvider?: 'kimi' | 'dashscope' | string;
  dashscopeEnabled: boolean;
  dashscopeApiKeyConfigured: boolean;
  dashscopeImageModel: string;
  dashscopeChatModel?: string;
  kimiApiKeyConfigured?: boolean;
  kimiBaseUrl?: string;
  kimiChatModel?: string;
  kimiImageModel?: string;
}
