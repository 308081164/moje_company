import api from './api';

/** 管理员视角的独立站商城商品 */
export interface AdminStorefrontListing {
  id: number;
  sourceOrderId: number;
  title: string;
  description?: string | null;
  coverImageUrl?: string | null;
  salePrice: number;
  status: 'PUBLISHED' | 'PAUSED' | string;
  soldCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  sellerAccountId: number;
  sellerDisplayName: string;
  sellerContact?: string | null;
}

/** 管理员视角的商城订单（source=MARKETPLACE） */
export interface AdminStorefrontOrder {
  orderId: number;
  orderNumber: string;
  buyerName?: string | null;
  listingId?: number | null;
  listingTitle?: string | null;
  sellerAccountId?: number | null;
  sellerDisplayName?: string | null;
  salePrice?: number | null;
  productionFee?: number | null;
  shippingFee?: number | null;
  sellerPayout?: number | null;
  status?: string | null;
  statusLabel?: string | null;
  orderTime?: string | null;
  createdAt?: string | null;
}

/** 卖家概览（门户账号 + 上架/销量 + 钱包聚合） */
export interface AdminStorefrontSeller {
  accountId: number;
  displayName: string;
  contact?: string | null;
  email?: string | null;
  listingCount: number;
  publishedCount: number;
  soldCount: number;
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
}

/** 卖家提现申请记录（模拟即时到账，只读） */
export interface AdminStorefrontWithdrawal {
  id: number;
  accountId: number;
  sellerDisplayName: string;
  amount: number;
  status: string;
  remark?: string | null;
  createdAt?: string | null;
}

export interface AdminStorefrontListingUpdateBody {
  title?: string;
  description?: string;
  salePrice?: number;
  coverImageUrl?: string;
}

export interface PagedResult<T> {
  content: T[];
  totalElements: number;
  totalPages?: number;
  number?: number;
  size?: number;
}

export const storefrontAdminService = {
  // ---------- 商品管理 ----------
  async listings(params?: { status?: string; keyword?: string }): Promise<AdminStorefrontListing[]> {
    return api.get('/admin/storefront/listings', { params });
  },

  async updateListing(id: number, body: AdminStorefrontListingUpdateBody): Promise<AdminStorefrontListing> {
    return api.patch(`/admin/storefront/listings/${id}`, body);
  },

  async pauseListing(id: number): Promise<AdminStorefrontListing> {
    return api.post(`/admin/storefront/listings/${id}/pause`);
  },

  async republishListing(id: number): Promise<AdminStorefrontListing> {
    return api.post(`/admin/storefront/listings/${id}/republish`);
  },

  // ---------- 商城订单 ----------
  async orders(params: {
    page: number;
    size: number;
    status?: string;
    sellerId?: number;
    keyword?: string;
  }): Promise<PagedResult<AdminStorefrontOrder>> {
    return api.get('/admin/storefront/orders', { params });
  },

  // ---------- 卖家概览 / 提现记录 ----------
  async sellers(): Promise<AdminStorefrontSeller[]> {
    return api.get('/admin/storefront/sellers');
  },

  async withdrawals(): Promise<AdminStorefrontWithdrawal[]> {
    return api.get('/admin/storefront/withdrawals');
  },
};
