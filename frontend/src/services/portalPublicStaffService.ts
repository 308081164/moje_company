import { API_ORIGIN } from '@/services/api';

/** 门户公开接口（/public/portal），供员工端（如建模师资料库）读取橱窗素材 */
export interface PortalImagePublic {
  fileId: number;
  url: string;
  caption?: string | null;
}

export interface PortalCategoryPublic {
  slug: string;
  nameCn: string;
  nameEn?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  visibleItemCount: number;
  preview: PortalImagePublic[];
}

export interface PortalHomePublic {
  heroTitle?: string | null;
  heroSubtitle?: string | null;
  carousel: PortalImagePublic[];
  companyPhotos: PortalImagePublic[];
  categories: PortalCategoryPublic[];
}

export interface PortalCategoryDetailPublic {
  slug: string;
  nameCn: string;
  nameEn?: string | null;
  description?: string | null;
  items: PortalImagePublic[];
}

async function getJson<T>(path: string): Promise<T> {
  const p = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_ORIGIN}/api${p}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const portalPublicStaffService = {
  async home(): Promise<PortalHomePublic> {
    return getJson<PortalHomePublic>('/public/portal/home');
  },

  async categoryDetail(slug: string): Promise<PortalCategoryDetailPublic> {
    return getJson<PortalCategoryDetailPublic>(`/public/portal/category/${encodeURIComponent(slug)}`);
  },
};
