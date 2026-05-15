import api from './api';

export interface PortalSiteSettingsAdmin {
  heroTitle?: string | null;
  heroSubtitle?: string | null;
  aboutHtml?: string | null;
  businessHours?: string | null;
  contactPhone?: string | null;
  contactWechat?: string | null;
  contactEmail?: string | null;
  address?: string | null;
  carouselFileIds: number[];
  companyPhotoFileIds: number[];
}

export interface PortalJewelryCategory {
  id: number;
  slug: string;
  nameCn: string;
  nameEn?: string | null;
  description?: string | null;
  sortOrder: number;
  enabled: boolean;
}

export interface PortalShowcaseItemAdmin {
  id: number;
  categoryId: number;
  categorySlug: string;
  fileId: number;
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  caption?: string | null;
  sortOrder: number;
}

export const portalAdminService = {
  async getSiteSettings(): Promise<PortalSiteSettingsAdmin> {
    return api.get('/admin/portal/site-settings');
  },

  async updateSiteSettings(body: Partial<PortalSiteSettingsAdmin>): Promise<unknown> {
    return api.put('/admin/portal/site-settings', body);
  },

  async uploadPortalFile(file: File, kind: 'carousel' | 'company'): Promise<{ id: number; fileUrl?: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/admin/portal/uploads?kind=${encodeURIComponent(kind)}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  async listCategories(): Promise<PortalJewelryCategory[]> {
    return api.get('/admin/portal/categories');
  },

  async createCategory(body: Partial<PortalJewelryCategory>): Promise<PortalJewelryCategory> {
    return api.post('/admin/portal/categories', body);
  },

  async updateCategory(id: number, body: Partial<PortalJewelryCategory>): Promise<PortalJewelryCategory> {
    return api.put(`/admin/portal/categories/${id}`, body);
  },

  async deleteCategory(id: number): Promise<void> {
    await api.delete(`/admin/portal/categories/${id}`);
  },

  async listShowcaseCandidates(orderId: number): Promise<any[]> {
    return api.get(`/admin/portal/orders/${orderId}/showcase-candidates`);
  },

  async listShowcaseItems(categoryId: number): Promise<PortalShowcaseItemAdmin[]> {
    return api.get(`/admin/portal/categories/${categoryId}/showcase-items`);
  },

  async addShowcaseItem(body: { categoryId: number; fileId: number; caption?: string; sortOrder?: number }) {
    return api.post('/admin/portal/showcase-items', body);
  },

  async deleteShowcaseItem(id: number): Promise<void> {
    await api.delete(`/admin/portal/showcase-items/${id}`);
  },

  async reorderShowcase(categoryId: number, itemIdsInOrder: number[]): Promise<void> {
    await api.put(`/admin/portal/categories/${categoryId}/showcase-reorder`, { itemIdsInOrder });
  },
};
