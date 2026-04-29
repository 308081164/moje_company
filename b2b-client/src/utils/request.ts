import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { message } from 'ant-design-vue'

const instance: AxiosInstance = axios.create({
  baseURL: (import.meta as any).env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json;charset=utf-8'
  }
})

instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
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
      const { status, data } = error.response
      const errorMessage = data?.message || `请求失败 (${status})`
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
