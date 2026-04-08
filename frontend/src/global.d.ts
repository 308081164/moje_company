export {};

declare global {
  interface Window {
    env?: {
      API_URL?: string;
    };

    electronAPI?: {
      onMenuNewOrder: (handler: () => void) => void;
      removeMenuNewOrderListener: (handler: () => void) => void;
      onShowAbout: (handler: () => void) => void;
      removeShowAboutListener: (handler: () => void) => void;

      closeWindow: () => void;
      minimizeWindow: () => void;
      maximizeWindow: () => void;

      log: (level: 'info' | 'warn' | 'error', message: string, meta?: any) => void;
      checkForUpdates: () => Promise<{ checked: boolean; reason?: string }>;
      quitAndInstallUpdate: () => Promise<void>;
    };
  }
}

