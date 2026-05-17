import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { message } from 'ant-design-vue'
import {
  clearB2bToken,
  getB2bTokenRaw,
  urlLooksLikeB2bApi,
  urlLooksLikeCPortalApi
} from '@/utils/b2bAuth'

const instance: AxiosInstance = axios.create({
  baseURL: (import.meta as any).env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json;charset=utf-8'
  }
})

instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const rawUrl = config.url || ''
    const base = config.baseURL != null ? String(config.baseURL) : ''
    const combined = /^https?:\/\//i.test(rawUrl) ? rawUrl : `${base}${rawUrl}`
    const pathForMatch = combined.split('?')[0] || rawUrl

    let bearer: string | null = null
    if (urlLooksLikeCPortalApi(pathForMatch) || urlLooksLikeCPortalApi(rawUrl)) {
      const t = localStorage.getItem('moje_c_portal_token')
      bearer = t?.trim() || null
    } else if (urlLooksLikeB2bApi(pathForMatch) || urlLooksLikeB2bApi(rawUrl)) {
      bearer = getB2bTokenRaw()
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
  (error) => {
    return Promise.reject(error)
  }
)

instance.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data
  },
  (error) => {
    if (error.response) {
      const { status, data, config } = error.response
      const errorMessage = data?.message || `请求失败 (${status})`
      if (status === 401 && config) {
        const url = String(config.url || '')
        const base = String(config.baseURL || '')
        const combined = /^https?:\/\//i.test(url) ? url : `${base}${url}`
        if (urlLooksLikeB2bApi(combined) || urlLooksLikeB2bApi(url)) {
          clearB2bToken()
          window.dispatchEvent(new CustomEvent('moje-b2b-auth-expired'))
        }
        if (urlLooksLikeCPortalApi(combined) || urlLooksLikeCPortalApi(url)) {
          localStorage.removeItem('moje_c_portal_token')
          window.dispatchEvent(new CustomEvent('moje-c-portal-auth-expired'))
        }
      }
      message.error(errorMessage)
    } else {
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
