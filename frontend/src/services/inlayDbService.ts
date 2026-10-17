import axios, { AxiosInstance } from 'axios';

/**
 * 员工端直连公司内网 NAS 珠宝结构库（AI_3d_DataBase :8871）。
 * 不再经过珠宝云后端 /api/inlay-db 代理。
 */

const INLAY_TOKEN_KEY = 'jewelry_structure_access_token';
const INLAY_LS_USER = 'jewelry_structure_username';
const INLAY_LS_PASS = 'jewelry_structure_password';
const DEFAULT_INLAY_ORIGIN = 'http://192.168.1.10:8871';

export class InlayAuthRequiredError extends Error {
  constructor(message = '需要登录珠宝结构库') {
    super(message);
    this.name = 'InlayAuthRequiredError';
  }
}

export type JewelryStructureCredentials = { username: string; password: string };

type JewelryStructureAuthPrompt = (ctx: {
  username: string;
  message?: string;
}) => Promise<JewelryStructureCredentials | null>;

let jewelryStructureAuthPrompt: JewelryStructureAuthPrompt | null = null;

export function setJewelryStructureAuthPrompt(fn: JewelryStructureAuthPrompt | null) {
  jewelryStructureAuthPrompt = fn;
}

export interface InlayDbItem {
  id: string;
  displayName?: string;
  display_name?: string;
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

export interface LibraryAgentHit {
  id: string;
  display_name?: string;
  category?: string;
  thumbnail_url?: string;
  download_url?: string;
  score?: number;
  matched_reason?: string;
  uploader?: string;
}

export interface LibraryAgentSearchResult {
  query: string;
  understood_query?: string;
  intent_phrases?: string[];
  stripped_filler?: boolean;
  reply?: string;
  degraded?: boolean;
  visual_degraded?: boolean;
  deepseek_available?: boolean;
  catalog_count?: number;
  lexical_count?: number;
  channels?: string[];
  hits: LibraryAgentHit[];
}

type InlayAuth = {
  origin: string;
  username: string;
  password: string;
};

function normalizeOrigin(raw: string): string {
  let u = (raw || '').trim().replace(/\/+$/, '');
  if (u.endsWith('/api')) {
    u = u.slice(0, -4).replace(/\/+$/, '');
  }
  return u;
}

function resolveInlayOriginFallback(): string {
  const fromWindow = typeof window !== 'undefined' ? window.env?.INLAY_API_ORIGIN?.trim() : '';
  return normalizeOrigin(fromWindow || DEFAULT_INLAY_ORIGIN);
}

function lanError(err: unknown): Error {
  const anyErr = err as { message?: string; code?: string; response?: { status?: number; data?: { message?: string } } };
  const status = anyErr?.response?.status;
  const remoteMsg = anyErr?.response?.data?.message;
  if (remoteMsg) {
    return new Error(remoteMsg);
  }
  if (!status) {
    return new Error(
      `无法连接公司内网珠宝结构库（${resolveInlayOriginFallback()}）。请确认已接入公司网络后再试。`
    );
  }
  return new Error(anyErr?.message || `珠宝结构库请求失败 HTTP ${status}`);
}

/** 珠宝端历史路径 /inlay-db/... → NAS 真实路径 /api/inlay/v2 或 /api/ml/v1 */
export function mapInlayPath(path: string): string {
  let p = path.startsWith('/') ? path : `/${path}`;
  if (p.startsWith('/api/inlay-db/')) {
    p = p.slice('/api'.length);
  }
  if (p.startsWith('/inlay-db/ml/')) {
    return `/api/ml/v1/${p.slice('/inlay-db/ml/'.length)}`;
  }
  if (p.startsWith('/inlay-db/')) {
    return `/api/inlay/v2/${p.slice('/inlay-db/'.length)}`;
  }
  if (p.startsWith('/api/')) {
    return p;
  }
  return `/api${p}`;
}

let cachedAuth: InlayAuth | null = null;
let loginInFlight: Promise<string> | null = null;

export function currentJewelryStructureUsername(): string {
  if (typeof window === 'undefined') {
    return cachedAuth?.username || '';
  }
  return localStorage.getItem(INLAY_LS_USER) || cachedAuth?.username || '';
}

export function applyJewelryStructureCredentials(username: string, password: string) {
  const origin = cachedAuth?.origin || resolveInlayOriginFallback();
  const nextUser = username.trim();
  cachedAuth = { origin, username: nextUser, password };
  if (typeof window !== 'undefined') {
    localStorage.setItem(INLAY_LS_USER, nextUser);
    localStorage.setItem(INLAY_LS_PASS, password);
    localStorage.removeItem(INLAY_TOKEN_KEY);
    void window.electronAPI?.setInlayAuth?.({ username: nextUser, password });
  }
}

async function loadInlayAuth(): Promise<InlayAuth> {
  const lsUser = typeof window !== 'undefined' ? localStorage.getItem(INLAY_LS_USER) || '' : '';
  const lsPass = typeof window !== 'undefined' ? localStorage.getItem(INLAY_LS_PASS) || '' : '';
  let origin = resolveInlayOriginFallback();
  let username = lsUser;
  let password = lsPass;
  if (typeof window !== 'undefined' && window.electronAPI?.getInlayAuth) {
    const fromMain = await window.electronAPI.getInlayAuth();
    origin = normalizeOrigin(fromMain.origin || origin);
    if (!username) {
      username = fromMain.username || '';
    }
    if (!password) {
      password = fromMain.password || '';
    }
  }
  cachedAuth = { origin, username, password };
  return cachedAuth;
}

function unwrap(body: any): any {
  if (body && typeof body === 'object' && typeof body.code === 'number') {
    if (body.code !== 200) {
      throw new Error(body.message || '珠宝结构库返回错误');
    }
    return body.data;
  }
  return body;
}

function createClient(origin: string): AxiosInstance {
  const client = axios.create({
    baseURL: origin,
    timeout: 120000,
  });
  client.interceptors.request.use((config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(INLAY_TOKEN_KEY) : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data instanceof FormData) {
      delete (config.headers as Record<string, unknown>)['Content-Type'];
    }
    if (config.url && !/^https?:\/\//i.test(config.url)) {
      config.url = mapInlayPath(config.url);
    }
    return config;
  });
  client.interceptors.response.use(
    (response) => {
      if (response.data instanceof Blob || response.config.responseType === 'blob') {
        return response;
      }
      return unwrap(response.data);
    },
    async (error) => {
      const status = error?.response?.status;
      const original = error?.config;
      if (status === 401 && original && !original._inlayRetry) {
        original._inlayRetry = true;
        localStorage.removeItem(INLAY_TOKEN_KEY);
        await ensureInlayLogin(true);
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${localStorage.getItem(INLAY_TOKEN_KEY) || ''}`;
        return createClient((await loadInlayAuth()).origin)(original);
      }
      throw lanError(error);
    }
  );
  return client;
}

async function promptCredentials(username: string, message?: string): Promise<JewelryStructureCredentials> {
  if (!jewelryStructureAuthPrompt) {
    throw new InlayAuthRequiredError(message || '请先登录珠宝结构库');
  }
  const creds = await jewelryStructureAuthPrompt({ username, message });
  if (!creds || !creds.username.trim() || !creds.password) {
    throw new InlayAuthRequiredError('已取消登录珠宝结构库');
  }
  applyJewelryStructureCredentials(creds.username, creds.password);
  return creds;
}

async function loginWithAuth(auth: InlayAuth): Promise<string> {
  const res = await axios.post(
    `${auth.origin}/api/auth/login`,
    { username: auth.username, password: auth.password },
    { timeout: 15000 }
  );
  const token = unwrap(res.data)?.token;
  if (!token) {
    throw new Error('珠宝结构库登录成功但未返回 token');
  }
  localStorage.setItem(INLAY_TOKEN_KEY, token);
  return token as string;
}

async function ensureInlayLogin(force = false): Promise<string> {
  if (!force) {
    const existing = typeof window !== 'undefined' ? localStorage.getItem(INLAY_TOKEN_KEY) : null;
    if (existing) {
      return existing;
    }
  }
  if (loginInFlight) {
    return loginInFlight;
  }
  loginInFlight = (async () => {
    let auth = await loadInlayAuth();
    if (!auth.username || !auth.password) {
      await promptCredentials(auth.username, '请输入珠宝结构库账号和密码');
      auth = await loadInlayAuth();
    }
    try {
      return await loginWithAuth(auth);
    } catch (e) {
      const err = lanError(e);
      await promptCredentials(auth.username, err.message || '登录失败，请重新输入账号密码');
      auth = await loadInlayAuth();
      try {
        return await loginWithAuth(auth);
      } catch (e2) {
        throw lanError(e2);
      }
    }
  })().finally(() => {
    loginInFlight = null;
  });
  return loginInFlight;
}

async function client(): Promise<AxiosInstance> {
  const auth = await loadInlayAuth();
  await ensureInlayLogin();
  return createClient(auth.origin);
}

export const inlayDbService = {
  origin(): string {
    return cachedAuth?.origin || resolveInlayOriginFallback();
  },

  currentUsername(): string {
    return currentJewelryStructureUsername();
  },

  async ensureSession(): Promise<string> {
    return ensureInlayLogin();
  },

  async relogin(): Promise<string> {
    const auth = await loadInlayAuth();
    await promptCredentials(auth.username, '请输入珠宝结构库账号和密码');
    return ensureInlayLogin(true);
  },

  async listItems(params: Record<string, string | number | undefined> = {}): Promise<InlayDbPage> {
    const api = await client();
    return api.get('/inlay-db/items', { params }) as Promise<InlayDbPage>;
  },

  async getItem(id: string): Promise<InlayDbItem> {
    const api = await client();
    return api.get(`/inlay-db/items/${id}`) as Promise<InlayDbItem>;
  },

  async listCategories(): Promise<InlayCategoryNode[]> {
    const api = await client();
    return api.get('/inlay-db/categories') as Promise<InlayCategoryNode[]>;
  },

  async listTags(): Promise<{ id: string; name: string; color?: string }[]> {
    const api = await client();
    return api.get('/inlay-db/tags') as Promise<{ id: string; name: string; color?: string }[]>;
  },

  async indexStatus(): Promise<{ vector_count?: number; structure_count?: number; model?: string; [k: string]: unknown }> {
    const api = await client();
    return api.get('/inlay-db/ml/index/status') as Promise<{
      vector_count?: number;
      structure_count?: number;
      model?: string;
      [k: string]: unknown;
    }>;
  },

  async upload(form: FormData): Promise<InlayDbItem> {
    const api = await client();
    return api.post('/inlay-db/items', form) as Promise<InlayDbItem>;
  },

  async annotate(id: string, body: Record<string, unknown>): Promise<InlayDbItem> {
    const api = await client();
    return api.post(`/inlay-db/items/${id}/annotate`, body) as Promise<InlayDbItem>;
  },

  async detectRegions(image: File): Promise<{ regions?: RegionBox[]; [k: string]: unknown }> {
    const fd = new FormData();
    fd.append('image', image);
    const api = await client();
    return api.post('/inlay-db/ml/detect-regions', fd) as Promise<{ regions?: RegionBox[]; [k: string]: unknown }>;
  },

  async searchByImage(image: File, categoryId?: string, topK?: number): Promise<SearchHit[]> {
    const fd = new FormData();
    fd.append('image', image);
    if (categoryId) fd.append('category_id', categoryId);
    if (topK) fd.append('top_k', String(topK));
    const api = await client();
    return api.post('/inlay-db/ml/search-by-image', fd) as Promise<SearchHit[]>;
  },

  async searchByRegions(image: File, regions: RegionBox[], topK?: number): Promise<SearchHit[][]> {
    const fd = new FormData();
    fd.append('image', image);
    fd.append('regions', JSON.stringify(regions));
    if (topK) fd.append('top_k', String(topK));
    const api = await client();
    return api.post('/inlay-db/ml/search-by-regions', fd) as Promise<SearchHit[][]>;
  },

  async agentSearch(params: {
    query: string;
    images?: File[];
    category_id?: string;
    only_mine?: boolean;
    top_k?: number;
  }): Promise<LibraryAgentSearchResult> {
    const fd = new FormData();
    fd.append('query', params.query || '');
    if (params.category_id) fd.append('category_id', params.category_id);
    if (params.only_mine != null) fd.append('only_mine', String(params.only_mine));
    fd.append('top_k', String(params.top_k ?? 16));
    for (const file of params.images || []) {
      fd.append('images', file);
    }
    const api = await client();
    const data = (await api.post('/inlay-db/agent/search', fd, { timeout: 90000 })) as
      | LibraryAgentSearchResult
      | LibraryAgentHit[];
    if (Array.isArray(data)) {
      return { query: params.query, hits: data };
    }
    return {
      query: data?.query || params.query,
      understood_query: data?.understood_query,
      intent_phrases: data?.intent_phrases,
      stripped_filler: data?.stripped_filler,
      reply: data?.reply,
      degraded: data?.degraded,
      visual_degraded: data?.visual_degraded,
      deepseek_available: data?.deepseek_available,
      catalog_count: data?.catalog_count,
      lexical_count: data?.lexical_count,
      channels: data?.channels,
      hits: Array.isArray(data?.hits) ? data.hits : [],
    };
  },

  async deepseekStatus(): Promise<{ available?: boolean }> {
    const api = await client();
    return api.get('/inlay-db/ml/deepseek/status') as Promise<{ available?: boolean }>;
  },

  downloadUrl(id: string, format: string): string {
    return mapInlayPath(`/inlay-db/items/${id}/download?format=${format}`);
  },
  thumbnailUrl(id: string): string {
    return mapInlayPath(`/inlay-db/items/${id}/thumbnail`);
  },
  assetUrl(id: string, assetType: string): string {
    return mapInlayPath(`/inlay-db/items/${id}/assets/${assetType}`);
  },

  async imageBlobUrl(path: string): Promise<string> {
    const auth = await loadInlayAuth();
    await ensureInlayLogin();
    const token = localStorage.getItem(INLAY_TOKEN_KEY);
    const url = `${auth.origin}${mapInlayPath(path)}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      throw new Error(
        `无法连接公司内网珠宝结构库（${auth.origin}）。请确认已接入公司网络后再试。`
      );
    }
    if (res.status === 401) {
      localStorage.removeItem(INLAY_TOKEN_KEY);
      await ensureInlayLogin(true);
      const retryToken = localStorage.getItem(INLAY_TOKEN_KEY);
      res = await fetch(url, {
        headers: retryToken ? { Authorization: `Bearer ${retryToken}` } : {},
      });
    }
    if (!res.ok) {
      throw new Error(`图片加载失败 HTTP ${res.status}`);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  async downloadFile(path: string, fallbackFileName: string): Promise<void> {
    const auth = await loadInlayAuth();
    await ensureInlayLogin();
    const token = localStorage.getItem(INLAY_TOKEN_KEY);
    const url = `${auth.origin}${mapInlayPath(path)}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      throw new Error(
        `无法连接公司内网珠宝结构库（${auth.origin}）。请确认已接入公司网络后再试。`
      );
    }
    if (!res.ok) {
      throw new Error((await res.text()) || `HTTP ${res.status}`);
    }
    const buf = await res.arrayBuffer();
    const type = res.headers.get('Content-Type') || undefined;
    const blob = new Blob([buf], type ? { type } : undefined);
    const cd = res.headers.get('Content-Disposition') || '';
    const quoted = /filename="([^"]+)"/i.exec(cd);
    const filename = quoted?.[1]?.trim() || fallbackFileName;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};
