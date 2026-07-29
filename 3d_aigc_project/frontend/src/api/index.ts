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

export type TaskStatus = 'pending' | 'queued' | 'processing' | 'completed' | 'failed'

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
  preview_url?: string
  input_preview_url?: string
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
  mesh_method?: string
  mesh_is_proxy?: boolean
  /** v2: legacy 相对路径，融合链路兼容 */
  legacy_path?: string
  preview_method?: string
  preview_quality?: number
  tags?: string[]
}

export interface InlayV2Info extends InlayInfo {
  display_name?: string
  primary_format?: string
  legacy_path?: string
  mesh_glb_url?: string
  mesh_url?: string
  updated_at?: string
  category?: { id: string; name: string }
}

export interface InlayV2ListParams {
  q?: string
  category_id?: string
  tags?: string
  inlay_type?: string
  mesh_ready?: boolean
  has_preview?: boolean
  preview_method?: string
  stone_diameter_min?: number
  stone_diameter_max?: number
  status?: string
  sort?: string
  page?: number
  page_size?: number
  legacy_path?: string
}

export interface InlayV2Stats {
  total: number
  mesh_ready: number
  has_preview: number
  by_format?: Record<string, number>
  by_preview_method?: Record<string, number>
}

export interface InlayTag {
  id: string
  name: string
  color?: string
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
  category?: string
  tags?: string
  has_preview?: boolean
  mesh_ready?: boolean
  page?: number
  page_size?: number
}

const INLAY_CATEGORY_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** 与独立镶嵌结构库一致：UUID 走 category_id，legacy 路径前缀走 q */
function resolveInlayCategoryParams(
  keyword?: string,
  category?: string
): Pick<InlayV2ListParams, 'q' | 'category_id'> {
  const qParts: string[] = []
  if (keyword?.trim()) qParts.push(keyword.trim())

  let categoryId: string | undefined
  if (category?.trim()) {
    if (INLAY_CATEGORY_UUID_RE.test(category.trim())) {
      categoryId = category.trim()
    } else {
      qParts.push(category.trim())
    }
  }

  return {
    q: qParts.length ? qParts.join(' ') : undefined,
    category_id: categoryId,
  }
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
  /** fast=急速模式 quality=高质量模式 */
  generation_mode?: 'fast' | 'quality'
}

export type ViewFace = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'
export type ViewImages = Partial<Record<ViewFace, File>>

export interface PreprocessResult {
  sessionId: string
  processedPath: string
  previewUrl: string
  originalPath?: string
  gemCoverageRatio?: number
  gemPreset?: string
  segmentMethod?: string
  repaintMethod?: string
  maskPreviewUrl?: string
}

export interface GemRepaintOptions {
  sessionId?: string
  prompt?: string
  strength?: number
  useMask?: boolean
  mask?: File | Blob
  maskDilatePx?: number
  preserveEdges?: boolean
  seed?: number
  sensitivity?: number
  /** 可选：高级模式下手动 SAM 点选 */
  points?: GemPoint[]
}

export interface GemPoint {
  x: number
  y: number
  /** 1=宝石前景 0=排除区域 */
  label: number
}

export interface GemSegmentResult {
  sessionId: string
  gemCoverageRatio?: number
  maskPreviewUrl: string
  segmentEngine?: string
}

export type GemPreset = 'ruby' | 'sapphire' | 'emerald' | 'diamond' | 'amethyst'

export interface GemFlattenOptions {
  gemPreset?: GemPreset
  customColor?: string
  sensitivity?: number
  preserveEdges?: boolean
}

