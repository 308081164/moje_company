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
  scope?: string;
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

export interface HomeBlock {
  id?: number;
  scope?: string;
  section: string;
  blockKey: string;
  sortOrder?: number;
  enabled?: boolean;
  content?: {
    texts?: Record<string, string>;
    image?: string;
    images?: string[];
    extra?: Record<string, unknown>;
  } | null;
}

export type PortalScope = 'B' | 'C';

export const portalAdminService = {
  // 站点设置（scope 隔离）
  async getSiteSettings(scope: PortalScope = 'B'): Promise<PortalSiteSettingsAdmin> {
    return api.get('/admin/portal/site-settings', { params: { scope } });
  },

  async updateSiteSettings(scope: PortalScope, body: Partial<PortalSiteSettingsAdmin>): Promise<unknown> {
    return api.put('/admin/portal/site-settings', body, { params: { scope } });
  },

  async uploadPortalFile(file: File, kind: 'carousel' | 'company'): Promise<{ id: number; fileUrl?: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/admin/portal/uploads?kind=${encodeURIComponent(kind)}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // 首页区块（scope 隔离）
  async getHomeBlocks(scope: PortalScope): Promise<HomeBlock[]> {
    return api.get('/admin/portal/home-blocks', { params: { scope } });
  },

  async updateHomeBlocks(scope: PortalScope, blocks: HomeBlock[]): Promise<HomeBlock[]> {
    return api.put('/admin/portal/home-blocks', blocks, { params: { scope } });
  },

  async translateBlock(zhText: string): Promise<Record<string, string>> {
    return api.post('/admin/portal/home-blocks/translate', { zhText });
  },

  // 分类（scope 隔离）
  async listCategories(scope: PortalScope = 'B'): Promise<PortalJewelryCategory[]> {
    return api.get('/admin/portal/categories', { params: { scope } });
  },

  async createCategory(scope: PortalScope, body: Partial<PortalJewelryCategory>): Promise<PortalJewelryCategory> {
    return api.post('/admin/portal/categories', body, { params: { scope } });
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
