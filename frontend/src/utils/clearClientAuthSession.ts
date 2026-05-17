import { message } from 'antd';

/**
 * 清除浏览器端登录态（供 API 401 等调用，避免与 authStore/authService 形成循环依赖）。
 */
export function clearClientAuthSession(): void {
  try {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    localStorage.removeItem('auth-storage');
  } catch {
    /* ignore */
  }
}

/** 统一：令牌失效时清空状态并回到登录页（axios 与 fetch 下载共用） */
export function notifyAuthExpiredAndRedirect(): void {
  message.warning('登录已过期或无效，正在退出…');
  clearClientAuthSession();
  void import('@/stores/authStore').then(({ useAuthStore }) => {
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      token: null,
      loading: false,
      error: null,
    });
  });
  if (typeof window !== 'undefined' && !String(window.location.hash || '').includes('login')) {
    window.location.hash = '#/login';
  }
}
