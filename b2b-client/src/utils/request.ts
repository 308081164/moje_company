import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { message } from 'ant-design-vue'
import {
  clearB2bToken,
  getB2bTokenRaw,
  urlIsB2bCredentialEndpoint,
  urlIsCPortalCredentialEndpoint,
  urlLooksLikeB2bApi,
  urlLooksLikeCPortalApi
} from '@/utils/b2bAuth'

declare module 'axios' {
  interface AxiosRequestConfig {
    /** 为 true 时不弹出全局错误 toast（由调用方自行处理） */
    skipGlobalError?: boolean
  }
}

const instance: AxiosInstance = axios.create({
  baseURL: (import.meta as any).env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json;charset=utf-8'
  }
})

function resolveRequestPath(config: InternalAxiosRequestConfig): string {
  const rawUrl = config.url || ''
  const base = config.baseURL != null ? String(config.baseURL) : ''
  const combined = /^https?:\/\//i.test(rawUrl) ? rawUrl : `${base}${rawUrl}`
  return combined.split('?')[0] || rawUrl
}

instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const pathForMatch = resolveRequestPath(config)

    const isCredentialEndpoint =
      urlIsB2bCredentialEndpoint(pathForMatch) || urlIsCPortalCredentialEndpoint(pathForMatch)

    let bearer: string | null = null
    if (!isCredentialEndpoint) {
      if (urlLooksLikeCPortalApi(pathForMatch)) {
        const t = localStorage.getItem('moje_c_portal_token')
        bearer = t?.trim() || null
      } else if (urlLooksLikeB2bApi(pathForMatch)) {
        bearer = getB2bTokenRaw()
      }
    }
    if (bearer) {
      config.headers = config.headers || {}
      ;(config.headers as Record<string, string>)['Authorization'] = `Bearer ${bearer}`
    }
    if (config.data instanceof FormData) {
      delete (config.headers as Record<string, unknown>)['Content-Type']
    }
    return config
  },
  (error) => Promise.reject(error)
)

instance.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  (error) => {
    if (error.response) {
      const { status, data, config } = error.response
      const reqConfig = config as InternalAxiosRequestConfig | undefined
      const errorMessage = data?.message || data?.error || `请求失败 (${status})`
      const path = reqConfig ? resolveRequestPath(reqConfig) : ''

      if (status === 401 && reqConfig) {
        const isCredentialFailure =
          urlIsB2bCredentialEndpoint(path) || urlIsCPortalCredentialEndpoint(path)

        // 登录/注册密码错误：不清除已有有效会话，不触发「登录已失效」
        if (!isCredentialFailure) {
          if (urlLooksLikeB2bApi(path)) {
            clearB2bToken()
            window.dispatchEvent(new CustomEvent('moje-b2b-auth-expired'))
          }
          if (urlLooksLikeCPortalApi(path)) {
            localStorage.removeItem('moje_c_portal_token')
            window.dispatchEvent(new CustomEvent('moje-c-portal-auth-expired'))
          }
        }
      }

      if (!reqConfig?.skipGlobalError) {
        message.error(errorMessage)
      }
    } else if (!error.config?.skipGlobalError) {
      message.error('网络请求失败，请检查网络连接')
    }
    return Promise.reject(error)
  }
)

export interface ResponseData<T = any> {
  code: number
  message: string
  data: T
}

export default instance
