import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import 'antd/dist/reset.css';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import App from './App';
import './index.css';

// Webpack 5 + Electron 环境兼容：部分依赖会在运行期读取 global
// 这里在入口最早处显式注入，避免 "global is not defined"
(globalThis as any).global = globalThis;

console.log('[renderer] boot', {
  href: window.location.href,
  hasAppEl: !!document.getElementById('app'),
  hasRootEl: !!document.getElementById('root'),
});

// 配置dayjs本地化
dayjs.locale('zh-cn');

// 应用主题配置
const theme = {
  token: {
    colorPrimary: '#1890ff',
    borderRadius: 6,
    colorBgContainer: '#ffffff',
    colorBorder: '#d9d9d9',
    colorText: '#333333',
    colorTextSecondary: '#666666',
    colorTextTertiary: '#999999',
    fontSize: 14,
    lineHeight: 1.5715,
  },
  components: {
    Layout: {
      headerBg: '#001529',
      headerColor: '#ffffff',
      siderBg: '#001529',
      triggerBg: '#002140',
      triggerColor: '#ffffff',
    },
    Menu: {
      darkItemBg: '#001529',
      darkItemColor: '#ffffff',
      darkItemSelectedBg: '#1890ff',
      darkItemSelectedColor: '#ffffff',
    },
    Table: {
      headerBg: '#fafafa',
      headerColor: '#333333',
      rowHoverBg: '#f5f5f5',
    },
    Button: {
      defaultBg: '#ffffff',
      defaultBorderColor: '#d9d9d9',
      defaultColor: '#333333',
    },
  },
};

// 渲染应用
const root = ReactDOM.createRoot(
  document.getElementById('app') as HTMLElement
);

// 应用加载完成事件
window.addEventListener('DOMContentLoaded', () => {
  // 显示加载完成
  setTimeout(() => {
    window.dispatchEvent(new Event('app-loaded'));
  }, 500);
});

// 错误边界
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React应用错误:', error, errorInfo);
    
    // 发送错误报告
    if (window.electronAPI) {
      window.electronAPI.log('error', 'React应用错误', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: 20,
          textAlign: 'center',
          backgroundColor: '#f0f2f5',
        }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>😢</div>
          <h1 style={{ marginBottom: 16, color: '#333' }}>应用遇到错误</h1>
          <p style={{ marginBottom: 24, color: '#666', maxWidth: 600 }}>
            {this.state.error?.message || '未知错误'}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 16px',
                backgroundColor: '#1890ff',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              重新加载
            </button>
            <button
              onClick={() => {
                if (window.electronAPI) {
                  window.electronAPI.closeWindow();
                }
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f5f5f5',
                color: '#333',
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              退出应用
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// 渲染应用
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConfigProvider locale={zhCN} theme={theme}>
        <App />
      </ConfigProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// 热模块替换（开发环境）
// Webpack HMR（避免 import.meta 在 commonjs module 下报错）
declare const module: any;
if (module?.hot) {
  module.hot.accept();
}

/** 浏览器 / PWA：注册 Service Worker（Electron 不注册） */
function registerPwaServiceWorker() {
  if (typeof window === 'undefined') return;
  if ((window as unknown as { electronAPI?: unknown }).electronAPI) return;
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    const url = new URL('/sw.js', window.location.origin).href;
    navigator.serviceWorker
      .register(url, { scope: '/' })
      .then((reg) => console.log('[pwa] service worker', reg.scope))
      .catch((e) => console.warn('[pwa] service worker register failed', e));
  });
}

registerPwaServiceWorker();

// 全局错误处理
window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的Promise拒绝:', event.reason);
  
  if (window.electronAPI) {
    window.electronAPI.log('error', '未处理的Promise拒绝', {
      reason: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
    });
  }
});

window.addEventListener('error', (event) => {
  console.error('全局错误:', event.error);
  
  if (window.electronAPI) {
    window.electronAPI.log('error', '全局JavaScript错误', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error?.message,
      stack: event.error?.stack,
    });
  }
});