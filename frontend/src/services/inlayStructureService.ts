import api from './api';

export interface InlayStructureEntry {
  path: string;
  name: string;
  directory: boolean;
  size?: number;
  lastModified?: string;
  url?: string;
}

export interface InlayStructureList {
  currentPath: string;
  entries: InlayStructureEntry[];
}

export interface InlayStructureDeleteQuota {
  dailyLimit: number;
  usedToday: number;
  remainingFree: number;
  requiresSecondaryPassword: boolean;
}

export const inlayStructureService = {
  async list(path = ''): Promise<InlayStructureList> {
    return api.get('/inlay-structures', { params: { path } });
  },

  async deleteQuota(): Promise<InlayStructureDeleteQuota> {
    return api.get('/inlay-structures/delete-quota');
  },

  async createDirectory(parentPath: string, name: string): Promise<InlayStructureEntry> {
    return api.post('/inlay-structures/directories', { parentPath, name });
  },

  async upload(parentPath: string, file: File): Promise<InlayStructureEntry> {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/inlay-structures/upload', fd, {
      params: { parentPath },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  async rename(path: string, newName: string): Promise<InlayStructureEntry> {
    return api.put('/inlay-structures/rename', { path, newName });
  },

  async move(fromPath: string, toDirectoryPath: string): Promise<InlayStructureEntry> {
    return api.post('/inlay-structures/move', { fromPath, toDirectoryPath });
  },

  async remove(path: string, secondaryPassword?: string): Promise<void> {
    await api.delete('/inlay-structures', { data: { path, secondaryPassword } });
  },

  async verifySecondaryPassword(secondaryPassword: string): Promise<void> {
    await api.post('/auth/verify-secondary-password', { secondaryPassword });
  },
};
