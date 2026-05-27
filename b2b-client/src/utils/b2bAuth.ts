/** B 端门户 JWT 存取与简单过期校验（仅解析 payload，不验签）。 */

const B2B_TOKEN_KEY = 'moje_b2b_token'

export function getB2bTokenRaw(): string | null {
  const raw = localStorage.getItem(B2B_TOKEN_KEY)
  if (raw == null) return null
  const t = raw.trim()
  return t.length ? t : null
}

export function setB2bToken(token: string) {
  localStorage.setItem(B2B_TOKEN_KEY, token.trim())
}

export function clearB2bToken() {
  localStorage.removeItem(B2B_TOKEN_KEY)
}

/** @returns 过期时刻 ms；无法解析时返回 null */
export function readJwtExpMs(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = (4 - (b64.length % 4)) % 4
    if (pad) b64 += '='.repeat(pad)
    const json = decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    const payload = JSON.parse(json) as { exp?: number }
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

export function isB2bTokenExpiredOrInvalid(token: string | null): boolean {
  if (!token) return true
  if (token.split('.').length !== 3) return true
  const exp = readJwtExpMs(token)
  if (exp == null) return false
  return Date.now() >= exp - 30_000
}

/** B 端登录/注册：勿附带旧 JWT，401 亦不应清会话 */
export function urlIsB2bCredentialEndpoint(url: string): boolean {
  const u = url.split('?')[0] || ''
  return u.includes('/b2b/client/login') || u.includes('/b2b/client/register')
}

export function urlIsCPortalCredentialEndpoint(url: string): boolean {
  const u = url.split('?')[0] || ''
  return u.includes('/portal/c/account/login') || u.includes('/portal/c/account/register')
}

/** 请求 URL 是否属于 B2B API（兼容 baseURL 含 /api、绝对地址等） */
export function urlLooksLikeB2bApi(url: string): boolean {
  const u = url.split('?')[0] || ''
  if (u.includes('/b2b/')) return true
  if (u.startsWith('/b2b')) return true
  return false
}

export function urlLooksLikeCPortalApi(url: string): boolean {
  const u = url.split('?')[0] || ''
  if (u.includes('/portal/c/')) return true
  if (u.startsWith('/portal/c')) return true
  return false
}
