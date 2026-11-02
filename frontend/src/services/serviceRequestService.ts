import api from './api';

export type ServiceRequestType = 'COMPLAINT' | 'REFUND';
export type ServiceRequestStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED' | 'CANCELLED';

export interface CustomerServiceRequest {
  id: number;
  orderId: number;
  orderNumber?: string | null;
  type: ServiceRequestType | string;
  status: ServiceRequestStatus | string;
  category?: string | null;
  reason: string;
  requestedAmount?: number | null;
  staffNote?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  resolvedAt?: string | null;
}

export interface ServiceRequestResolveBody {
  status: 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';
  staffNote?: string;
}

export const serviceRequestService = {
  listOpen(): Promise<CustomerServiceRequest[]> {
    return api.get('/orders/service-requests/open');
  },
  listByOrder(orderId: number): Promise<CustomerServiceRequest[]> {
    return api.get(`/orders/${orderId}/service-requests`);
  },
  resolve(requestId: number, body: ServiceRequestResolveBody): Promise<CustomerServiceRequest> {
    return api.patch(`/orders/service-requests/${requestId}`, body);
  },
};
