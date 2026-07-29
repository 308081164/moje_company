import { ElMessage, ElMessageBox } from 'element-plus'

/** 二次密码（客户端校验；生产环境应改为服务端鉴权） */
const DELETE_PASSWORD = 'moje666'

const CACHE_KEY = 'moje_delete_auth_verified_at'
const CACHE_TTL_MS = 5 * 60 * 1000

function isWithinCacheWindow(): boolean {
  const raw = sessionStorage.getItem(CACHE_KEY)
  if (!raw) return false
  const verifiedAt = Number(raw)
  if (!Number.isFinite(verifiedAt)) return false
  return Date.now() - verifiedAt < CACHE_TTL_MS
}

function markVerified(): void {
  sessionStorage.setItem(CACHE_KEY, String(Date.now()))
}

/**
 * 删除前二级密码验证。同浏览器会话内 5 分钟内验证通过则免再次输入。
 */
export async function verifyDeletePassword(): Promise<boolean> {
  if (isWithinCacheWindow()) {
    return true
  }

  try {
    const { value } = await ElMessageBox.prompt('请输入二次密码以确认删除', '安全验证', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      inputType: 'password',
      inputPlaceholder: '二次密码',
    })
    if (value !== DELETE_PASSWORD) {
      ElMessage.error('密码错误，删除已取消')
      return false
    }
    markVerified()
    return true
  } catch {
    return false
  }
}
