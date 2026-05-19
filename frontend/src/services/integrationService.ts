import api from './api';
import type { IntegrationSettings } from '@/types/integration';

export const integrationService = {
  getSettings: () => api.get<IntegrationSettings>('/integrations/settings'),

  updateSettings: (body: Record<string, unknown>) =>
    api.put<IntegrationSettings>('/integrations/settings', body),

  uploadB2bSupportWecomQr: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ url: string }>('/integrations/b2b-support-wecom-qr', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
