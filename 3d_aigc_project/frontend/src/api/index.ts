/**
 * API请求封装模块
 * 基于axios的HTTP客户端，统一处理后端API接口调用
 */
import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'

// ==========================================
// 类型定义
// ==========================================

/** 通用API响应结构 */
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

/** 任务状态枚举 */
export type TaskStatus = 'waiting' | 'processing' | 'completed' | 'failed'

/** 任务信息 */
export interface TaskInfo {
  task_id: string
  input_file: string
  status: TaskStatus
  created_at: string
  updated_at: string
  output_format?: string
  result_file?: string
  error_message?: string
}

/** 任务详情 */
export interface TaskDetail extends TaskInfo {
  progress?: number
  prompt?: string
  inlay_file?: string
}

/** 镶嵌结构信息 */
export interface InlayInfo {
  id: string
  filename: string
  file_size: number
  file_format: string
  created_at: string
  thumbnail_url?: string
}

/** 系统信息 */
export interface SystemInfo {
  gpu_info: string
  gpu_memory: string
  model_version: string
  cuda_available: boolean
  status: string
}

/** 生成参数 */
export interface GenerateParams {
  prompt?: string
  output_format: 'OBJ' | 'GLB' | 'STL'
}

// ==========================================
// Axios实例创建
// ==========================================

const apiClient: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 300000, // 5分钟超时（3D生成耗时较长）
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 可在此处添加token等认证信息
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const { data } = response
    // 业务状态码检查
    if (data.code !== 0 && data.code !== 200) {
      ElMessage.error(data.message || '请求失败')
      return Promise.reject(new Error(data.message || '请求失败'))
    }
    return response
  },
  (error) => {
    // HTTP错误处理
    let message = '网络错误，请稍后重试'
    if (error.response) {
      const status = error.response.status
      switch (status) {
        case 400:
          message = '请求参数错误'
          break
        case 401:
          message = '未授权，请重新登录'
          break
        case 404:
          message = '请求的资源不存在'
          break
        case 422:
          message = error.response.data?.detail || '数据验证失败'
          break
        case 500:
          message = '服务器内部错误'
          break
        case 503:
          message = '服务暂时不可用，请稍后重试'
          break
        default:
          message = `请求失败 (${status})`
      }
    } else if (error.code === 'ECONNABORTED') {
      message = '请求超时，请稍后重试'
    }
    ElMessage.error(message)
    return Promise.reject(error)
  }
)

// ==========================================
// API接口定义
// ==========================================

/**
 * 图片生成3D模型
 * @param imageFile 设计图文件
 * @param params 生成参数（prompt、输出格式等）
 * @returns 任务信息
 */
export async function generateImageTo3d(
  imageFile: File,
  params: GenerateParams
): Promise<ApiResponse<TaskInfo>> {
  const formData = new FormData()
  formData.append('image', imageFile)
  if (params.prompt) {
    formData.append('prompt', params.prompt)
  }
  formData.append('output_format', params.output_format)

  const response = await apiClient.post<ApiResponse<TaskInfo>>(
    '/generate/image-to-3d',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  )
  return response.data
}

/**
 * 条件生成3D模型（带镶嵌结构）
 * @param imageFile 设计图文件
 * @param inlayFile 镶嵌结构文件
 * @param params 生成参数
 * @returns 任务信息
 */
export async function conditionGenerate(
  imageFile: File,
  inlayFile: File,
  params: GenerateParams
): Promise<ApiResponse<TaskInfo>> {
  const formData = new FormData()
  formData.append('image', imageFile)
  formData.append('inlay', inlayFile)
  if (params.prompt) {
    formData.append('prompt', params.prompt)
  }
  formData.append('output_format', params.output_format)

  const response = await apiClient.post<ApiResponse<TaskInfo>>(
    '/generate/condition',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  )
  return response.data
}

/**
 * 获取镶嵌结构列表
 * @returns 镶嵌结构列表
 */
export async function getInlayList(): Promise<ApiResponse<InlayInfo[]>> {
  const response = await apiClient.get<ApiResponse<InlayInfo[]>>('/inlay/list')
  return response.data
}

/**
 * 获取任务列表
 * @param page 页码
 * @param pageSize 每页数量
 * @returns 任务列表（分页）
 */
export async function getTaskList(
  page: number = 1,
  pageSize: number = 20
): Promise<ApiResponse<{ tasks: TaskInfo[]; total: number }>> {
  const response = await apiClient.get<ApiResponse<{ tasks: TaskInfo[]; total: number }>>(
    '/tasks',
    { params: { page, page_size: pageSize } }
  )
  return response.data
}

/**
 * 获取任务详情
 * @param taskId 任务ID
 * @returns 任务详情
 */
export async function getTaskDetail(
  taskId: string
): Promise<ApiResponse<TaskDetail>> {
  const response = await apiClient.get<ApiResponse<TaskDetail>>(
    `/tasks/${taskId}`
  )
  return response.data
}

/**
 * 下载任务结果文件
 * @param taskId 任务ID
 * @returns Blob文件数据
 */
export async function downloadResult(taskId: string): Promise<Blob> {
  const response = await apiClient.get(`/tasks/${taskId}/download`, {
    responseType: 'blob',
  })
  return response.data as Blob
}

/**
 * 删除任务
 * @param taskId 任务ID
 */
export async function deleteTask(
  taskId: string
): Promise<ApiResponse<null>> {
  const response = await apiClient.delete<ApiResponse<null>>(
    `/tasks/${taskId}`
  )
  return response.data
}

/**
 * 获取系统信息
 * @returns 系统状态信息
 */
export async function getSystemInfo(): Promise<ApiResponse<SystemInfo>> {
  const response = await apiClient.get<ApiResponse<SystemInfo>>('/system/info')
  return response.data
}

export default apiClient