export interface ViewCropItem {
  id: string
  x: number
  y: number
  width: number
  height: number
  guess?: string | null
  /** 后端自动切分预览地址；手动切分块可为空 */
  previewUrl?: string
  /** 是否为用户手动绘制的切分框 */
  manual?: boolean
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
    const silent = (response.config as { silent?: boolean }).silent
    if (data.code !== 0 && data.code !== 200) {
      if (!silent) {
        ElMessage.error(data.message || '请求失败')
      }
      return Promise.reject(new Error(data.message || '请求失败'))
    }
    return response
  },
  (error) => {
    const silent = (error.config as { silent?: boolean } | undefined)?.silent
    if (!silent) {
      ElMessage.error(error.response?.data?.message || error.message || '网络错误')
    }
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

export async function gemFlatten(
  imageFile: File,
  options: GemFlattenOptions = {}
): Promise<ApiResponse<PreprocessResult>> {
  const formData = new FormData()
  formData.append('image', imageFile)
  formData.append('gem_preset', options.gemPreset ?? 'ruby')
  if (options.customColor) formData.append('custom_color', options.customColor)
  if (options.sensitivity != null) {
    formData.append('sensitivity', String(options.sensitivity))
  }
  formData.append('preserve_edges', String(options.preserveEdges !== false))
  const response = await apiClient.post<ApiResponse<PreprocessResult>>(
    '/preprocess/gem-flatten',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 }
  )
  return response.data
}

export async function gemSegmentSam(
  imageFile: File,
  points: GemPoint[],
  sessionId?: string
): Promise<ApiResponse<GemSegmentResult>> {
  const formData = new FormData()
  formData.append('image', imageFile)
  formData.append('points_json', JSON.stringify(points))
  if (sessionId) formData.append('session_id', sessionId)
  const response = await apiClient.post<ApiResponse<GemSegmentResult>>(
    '/preprocess/gem-segment-sam',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 }
  )
  return response.data
}

export async function gemFlattenSam(
  imageFile: File,
  points: GemPoint[],
  options: GemFlattenOptions & { sessionId?: string } = {}
): Promise<ApiResponse<PreprocessResult>> {
  const formData = new FormData()
  formData.append('image', imageFile)
  formData.append('points_json', JSON.stringify(points))
  formData.append('gem_preset', options.gemPreset ?? 'ruby')
  if (options.customColor) formData.append('custom_color', options.customColor)
  formData.append('preserve_edges', String(options.preserveEdges !== false))
  if (options.sessionId) formData.append('session_id', options.sessionId)
  const response = await apiClient.post<ApiResponse<PreprocessResult>>(
    '/preprocess/gem-flatten-sam',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 }
  )
  return response.data
}

export async function gemRepaint(
  imageFile: File,
  options: GemRepaintOptions = {}
): Promise<ApiResponse<PreprocessResult>> {
  const formData = new FormData()
  formData.append('image', imageFile)
  const useMask = options.useMask !== false
  formData.append('use_mask', String(useMask))
  if (useMask && options.mask) {
    const maskFile =
      options.mask instanceof File
        ? options.mask
        : new File([options.mask], 'gem_mask.png', { type: 'image/png' })
    formData.append('mask', maskFile)
  }
  if (options.prompt) formData.append('prompt', options.prompt)
  formData.append('strength', String(options.strength ?? 0.20))
  if (options.sessionId) formData.append('session_id', options.sessionId)
  const response = await apiClient.post<ApiResponse<PreprocessResult>>(
    '/preprocess/gem-repaint',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300000 }
  )
  return response.data
}

