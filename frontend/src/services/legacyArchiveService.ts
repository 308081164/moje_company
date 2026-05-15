import api from './api';

export type LegacySegment = 'B2B' | 'C2C' | 'UNKNOWN';

export interface LegacyOrderArchive {
  id: number;
  archiveCode: string;
  segment: LegacySegment;
  customerName?: string | null;
  customerPhone?: string | null;
  customerWechat?: string | null;
  orderDate?: string | null;
  completedDate?: string | null;
  styleSummary?: string | null;
  materialSummary?: string | null;
  requirements?: string | null;
  designNotes?: string | null;
  modelingNotes?: string | null;
  quotationNotes?: string | null;
  attachmentsJson?: string | null;
  internalRemark?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdByName?: string | null;
}

export const legacyArchiveService = {
  async page(params: { page: number; size: number; keyword?: string; segment?: LegacySegment }) {
    return api.get('/admin/legacy-order-archives', { params });
  },

  async get(id: number): Promise<LegacyOrderArchive> {
    return api.get(`/admin/legacy-order-archives/${id}`);
  },

  async create(body: Record<string, unknown>): Promise<LegacyOrderArchive> {
    return api.post('/admin/legacy-order-archives', body);
  },

  async update(id: number, body: Record<string, unknown>): Promise<LegacyOrderArchive> {
    return api.put(`/admin/legacy-order-archives/${id}`, body);
  },
};
