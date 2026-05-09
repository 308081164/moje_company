import api from './api';
import type { IntegrationSettings } from '@/types/integration';

export const integrationService = {
  getSettings: () => api.get<IntegrationSettings>('/integrations/settings'),

  updateSettings: (body: Record<string, unknown>) =>
    api.put<IntegrationSettings>('/integrations/settings', body),
};
