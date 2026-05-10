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
  orderNumber: string
  accessUrl: string
  qrcodeBase64: string
  expireTime: string
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

export function loginClient(data: B2BClientLoginRequest): Promise<B2BClientResponse> {
  return request.post('/b2b/client/login', data)
}

export function registerClient(data: B2BClientRegisterRequest): Promise<B2BClientResponse> {
  return request.post('/b2b/client/register', data)
}

export function getClientOrders(clientId: number): Promise<OrderInfoDto[]> {
  return request.get('/b2b/client/orders', { params: { clientId } })
}
