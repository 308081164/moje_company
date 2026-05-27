import request from '@/utils/request'

export interface B2BOrderCreateRequest {
  contact?: string
  password?: string
  companyName?: string
  contactPerson?: string
  email?: string
  basicRequirements: string
  styleInfo?: string
  materialInfo?: string
}

export interface B2BLastOrderProfileDto {
  companyName?: string
  contactPerson?: string
  styleInfo?: string
  materialInfo?: string
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

export interface B2BClientLoginResponse {
  id: number
  contact: string
  companyName?: string
  contactPerson?: string
  email?: string
  accessToken: string
  expiresIn: number
  createdAt?: string
}

export interface B2BOrderAccessDto {
  orderId?: number
  orderNumber: string
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

export interface CustomerOrderRegistrationHintDto {
  orderId: number
  orderNumber: string
  displayTitle: string
  suggestedPhone?: string
  suggestedWechat?: string
  suggestedCustomerName?: string
}

export interface PortalCustomerLoginResponse {
  id: number
  contact: string
  displayName?: string
  accessToken: string
  expiresIn: number
  createdAt?: string
}

export interface PortalCustomerRegisterRequest {
  contact: string
  password: string
  displayName?: string
  viewToken?: string
}

export interface PortalCustomerLoginRequest {
  contact: string
  password: string
}

export interface PortalCustomerOrderListItemDto {
  orderId: number
  orderNumber: string
  displayTitle: string
  currentStatus: string
  currentStatusLabel: string
  createdAt?: string
}

export function createOrder(data: B2BOrderCreateRequest): Promise<B2BOrderAccessDto> {
  return request.post('/b2b/order/create', data)
}

export function createOrderWithFiles(
  data: B2BOrderCreateRequest,
  files: File[]
): Promise<B2BOrderAccessDto> {
  const formData = new FormData()
  formData.append('orderData', new Blob([JSON.stringify(data)], { type: 'application/json' }))
  for (const f of files) {
    formData.append('files', f)
  }
  return request.post('/b2b/order/create-with-files', formData)
}

export function getOrderByToken(token: string): Promise<unknown> {
  return request.get(`/b2b/order/${token}`)
}

export function loginClient(data: B2BClientLoginRequest): Promise<B2BClientLoginResponse> {
  return request.post('/b2b/client/login', data)
}

export function registerClient(data: B2BClientRegisterRequest): Promise<B2BClientLoginResponse> {
  return request.post('/b2b/client/register', data)
}

export function getClientOrders(params?: {
  portalStatus?: string
  from?: string
  to?: string
}): Promise<unknown[]> {
  return request.get('/b2b/client/orders', { params })
}

export function getLastOrderProfile(): Promise<B2BLastOrderProfileDto> {
  return request.get('/b2b/client/last-order-profile', { skipGlobalError: true })
}

export function b2bBindOrder(orderNumber: string, proofToken: string): Promise<void> {
  return request.post('/b2b/client/bind-order', { orderNumber, proofToken })
}

export function getCustomerOrderHint(viewToken: string): Promise<CustomerOrderRegistrationHintDto> {
  return request.get(`/public/customer-order/${encodeURIComponent(viewToken)}/hint`)
}

export function portalRegister(data: PortalCustomerRegisterRequest): Promise<PortalCustomerLoginResponse> {
  return request.post('/portal/c/account/register', data)
}

export function portalLogin(data: PortalCustomerLoginRequest): Promise<PortalCustomerLoginResponse> {
  return request.post('/portal/c/account/login', data)
}

export function portalBindViewToken(viewToken: string): Promise<void> {
  return request.post('/portal/c/account/bind-view-token', { viewToken })
}

export function portalBindOrder(orderNumber: string, proofToken: string): Promise<void> {
  return request.post('/portal/c/account/bind-order', { orderNumber, proofToken })
}

export function portalListOrders(): Promise<PortalCustomerOrderListItemDto[]> {
  return request.get('/portal/c/orders')
}

export function portalOrderSummary(orderId: number): Promise<CustomerOrderPublicDto> {
  return request.get(`/portal/c/orders/${orderId}/summary`)
}

export interface PortalImageDto {
  fileId: number
  url: string
  caption?: string | null
}

export interface PortalCategoryPublicDto {
  slug: string
  nameCn: string
  nameEn?: string | null
  description?: string | null
  coverUrl?: string | null
  visibleItemCount: number
  preview: PortalImageDto[]
}

export interface PortalHomePublicDto {
  heroTitle?: string | null
  heroSubtitle?: string | null
  aboutHtml?: string | null
  businessHours?: string | null
  contactPhone?: string | null
  contactWechat?: string | null
  contactEmail?: string | null
  address?: string | null
  carousel: PortalImageDto[]
  companyPhotos: PortalImageDto[]
  categories: PortalCategoryPublicDto[]
}

export function getPortalHome(): Promise<PortalHomePublicDto> {
  return request.get('/public/portal/home')
}

export interface PortalCategoryDetailPublicDto {
  slug: string
  nameCn: string
  nameEn?: string | null
  description?: string | null
  items: PortalImageDto[]
}

export function getPortalCategory(slug: string): Promise<PortalCategoryDetailPublicDto> {
  return request.get(`/public/portal/category/${encodeURIComponent(slug)}`)
}
