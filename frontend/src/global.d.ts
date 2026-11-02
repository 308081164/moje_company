export {};

declare global {
  interface Window {
    env?: {
      API_URL?: string;
      INLAY_API_ORIGIN?: string;
    };

    /** Android WebView 壳读取：consumed | root | back */
    __mojeShellBack?: () => 'consumed' | 'root' | 'back';
    __mojeShellBackState?: {
      mobileMenuOpen?: boolean;
      closeMobileMenu?: () => void;
      chatDetailOpen?: boolean;
      closeChatDetail?: () => void;
      chatDesignOpen?: boolean;
      closeChatDesign?: () => void;
      chatThreadOpen?: boolean;
      chatHistoryPushed?: boolean;
      closeChatThread?: () => void;
    };

    electronAPI?: {
      getInlayAuth?: () => Promise<{ origin: string; username: string; password: string }>;
      setInlayAuth?: (payload: { username: string; password: string }) => Promise<{ ok: boolean }>;
      onMenuNewOrder: (handler: () => void) => void;
      removeMenuNewOrderListener: (handler: () => void) => void;
      onShowAbout: (handler: () => void) => void;
      removeShowAboutListener: (handler: () => void) => void;

      closeWindow: () => void;
      minimizeWindow: () => void;
      maximizeWindow: () => void;

      openSocialPublisher: () => Promise<{ opened: boolean }>;
      embedSocialPublisher?: () => Promise<{ ok: boolean; url?: string; error?: string }>;

      log: (level: 'info' | 'warn' | 'error', message: string, meta?: any) => void;
      checkForUpdates: () => Promise<{ checked: boolean; reason?: string }>;
      quitAndInstallUpdate: () => Promise<void>;
      shareFilesForWeChat?: (
        files: { name: string; data: number[] }[],
        batchId?: string
      ) => Promise<{
        ok: boolean;
        method?: string;
        message?: string;
        paths?: string[];
        batchId?: string;
        batchDir?: string;
      }>;
    };

    /** 员工 App（Flutter 壳）注入：把文件交给系统 Intent，优先直达个人微信选聊天 */
    __mojeNativeShareFiles?: (
      files: { name: string; mime: string; data: string }[]
    ) => boolean | Promise<boolean>;
  }
}

