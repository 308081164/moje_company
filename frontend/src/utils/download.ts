import { API_ORIGIN } from '@/services/api';

/** 从 Content-Disposition 解析文件名；优先 ASCII filename=，避免误解析 RFC2047 片段 */
function parseContentDispositionFilename(cd: string | null, fallback: string): string {
  if (!cd) return fallback;
  const q = /filename="([^"]+)"/i.exec(cd);
  if (q?.[1]) return q[1].trim();
  const star = /filename\*=UTF-8''([^;\s]+)/i.exec(cd);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      return star[1].trim();
    }
  }
  const plain = /filename=([^;\s]+)/i.exec(cd);
  if (plain?.[1]) return plain[1].replace(/^"|"$/g, '').trim();
  return fallback;
}

/** 带 Bearer 下载接口返回的文件流（适用于 GET 导出等） */
export async function downloadWithAuth(
  path: string,
  fallbackFileName: string,
  /** 例如 text/html;charset=UTF-8，便于本地打开时浏览器识别编码 */
  blobMimeType?: string
): Promise<void> {
  const token = localStorage.getItem('access_token');
  const p = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_ORIGIN}/api${p}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    if (res.status === 401) {
      const { notifyAuthExpiredAndRedirect } = await import('@/utils/clearClientAuthSession');
      notifyAuthExpiredAndRedirect();
      throw new Error('登录已过期');
    }
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  const fromHeader = res.headers.get('Content-Type');
  const type = blobMimeType?.trim() || (fromHeader && fromHeader.trim()) || undefined;
  const blob = new Blob([buf], type ? { type } : undefined);
  const filename = parseContentDispositionFilename(res.headers.get('Content-Disposition'), fallbackFileName);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** POST JSON 后下载二进制（ZIP 等） */
export async function downloadPostWithAuth(
  path: string,
  body: unknown,
  fallbackFileName: string
): Promise<void> {
  const token = localStorage.getItem('access_token');
  const p = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_ORIGIN}/api${p}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    if (res.status === 401) {
      const { notifyAuthExpiredAndRedirect } = await import('@/utils/clearClientAuthSession');
      notifyAuthExpiredAndRedirect();
      throw new Error('登录已过期');
    }
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  const blob = new Blob([buf], { type: res.headers.get('Content-Type') || 'application/octet-stream' });
  const filename = parseContentDispositionFilename(res.headers.get('Content-Disposition'), fallbackFileName);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
