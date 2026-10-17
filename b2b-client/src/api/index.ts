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

export interface QuotationPublicDto {
  laborCost?: number
  additionalLaborCost?: number
  totalAmount?: number
  finalized: boolean
}

export interface ModelFilePublicDto {
  fileName?: string
  fileUrl: string
}

export interface OrderEventDto {
  id: number
  orderId: number
  eventType: string
  actorType: string
  actorId: number
  actorRole?: string
  actorName?: string
  title?: string
  content?: string
  reason?: string
  fileIds?: number[]
  createdAt?: string
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
  designApproved?: boolean | null
  modelApproved?: boolean | null
  quotation?: QuotationPublicDto | null
  modelFiles?: ModelFilePublicDto[]
  shipment?: OrderShipmentDto | null
}

export interface OrderShipmentDto {
  id: number
  orderId: number
  trackingNumber: string
  carrierCode?: number | null
  carrierName?: string | null
  status?: string | null
  statusLabel?: string | null
  events: Array<{
    time?: string | null
    location?: string | null
    description?: string | null
    statusCode?: string | null
  }>
  queryUrl?: string | null
  shippedAt?: string | null
  deliveredAt?: string | null
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

export function portalOrderEvents(orderId: number): Promise<OrderEventDto[]> {
  return request.get(`/portal/c/orders/${orderId}/events`)
}

export function portalConfirmOrder(orderId: number, eventType: string): Promise<void> {
  return request.post(`/portal/c/orders/${orderId}/confirm`, { eventType })
}

export function portalRejectOrder(orderId: number, eventType: string, reason: string): Promise<void> {
  return request.post(`/portal/c/orders/${orderId}/reject`, { eventType, reason })
}

export function portalConfirmDelivery(orderId: number): Promise<void> {
  return request.post(`/portal/c/orders/${orderId}/confirm-delivery`, {})
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
  blocks?: HomeBlockDto[]
}

export interface HomeBlockDto {
  id: number
  scope: string
  section: string
  blockKey: string
  sortOrder: number
  enabled: boolean
  content?: {
    texts?: Record<string, string>
    image?: string
    images?: string[]
    extra?: Record<string, unknown>
  } | null
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

// ---------- 站内聊天 ----------
export interface Conversation {
  id: number
  orderId: number
  orderNumber?: string
  title?: string
  orderStatus?: string
  orderStatusLabel?: string
  serviceType?: string
  serviceTypeLabel?: string
  lastMessage?: string
  lastMessageAt?: string
  unreadCount: number
  createdAt?: string
}

export interface ConversationMember {
  id: number
  accountType: string
  accountId: number
  role?: string
  displayName?: string
  lastReadMessageId?: number
  joinedAt?: string
}

export interface ConversationMessage {
  id: number
  conversationId: number
  senderType: string
  senderId: number
  role?: string
  displayName?: string
  msgType: string
  content?: string
  translatedContent?: string
  translatedLang?: string
  fileIds?: number[]
  eventId?: number
  event?: OrderEventCard
  createdAt?: string
}

export interface OrderEventCard {
  id: number
  orderId: number
  eventType: string
  actorType?: string
  actorId?: number
  actorRole?: string
  actorName?: string
  title?: string
  content?: string
  reason?: string
  fileIds?: number[]
  images?: string[]
  actionable?: boolean
  resolution?: string
  resolutionLabel?: string
  createdAt?: string
}

export function listConversations(): Promise<Conversation[]> {
  return request.get('/conversations')
}

export function ensureConversation(orderId: number): Promise<Conversation> {
  return request.post(`/conversations/by-order/${orderId}`)
}

export function getConversationMessages(conversationId: number): Promise<ConversationMessage[]> {
  return request.get(`/conversations/${conversationId}/messages`)
}

export function getConversationMembers(conversationId: number): Promise<ConversationMember[]> {
  return request.get(`/conversations/${conversationId}/members`)
}

export function sendConversationMessage(conversationId: number, content: string): Promise<ConversationMessage> {
  return request.post(`/conversations/${conversationId}/messages`, { content, msgType: 'text' })
}

export function markConversationRead(conversationId: number): Promise<void> {
  return request.post(`/conversations/${conversationId}/read`, {})
}

export function translateMessage(messageId: number, targetLang: string): Promise<ConversationMessage> {
  return request.post(`/conversations/messages/${messageId}/translate`, { targetLang })
}