/** @deprecated 请使用 gemRepaint（整图重绘，无需 SAM 点选） */
export async function gemRepaintSam(
  imageFile: File,
  points: GemPoint[],
  options: GemRepaintOptions = {}
): Promise<ApiResponse<PreprocessResult>> {
  return gemRepaint(imageFile, { ...options, points })
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
  if (params.generation_mode) {
    formData.append('generation_mode', params.generation_mode)
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
  if (params.generation_mode) formData.append('generation_mode', params.generation_mode)

  const response = await apiClient.post<ApiResponse<TaskInfo>>(
    '/generate/condition-generate',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return response.data
}

/** @deprecated v1 已下线，请使用 getInlayListUnified */
export async function getInlayList(params?: InlayListParams): Promise<ApiResponse<InlayPageResult>> {
  return getInlayListUnified(params)
}

/** v2 镶嵌库 API */
export async function getInlayV2List(params?: InlayV2ListParams): Promise<ApiResponse<InlayPageResult>> {
  const response = await apiClient.get<ApiResponse<InlayPageResult>>('/inlay/v2/items', { params })
  return response.data
}

export interface CreateInlayV2Params {
  source: File
  preview?: File
  mesh?: File
  display_name?: string
  category_id?: string
  tags?: string[]
  stone_diameter_mm?: number
  inlay_type?: string
}

/** 手动新建镶嵌条目（multipart 直传 storage） */
export async function createInlayV2Item(params: CreateInlayV2Params): Promise<ApiResponse<InlayV2Info>> {
  const form = new FormData()
  form.append('source', params.source)
  if (params.preview) form.append('preview', params.preview)
  if (params.mesh) form.append('mesh', params.mesh)
  if (params.display_name) form.append('display_name', params.display_name)
  if (params.category_id) form.append('category_id', params.category_id)
  if (params.tags?.length) form.append('tags', params.tags.join(','))
  if (params.stone_diameter_mm != null) form.append('stone_diameter_mm', String(params.stone_diameter_mm))
  if (params.inlay_type) form.append('inlay_type', params.inlay_type)

  const response = await apiClient.post<ApiResponse<InlayV2Info>>('/inlay/v2/items', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export async function getInlayV2Item(id: string): Promise<ApiResponse<InlayV2Info>> {
  const response = await apiClient.get<ApiResponse<InlayV2Info>>(`/inlay/v2/items/${id}`)
  return response.data
}

export async function getInlayV2Categories(): Promise<ApiResponse<InlayCategoryNode[]>> {
  const response = await apiClient.get<ApiResponse<InlayCategoryNode[]>>('/inlay/v2/categories')
  return response.data
}

export interface InlayCategory {
  id: string
  name: string
  parent_id?: string
}

export async function createInlayV2Category(body: {
  name: string
  parent_id?: string
}): Promise<ApiResponse<InlayCategory>> {
  const response = await apiClient.post<ApiResponse<InlayCategory>>('/inlay/v2/categories', body)
  return response.data
}

export async function getInlayV2Tags(): Promise<ApiResponse<InlayTag[]>> {
  const response = await apiClient.get<ApiResponse<InlayTag[]>>('/inlay/v2/tags')
  return response.data
}

export async function createInlayV2Tag(body: {
  name: string
  color?: string
}): Promise<ApiResponse<InlayTag>> {
  const response = await apiClient.post<ApiResponse<InlayTag>>('/inlay/v2/tags', body)
  return response.data
}

export async function getInlayV2Stats(): Promise<ApiResponse<InlayV2Stats>> {
  const response = await apiClient.get<ApiResponse<InlayV2Stats>>('/inlay/v2/stats')
  return response.data
}

export async function patchInlayV2Item(id: string, patch: Record<string, unknown>): Promise<ApiResponse<InlayV2Info>> {
  const response = await apiClient.patch<ApiResponse<InlayV2Info>>(`/inlay/v2/items/${id}`, patch)
  return response.data
}

export async function batchUpdateInlayV2(body: {
  ids: string[]
  category_id?: string
  add_tags?: string[]
  status?: string
}): Promise<ApiResponse<{ updated: number }>> {
  const response = await apiClient.post<ApiResponse<{ updated: number }>>('/inlay/v2/items/batch', body)
  return response.data
}

export async function deleteInlayV2Item(id: string): Promise<ApiResponse<null>> {
  const response = await apiClient.delete<ApiResponse<null>>(`/inlay/v2/items/${id}`)
  return response.data
}

export async function batchDeleteInlayV2(ids: string[]): Promise<ApiResponse<{ deleted: number }>> {
  const response = await apiClient.post<ApiResponse<{ deleted: number }>>('/inlay/v2/items/batch-delete', { ids })
  return response.data
}

export async function moveInlayV2Item(id: string, categoryId: string): Promise<ApiResponse<InlayV2Info>> {
  const response = await apiClient.post<ApiResponse<InlayV2Info>>(`/inlay/v2/items/${id}/move`, {
    category_id: categoryId,
  })
  return response.data
}

export async function regenerateInlayPreview(id: string): Promise<ApiResponse<{ job_id: string }>> {
  const response = await apiClient.post<ApiResponse<{ job_id: string }>>(`/inlay/v2/items/${id}/regenerate-preview`)
  return response.data
}

export async function convertInlayMesh(id: string): Promise<ApiResponse<{ job_id: string }>> {
  const response = await apiClient.post<ApiResponse<{ job_id: string }>>(`/inlay/v2/items/${id}/convert-mesh`)
  return response.data
}

export async function importLegacyInlay(dryRun = false): Promise<ApiResponse<Record<string, unknown>>> {
  const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
    `/inlay/v2/import/scan-legacy?dry_run=${dryRun}`
  )
  return response.data
}

export async function getInlayV2Config(): Promise<ApiResponse<Record<string, unknown>>> {
  const response = await apiClient.get<ApiResponse<Record<string, unknown>>>('/inlay/v2/config', {
    silent: true,
  } as Record<string, unknown>)
  return response.data
}

export function mapV2ItemToInlayInfo(raw: Record<string, unknown>): InlayInfo {
  const uuid = (raw.id as string) || ''
  const legacyPath = (raw.legacy_path as string) || (raw.legacyPath as string) || undefined
  return {
    id: uuid,
    filename: (raw.display_name as string) || (raw.displayName as string) || '',
    file_size: (raw.file_size_bytes as number) || (raw.fileSizeBytes as number) || 0,
    file_format: (raw.primary_format as string) || (raw.primaryFormat as string) || 'JCD',
    created_at: (raw.updated_at as string) || (raw.updatedAt as string) || '',
    thumbnail_url: (raw.thumbnail_url as string) || (raw.thumbnailUrl as string),
    has_preview: (raw.has_preview as boolean) ?? (raw.hasPreview as boolean),
    mesh_ready: (raw.mesh_ready as boolean) ?? (raw.meshReady as boolean),
    mesh_method: (raw.mesh_method as string) || (raw.meshMethod as string),
    mesh_is_proxy: (raw.mesh_is_proxy as boolean) ?? (raw.meshIsProxy as boolean),
    legacy_path: legacyPath,
    preview_method: (raw.preview_method as string) || (raw.previewMethod as string),
    preview_quality: (raw.preview_quality as number) || (raw.previewQuality as number),
    tags: raw.tags as string[] | undefined,
  }
}

/**
 * 镶嵌列表：与独立镶嵌结构库相同，仅使用 v2 `/api/inlay/v2/items`
 */
export async function getInlayListUnified(params?: InlayListParams): Promise<ApiResponse<InlayPageResult>> {
  const { q, category_id } = resolveInlayCategoryParams(params?.keyword, params?.category)
  const v2Params: InlayV2ListParams = {
    q,
    category_id,
    tags: params?.tags,
    mesh_ready: params?.mesh_ready,
    has_preview: params?.has_preview,
    page: params?.page,
    page_size: params?.page_size,
    sort: 'updated_at:desc',
  }

  const res = await getInlayV2List(v2Params)
  if (res.data?.items) {
    res.data.items = res.data.items.map((item) =>
      mapV2ItemToInlayInfo(item as unknown as Record<string, unknown>)
    )
  }

  return res as ApiResponse<InlayPageResult>
}

/** @deprecated v1 已下线；保留函数签名避免旧调用崩，改为返回 v2 格式统计 */
export async function getInlayFormats(): Promise<ApiResponse<Record<string, number>>> {
  const stats = await getInlayV2Stats()
  return {
    code: stats.code,
    message: stats.message,
    data: {
      ...(stats.data?.by_format || {}),
      MESH_READY: stats.data?.mesh_ready || 0,
    },
  }
}

/** 刷新页内列表（不再触发 v1 目录扫描索引） */
export async function refreshInlayIndex(): Promise<ApiResponse<{ total: number; with_preview: number; without_preview: number }>> {
  const stats = await getInlayV2Stats()
  return {
    code: stats.code,
    message: stats.message,
    data: {
      total: stats.data?.total || 0,
      with_preview: stats.data?.has_preview || 0,
      without_preview: Math.max(0, (stats.data?.total || 0) - (stats.data?.has_preview || 0)),
    },
  }
}

/** @deprecated v1 分类已下线；转发到 v2 */
export async function getInlayCategories(): Promise<ApiResponse<InlayCategoryNode[]>> {
  return getInlayV2Categories()
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
  const response = await apiClient.get<ApiResponse<SystemInfoData>>('/system/info', {
    silent: true,
    timeout: 8000,
  } as Record<string, unknown>)
  return response.data
}

export type MeshFormat = 'OBJ' | 'GLB' | 'STL'

export interface MeshConvertResult {
  sessionId: string
  sourceFormat: MeshFormat
  outputFormat: MeshFormat
  originalFilename?: string
  fileSize: number
  vertexCount: number
  faceCount: number
  downloadUrl: string
  previewUrl: string
}

export interface MeshConvertFormatsData {
  formats: MeshFormat[]
  matrix: Record<string, MeshFormat[]>
}

export async function getMeshConvertFormats(): Promise<ApiResponse<MeshConvertFormatsData>> {
  const response = await apiClient.get<ApiResponse<MeshConvertFormatsData>>('/mesh/convert/formats')
  return response.data
}

export async function convertMeshFormat(
  file: File,
  outputFormat: MeshFormat
): Promise<ApiResponse<MeshConvertResult>> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('output_format', outputFormat)
  const response = await apiClient.post<ApiResponse<MeshConvertResult>>('/mesh/convert', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export async function downloadConvertedMesh(sessionId: string): Promise<Blob> {
  const response = await apiClient.get(`/mesh/convert/${sessionId}/download`, {
    responseType: 'blob',
  })
  return response.data as Blob
}

export interface MeshComponentInfo {
  index: number
  face_count: number
  vertex_count: number
  bbox_min: number[]
  bbox_max: number[]
  extent: number[]
  volume_bbox: number
}

export async function sanitizeInlayMesh(
  id: string,
  selectPrimary = true
): Promise<ApiResponse<Record<string, unknown>>> {
  const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
    `/mesh/edit/inlay/${id}/sanitize`,
    null,
    { params: { select_primary: selectPrimary } }
  )
  return response.data
}

export async function splitInlayMeshComponents(
  id: string
): Promise<ApiResponse<{ components: MeshComponentInfo[] }>> {
  const response = await apiClient.post<ApiResponse<{ components: MeshComponentInfo[] }>>(
    `/mesh/edit/inlay/${id}/split-components`
  )
  return response.data
}

export async function cropInlayMesh(
  id: string,
  keepIndices: number[],
  outputFormat: 'obj' | 'glb' | 'stl' = 'glb'
): Promise<ApiResponse<Record<string, unknown>>> {
  const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
    `/mesh/edit/inlay/${id}/crop-and-save`,
    null,
    { params: { keep_indices: keepIndices.join(','), output_format: outputFormat } }
  )
  return response.data
}

export async function clipInlayMesh(
  id: string,
  origin: number[],
  normal: number[],
  keepPositive: boolean,
  save: boolean,
  outputFormat: 'obj' | 'glb' | 'stl' = 'glb'
): Promise<ApiResponse<Record<string, unknown>>> {
  const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
    `/mesh/edit/inlay/${id}/clip-plane`,
    null,
    {
      params: {
        origin: origin.join(','),
        normal: normal.join(','),
        keep_positive: keepPositive,
        save,
        output_format: outputFormat,
      },
    }
  )
  return response.data
}

export async function uploadInlayMesh(
  id: string,
  file: File,
  meshMethod = 'manual_upload'
): Promise<ApiResponse<InlayV2Info>> {
  const form = new FormData()
  form.append('file', file)
  form.append('mesh_method', meshMethod)
  form.append('mesh_is_proxy', 'false')
  const response = await apiClient.put<ApiResponse<InlayV2Info>>(`/inlay/v2/items/${id}/mesh`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export async function getInlayV2Jobs(
  status?: string,
  limit = 20
): Promise<ApiResponse<Array<{ id: string; status: string; job_type: string; inlay_id: string }>>> {
  const response = await apiClient.get<
    ApiResponse<Array<{ id: string; status: string; job_type: string; inlay_id: string }>>
  >('/inlay/v2/jobs', { params: { status, limit } })
  return response.data
}

export default apiClient
