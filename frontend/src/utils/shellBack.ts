export type ShellBackResult = 'consumed' | 'root' | 'back';

export interface ShellBackState {
  mobileMenuOpen?: boolean;
  closeMobileMenu?: () => void;
  chatDetailOpen?: boolean;
  closeChatDetail?: () => void;
  chatDesignOpen?: boolean;
  closeChatDesign?: () => void;
  chatThreadOpen?: boolean;
  chatHistoryPushed?: boolean;
  closeChatThread?: () => void;
}

/** 底部导航根页面，以及登录页、首页。这些页面上系统返回不往历史里退。 */
const ROOT_PATHS = new Set([
  '/',
  '/dashboard',
  '/login',
  '/chat',
  '/orders',
  '/workbench',
  '/workbench/tracker-follow-up',
  '/workbench/modeling-archive',
  '/social-publish',
]);

export function shellHashPath(): string {
  const raw = (window.location.hash || '').replace(/^#/, '') || '/';
  const pathOnly = raw.split('?')[0] || '/';
  let path = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path || '/';
}

function hashQuery(): URLSearchParams {
  const raw = window.location.hash || '';
  const q = raw.indexOf('?');
  return new URLSearchParams(q >= 0 ? raw.slice(q + 1) : '');
}

/**
 * 给 Android WebView 壳调用。
 * consumed：已关掉抽屉或弹层；root：当前是底层页，壳应提示再按一次退出；back：交给历史回退。
 */
export function installShellBack(): void {
  window.__mojeShellBack = () => {
    const state = window.__mojeShellBackState;
    if (state?.mobileMenuOpen && state.closeMobileMenu) {
      state.closeMobileMenu();
      return 'consumed';
    }
    if (state?.chatDetailOpen && state.closeChatDetail) {
      state.closeChatDetail();
      return 'consumed';
    }
    if (state?.chatDesignOpen && state.closeChatDesign) {
      state.closeChatDesign();
      return 'consumed';
    }
    const chatQueryOpen = shellHashPath() === '/chat' && hashQuery().get('c') != null;
    if (state?.chatThreadOpen || chatQueryOpen) {
      // 有 ?c= 历史时交给壳去 canGoBack / history.back；退不动时壳会调 closeChatThread。
      if (state?.chatHistoryPushed || chatQueryOpen) return 'back';
      state?.closeChatThread?.();
      return 'consumed';
    }
    if (ROOT_PATHS.has(shellHashPath())) return 'root';
    return 'back';
  };
}
