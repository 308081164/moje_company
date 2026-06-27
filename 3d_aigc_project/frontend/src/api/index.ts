/**
 * API请求封装模块
 */
import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'

export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface TaskInfo {
  task_id: string
  input_file: string
  status: TaskStatus
  created_at: string
  updated_at: string
  output_format?: string
  result_file?: string
  error_message?: string
  progress?: number
  prompt?: string
  inlay_file?: string
}

export interface TaskDetail extends TaskInfo {}

export interface InlayInfo {
  id: string
  filename: string
  file_size: number
  file_format: string
  created_at: string
  thumbnail_url?: string
  has_preview?: boolean
  mesh_ready?: boolean
}

export interface InlayPageResult {
  items: InlayInfo[]
  total: number
  page: number
  page_size: number
  format_counts: Record<string, number>
}

export interface InlayListParams {
  keyword?: string
  format?: string
  category?: string
  has_preview?: boolean
  mesh_ready?: boolean
  page?: number
  page_size?: number
}

export interface InlayCategoryNode {
  label: string
  value: string
  count: number
  children?: InlayCategoryNode[]
}

export interface GenerateParams {
  prompt?: string
  output_format: 'OBJ' | 'GLB' | 'STL'
  inlay_structure_filename?: string
  inlay_type?: string
  gem_type?: string
  multi_view_enabled?: boolean
}

export type ViewFace = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'
export type ViewImages = Partial<Record<ViewFace, File>>

export interface PreprocessResult {
  sessionId: string
  processedPath: string
  previewUrl: string
  originalPath?: string
}

export interface ViewCropItem {
  id: string
  x: number
  y: number
  width: number
  height: number
  guess?: string | null
  previewUrl: string
}

export interface SplitMultiViewResult {
  sessionId: string
  sourceWidth: number
  sourceHeight: number
  sourcePreviewUrl?: string
  crops: ViewCropItem[]
}

const apiClient: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 300000,
})

apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    // Binary responses (preview/download) are not JSON envelopes
    if (response.config.responseType === 'blob' || response.config.responseType === 'arraybuffer') {
      return response
    }
    const { data } = response
    if (data.code !== 0 && data.code !== 200) {
      ElMessage.error(data.message || '请求失败')
      return Promise.reject(new Error(data.message || '请求失败'))
    }
    return response
  },
  (error) => {
    ElMessage.error(error.response?.data?.message || error.message || '网络错误')
    return Promise.reject(error)
  }
)

export async function splitMultiViewSheet(
  imageFile: File
): Promise<ApiResponse<SplitMultiViewResult>> {
  const formData = new FormData()
  formData.append('image', imageFile)
  const response = await apiClient.post<ApiResponse<SplitMultiViewResult>>(
    '/preprocess/split-multi-view',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 }
  )
  return response.data
}

export async function removeBackground(imageFile: File): Promise<ApiResponse<PreprocessResult>> {
  const formData = new FormData()
  formData.append('image', imageFile)
  const response = await apiClient.post<ApiResponse<PreprocessResult>>(
    '/preprocess/remove-background',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 }
  )
  return response.data
}

export async function fetchPreprocessPreview(previewUrl: string): Promise<Blob> {
  const path = previewUrl.startsWith('/api') ? previewUrl.slice(4) : previewUrl
  const response = await apiClient.get(path, { responseType: 'blob' })
  return response.data as Blob
}

export async function savePreprocess(
  sessionId: string,
  imageFile: File | Blob
): Promise<ApiResponse<PreprocessResult>> {
  const formData = new FormData()
  const file =
    imageFile instanceof File
      ? imageFile
      : new File([imageFile], 'no_bg.png', { type: 'image/png' })
  formData.append('image', file)
  const response = await apiClient.post<ApiResponse<PreprocessResult>>(
    `/preprocess/save/${sessionId}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }
  )
  return response.data
}

export async function generateImageTo3d(
  imageFile: File | null,
  params: GenerateParams,
  viewImages?: ViewImages
): Promise<ApiResponse<TaskInfo>> {
  const formData = new FormData()
  if (imageFile) {
    formData.append('image', imageFile)
  }
  if (params.prompt) formData.append('prompt', params.prompt)
  formData.append('output_format', params.output_format)
  if (params.inlay_structure_filename) {
    formData.append('inlay_structure_filename', params.inlay_structure_filename)
  }
  if (params.multi_view_enabled) {
    formData.append('multi_view_enabled', 'true')
    if (viewImages) {
      for (const [face, file] of Object.entries(viewImages)) {
        if (file) {
          formData.append(`${face}_image`, file)
        }
      }
    }
  }
  const response = await apiClient.post<ApiResponse<TaskInfo>>(
    '/generate/image-to-3d',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return response.data
}

export async function conditionGenerate(
  imageFile: File,
  params: GenerateParams
): Promise<ApiResponse<TaskInfo>> {
  const formData = new FormData()
  formData.append('image', imageFile)
  if (!params.inlay_structure_filename) {
    throw new Error('请选择镶嵌结构')
  }
  formData.append('inlay_structure_filename', params.inlay_structure_filename)
  if (params.prompt) formData.append('prompt', params.prompt)
  formData.append('output_format', params.output_format)
  if (params.inlay_type) formData.append('inlay_type', params.inlay_type)
  if (params.gem_type) formData.append('gem_type', params.gem_type)

  const response = await apiClient.post<ApiResponse<TaskInfo>>(
    '/generate/condition-generate',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return response.data
}

export async function getInlayList(params?: InlayListParams): Promise<ApiResponse<InlayPageResult>> {
  const response = await apiClient.get<ApiResponse<InlayPageResult>>('/inlay/list', { params })
  return response.data
}

export async function getInlayFormats(): Promise<ApiResponse<Record<string, number>>> {
  const response = await apiClient.get<ApiResponse<Record<string, number>>>('/inlay/formats')
  return response.data
}

export async function refreshInlayIndex(): Promise<ApiResponse<{ total: number; with_preview: number; without_preview: number }>> {
  const response = await apiClient.post<ApiResponse<{ total: number; with_preview: number; without_preview: number }>>(
    '/inlay/refresh'
  )
  return response.data
}

export async function getInlayCategories(): Promise<ApiResponse<InlayCategoryNode[]>> {
  const response = await apiClient.get<ApiResponse<InlayCategoryNode[]>>('/inlay/categories')
  return response.data
}

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

export async function getTaskDetail(taskId: string): Promise<ApiResponse<TaskDetail>> {
  const response = await apiClient.get<ApiResponse<TaskDetail>>(`/tasks/${taskId}`)
  return response.data
}

export async function downloadResult(taskId: string): Promise<Blob> {
  const response = await apiClient.get(`/tasks/${taskId}/download`, { responseType: 'blob' })
  return response.data as Blob
}

export async function deleteTask(taskId: string): Promise<ApiResponse<null>> {
  const response = await apiClient.delete<ApiResponse<null>>(`/tasks/${taskId}`)
  return response.data
}

export interface SystemInfoData {
  gpu_info?: string
  model_version?: string
  ai_service_available?: boolean
  status?: string
}

export async function getSystemInfo(): Promise<ApiResponse<SystemInfoData>> {
  const response = await apiClient.get<ApiResponse<SystemInfoData>>('/system/info')
  return response.data
}

export default apiClient
