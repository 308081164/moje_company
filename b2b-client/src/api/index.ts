import request from '@/utils/request'

export interface B2BOrderCreateRequest {
  contact: string
  password?: string
  companyName?: string
  contactPerson?: string
  email?: string
  basicRequirements: string
  styleInfo?: string
  materialInfo?: string
  depositAmount?: number
  sourceDetail?: string
}

export interface B2BClientLoginRequest {
  contact: string
  password: string
}

export interface B2BClientRegisterRequest {
  contact: string
  password: string
  companyName?: string
  contactPerson?: string
  email?: string
}

export interface B2BClientResponse {
  id: number
  contact: string
  companyName?: string
  contactPerson?: string
  email?: string
}

export interface B2BOrderAccessDto {
  orderId?: number
  orderNumber: string
  /** 与 accessUrl 中路径段一致，供前端跳转 */
  token?: string
  accessUrl: string
  qrcodeBase64: string
  expireTime: string
}

export interface CustomerOrderPublicMilestoneDto {
  code: string
  label: string
  at: string
}

export interface CustomerOrderPublicDto {
  orderNumber: string
  displayTitle: string
  customerNameMasked?: string
  createdAt?: string
  currentStatus: string
  currentStatusLabel?: string
  firstDesignImageUrl?: string
  milestones?: CustomerOrderPublicMilestoneDto[]
}

export interface OrderInfoDto {
  id: number
  orderNumber: string
  status: string
  statusDescription: string
  customerPhone: string
  customerName: string
  source: string
  sourceDescription: string
  basicRequirements: string
  styleInfo: string
  materialInfo: string
  depositAmount?: number
  designPlanUrl?: string
  designPlanDescription?: string
  modelFileUrl?: string
  reviewResult?: string
  reviewComment?: string
  quotationAmount?: number
  quotationDetails?: string
  productionDetails?: string
  productionStatus?: string
  productionNotes?: string
  shippingTracking?: string
  internalNotes?: string
  createdAt: string
  updatedAt: string
}

export function createOrder(data: B2BOrderCreateRequest): Promise<B2BOrderAccessDto> {
  return request.post('/b2b/order/create', data)
}

/** 创建订单并上传附件（与后台 {@code /b2b/order/create-with-files} 一致） */
export function createOrderWithFiles(
  data: B2BOrderCreateRequest,
  files: File[]
): Promise<B2BOrderAccessDto> {
  const formData = new FormData()
  formData.append(
    'orderData',
    new Blob([JSON.stringify(data)], { type: 'application/json' })
  )
  for (const f of files) {
    formData.append('files', f)
  }
  return request.post('/b2b/order/create-with-files', formData)
}

export function getOrderByToken(token: string): Promise<OrderInfoDto> {
  return request.get(`/b2b/order/${token}`)
}

/** C 端客户凭 view_token 查看进度（公开接口，无需登录） */
export function getCustomerOrderPublic(token: string): Promise<CustomerOrderPublicDto> {
  return request.get(`/public/customer-order/${encodeURIComponent(token)}`)
}

export function loginClient(data: B2BClientLoginRequest): Promise<B2BClientResponse> {
  return request.post('/b2b/client/login', data)
}

export function registerClient(data: B2BClientRegisterRequest): Promise<B2BClientResponse> {
  return request.post('/b2b/client/register', data)
}

export function getClientOrders(clientId: number): Promise<OrderInfoDto[]> {
  return request.get('/b2b/client/orders', { params: { clientId } })
}
