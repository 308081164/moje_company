import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

// 配置 dayjs 中文
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';

dayjs.locale('zh-cn');
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

// 配置 axios 拦截器
import axios from 'axios';

// 设置 axios 默认配置
axios.defaults.baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api';
axios.defaults.timeout = 30000;
axios.defaults.headers.common['Content-Type'] = 'application/json';

// 请求拦截器
axios.interceptors.request.use(
  (config) => {
    // 从 localStorage 获取 token
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 添加请求时间戳
    config.headers['X-Request-Timestamp'] = Date.now();
    
    return config;
  },
  (error) => {
    console.error('请求拦截器错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
axios.interceptors.response.use(
  (response) => {
    // 处理成功响应
    return response.data;
  },
  (error) => {
    // 处理错误响应
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // 未授权，清除 token 并跳转到登录页
          localStorage.removeItem('access_token');
          localStorage.removeItem('user_info');
          window.location.href = '/login';
          break;
        case 403:
          console.error('权限不足:', data.message || '您没有权限执行此操作');
          break;
        case 404:
          console.error('资源不存在:', data.message || '请求的资源不存在');
          break;
        case 500:
          console.error('服务器错误:', data.message || '服务器内部错误');
          break;
        default:
          console.error('请求错误:', data.message || '未知错误');
      }
    } else if (error.request) {
      // 请求已发出但没有收到响应
      console.error('网络错误:', '请检查网络连接');
    } else {
      // 请求配置错误
      console.error('请求配置错误:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// 错误边界组件
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
    console.error('React 错误边界捕获:', error, errorInfo);
    
    // 可以在这里发送错误报告
    // sendErrorReport(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f5f5f5',
        }}>
          <h1 style={{ color: '#ff4d4f', marginBottom: '20px' }}>
            应用出现错误
          </h1>
          <p style={{ color: '#666', marginBottom: '30px', maxWidth: '600px' }}>
            抱歉，应用遇到了一个错误。我们已经记录了这个错误，并将尽快修复。
          </p>
          <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#fff', borderRadius: '8px', maxWidth: '600px' }}>
            <p style={{ color: '#999', fontSize: '12px', textAlign: 'left' }}>
              {this.state.error?.toString()}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#1890ff',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// 性能监控
if (process.env.NODE_ENV === 'development') {
  // 开发环境性能监控
  const reportWebVitals = (onPerfEntry?: any) => {
    if (onPerfEntry && onPerfEntry instanceof Function) {
      import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
        getCLS(onPerfEntry);
        getFID(onPerfEntry);
        getFCP(onPerfEntry);
        getLCP(onPerfEntry);
        getTTFB(onPerfEntry);
      });
    }
  };

  // 可以在这里添加性能监控
  // reportWebVitals(console.log);
}

// 渲染应用
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// 注册 Service Worker (PWA 支持)
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker 注册成功:', registration);
      })
      .catch((error) => {
        console.log('Service Worker 注册失败:', error);
      });
  });
}

// 离线检测
window.addEventListener('online', () => {
  console.log('网络已连接');
  // 可以在这里显示网络恢复通知
});

window.addEventListener('offline', () => {
  console.log('网络已断开');
  // 可以在这里显示离线通知
});

// 全局错误处理
window.addEventListener('error', (event) => {
  console.error('全局错误:', event.error);
  // 可以在这里发送错误报告
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的 Promise 拒绝:', event.reason);
  // 可以在这里发送错误报告
});

// 导出常用工具
export { dayjs, axios };

// 开发环境热更新
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept();
}