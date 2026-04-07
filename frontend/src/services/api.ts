import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { message } from 'antd';

// API 基址：优先 Electron preload 注入的 window.env.API_URL（如 http://host:8851），否则使用默认服务器
function normalizeApiOrigin(): string {
  let raw = (typeof window !== 'undefined' && window.env?.API_URL?.trim()) || 'http://39.102.213.51:8851';
  raw = raw.replace(/\/+$/, '');
  if (raw.endsWith('/api')) {
    raw = raw.slice(0, -4);
  }
  return raw;
}

const API_ORIGIN = normalizeApiOrigin();

type ApiClient = {
  get: <T = any>(url: string, config?: any) => Promise<T>;
  post: <T = any>(url: string, data?: any, config?: any) => Promise<T>;
  put: <T = any>(url: string, data?: any, config?: any) => Promise<T>;
  delete: <T = any>(url: string, config?: any) => Promise<T>;
};

// 创建axios实例
const api: AxiosInstance = axios.create({
  baseURL: API_ORIGIN,
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 统一将相对路径映射到 /api/*
    if (config.url && !/^https?:\/\//i.test(config.url)) {
      config.url = config.url.startsWith('/api')
        ? config.url
        : `/api${config.url.startsWith('/') ? '' : '/'}${config.url}`;
    }

    // 从本地存储获取token
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 添加请求时间戳（防止缓存）
    if (config.method?.toLowerCase() === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now(),
      };
    }

    const finalUrl = `${config.baseURL || ''}${config.url || ''}`;
    console.log('[API] request', config.method?.toUpperCase(), finalUrl);
    
    return config;
  },
  (error) => {
    console.error('请求配置错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // 处理成功响应
    const { data } = response;
    
    // 如果返回的是Blob（文件下载），直接返回
    if (data instanceof Blob) {
      return response;
    }
    
    // 处理业务逻辑错误
    if (data.code && data.code !== 200) {
      const errorMsg = data.message || '请求失败';
      message.error(errorMsg);
      return Promise.reject(new Error(errorMsg));
    }
    
    return data;
  },
  (error) => {
    // 处理HTTP错误
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          message.error(data?.message || '请求参数错误');
          break;
        case 401:
          message.error('认证失败（后端返回401），请检查后端认证配置');
          // 清除本地存储
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user_info');
          // 跳转到登录页
          window.location.hash = '#/login';
          break;
        case 403:
          message.error('权限不足，无法访问');
          break;
        case 404:
          message.error('请求的资源不存在');
          break;
        case 500:
          message.error('服务器内部错误');
          break;
        case 502:
        case 503:
        case 504:
          message.error('服务暂时不可用，请稍后重试');
          break;
        default:
          message.error(data?.message || `请求失败 (${status})`);
      }
    } else if (error.request) {
      // 请求已发出但没有收到响应
      message.error('网络请求失败，请检查后端地址、反向代理与CORS/认证配置');
    } else {
      // 请求配置错误
      message.error('请求配置错误');
    }
    
    console.error('API请求错误:', error);
    return Promise.reject(error);
  }
);

// 文件上传配置
export const uploadConfig = {
  maxSize: 50 * 1024 * 1024, // 50MB
  allowedTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'model/stl',
    'model/obj',
    'application/octet-stream', // 通用二进制文件
  ],
};

// 导出API实例
export default api as unknown as ApiClient;