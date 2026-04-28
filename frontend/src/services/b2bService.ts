import api from './api';

export interface B2BClientResponse {
  id: number;
  contact: string;
  companyName: string;
  contactPerson: string;
  email: string;
  createdAt: string;
}

export interface B2BOrderAccessDto {
  orderId: number;
  orderNumber: string;
  accessUrl: string;
  qrcodeBase64: string;
  expireTime: string;
}

export interface ModelerWorkStatusDto {
  userId: number;
  username: string;
  realName: string;
  workMode: string;
  status: string;
  todoCount: number;
  pauseReason: string;
}

export interface B2BOrderCreateRequest {
  contact: string;
  password?: string;
  companyName?: string;
  contactPerson?: string;
  email?: string;
  basicRequirements: string;
  styleInfo: string;
  materialInfo: string;
  depositAmount?: number;
  sourceDetail?: string;
}

export const b2bService = {
  register: async (data: { contact: string; password: string; companyName?: string; contactPerson?: string; email?: string }) => {
    return api.post<B2BClientResponse>('/b2b/client/register', data);
  },

  login: async (data: { contact: string; password: string }) => {
    return api.post<B2BClientResponse>('/b2b/client/login', data);
  },

  createOrder: async (data: B2BOrderCreateRequest) => {
    return api.post<B2BOrderAccessDto>('/b2b/order/create', data);
  },

  getOrderByToken: async (token: string) => {
    return api.get(`/b2b/order/${token}`);
  },

  getClientOrders: async (clientId: number) => {
    return api.get(`/b2b/client/orders?clientId=${clientId}`);
  },

  getModelerStatus: async () => {
    return api.get<ModelerWorkStatusDto>('/b2b/modeler/status');
  },

  updateWorkMode: async (mode: string) => {
    return api.put<ModelerWorkStatusDto>('/b2b/modeler/work-mode', { mode });
  },

  updateWorkStatus: async (status: string, reason?: string) => {
    return api.put<ModelerWorkStatusDto>('/b2b/modeler/work-status', { status, reason });
  },

  getAllModelerStatus: async () => {
    return api.get<ModelerWorkStatusDto[]>('/b2b/modeler/all-status');
  },
};

export default b2bService;