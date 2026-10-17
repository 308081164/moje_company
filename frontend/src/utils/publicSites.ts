/** 从员工端 API 基址推导对外 B2B / C 端站点地址（与生产打包的 api-config 一致）。 */
export function resolvePublicSites() {
  const raw =
    (typeof window !== 'undefined' && window.env?.API_URL) || 'http://62.234.174.95:8851/api';
  let host = '62.234.174.95';
  let protocol = 'http:';
  try {
    const u = new URL(raw.replace(/\/api\/?$/, ''));
    host = u.hostname;
    protocol = u.protocol;
  } catch {
    /* keep default */
  }
  if (host === 'localhost' || host === '127.0.0.1') {
    host = '62.234.174.95';
    protocol = 'http:';
  }
  const portal = `${protocol}//${host}:8852`;
  const cend = `${protocol}//${host}:8853`;
  return { portal, cend, host, protocol };
}
