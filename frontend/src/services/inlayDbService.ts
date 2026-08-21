import api, { API_ORIGIN } from './api';

// AI_3d_DataBase 代理接口类型定义

export interface InlayDbItem {
  id: string;
  displayName?: string;
  categoryId?: string;
  categoryName?: string;
  tags?: string[];
  inlayType?: string;
  stoneDiameterMm?: number;
  status?: string;
  assetPipelineStatus?: string;
  thumbnailUrl?: string;
  previewViews?: string[];
  meshReady?: boolean;
  uploadedByUsername?: string;
  updatedAt?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface InlayDbPage {
  total: number;
  items: InlayDbItem[];
}

export interface InlayCategoryNode {
  id: string;
  name: string;
  parentId?: string | null;
  children?: InlayCategoryNode[];
}

export interface RegionBox {
  region_id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  category_id: string;
}

export interface SearchHit {
  id: string;
  score: number;
  display_name?: string;
  thumbnail_url?: string;
  preview_views?: string[];
  [key: string]: unknown;
}

export const inlayDbService = {
  // 浏览/搜索
  async listItems(params: Record<string, string | number | undefined> = {}): Promise<InlayDbPage> {
    return api.get('/inlay-db/items', { params });
  },

  async getItem(id: string): Promise<InlayDbItem> {
    return api.get(`/inlay-db/items/${id}`);
  },

  async listCategories(): Promise<InlayCategoryNode[]> {
    return api.get('/inlay-db/categories');
  },

  async listTags(): Promise<{ id: string; name: string; color?: string }[]> {
    return api.get('/inlay-db/tags');
  },

  async indexStatus(): Promise<{ vector_count?: number; structure_count?: number; model?: string; [k: string]: unknown }> {
    return api.get('/inlay-db/ml/index/status');
  },

  // 上传
  async upload(form: FormData): Promise<InlayDbItem> {
    return api.post('/inlay-db/items', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  async annotate(id: string, body: Record<string, unknown>): Promise<InlayDbItem> {
    return api.post(`/inlay-db/items/${id}/annotate`, body);
  },

  // 识结构
  async detectRegions(image: File): Promise<{ regions?: RegionBox[]; [k: string]: unknown }> {
    const fd = new FormData();
    fd.append('image', image);
    return api.post('/inlay-db/ml/detect-regions', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  async searchByImage(image: File, categoryId?: string, topK?: number): Promise<SearchHit[]> {
    const fd = new FormData();
    fd.append('image', image);
    if (categoryId) fd.append('category_id', categoryId);
    if (topK) fd.append('top_k', String(topK));
    return api.post('/inlay-db/ml/search-by-image', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  async searchByRegions(image: File, regions: RegionBox[], topK?: number): Promise<SearchHit[][]> {
    const fd = new FormData();
    fd.append('image', image);
    fd.append('regions', JSON.stringify(regions));
    if (topK) fd.append('top_k', String(topK));
    return api.post('/inlay-db/ml/search-by-regions', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // 资源/下载 URL（需带 token，用 api 封装下载二进制）
  downloadUrl(id: string, format: string): string {
    return `/api/inlay-db/items/${id}/download?format=${format}`;
  },
  thumbnailUrl(id: string): string {
    return `/api/inlay-db/items/${id}/thumbnail`;
  },
  assetUrl(id: string, assetType: string): string {
    return `/api/inlay-db/items/${id}/assets/${assetType}`;
  },

  /** 带鉴权获取图片 blob URL（用于 thumbnail/preview/asset 等二进制资源） */
  async imageBlobUrl(path: string): Promise<string> {
    const token = localStorage.getItem('access_token');
    const p = path.startsWith('/api/') ? path : `/api${path}`;
    const res = await fetch(`${API_ORIGIN}${p}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error(`图片加载失败 HTTP ${res.status}`);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
};
