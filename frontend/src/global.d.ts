export {};

declare global {
  interface Window {
    env?: {
      API_URL?: string;
      INLAY_API_ORIGIN?: string;
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
    };
  }
}

