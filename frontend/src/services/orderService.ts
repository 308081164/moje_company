import api from './api';
import { downloadWithAuth } from '@/utils/download';
import {
  OrderInfo,
  OrderCreateRequest,
  OrderUpdateRequest,
  OrderDesignUpdateRequest,
  OrderModelUpdateRequest,
  OrderReviewUpdateRequest,
  OrderQuotationUpdateRequest,
  OrderStatusChangeRequest,
  OrderAssignRequest,
  OrderQueryParams,
  OrderStatistics,
  EmployeeWorkStatistics,
  OrderReminder,
  OrderOperationLog,
  PaginatedResponse,
  FileInfo,
  ProcessInfo,
  StoneInfo,
  OrderDraftFromChatImageResponse,
} from '@/types/order';

// 订单服务
export const orderService = {
  // 获取订单列表
  async getOrders(params?: OrderQueryParams): Promise<PaginatedResponse<OrderInfo>> {
    try {
      const response = await api.get<PaginatedResponse<OrderInfo>>('/orders', { params });
      return response;
    } catch (error) {
      console.error('获取订单列表失败:', error);
      throw error;
    }
  },

  /** 设计师工作台 */
  async workbenchDesignerTodo(page: number, size: number, isB2b?: boolean): Promise<PaginatedResponse<OrderInfo>> {
    return api.get('/orders/workbench/designer/todo', { params: { page, size, isB2b } });
  },
  async workbenchDesignerDone(page: number, size: number, isB2b?: boolean): Promise<PaginatedResponse<OrderInfo>> {
    return api.get('/orders/workbench/designer/done', { params: { page, size, isB2b } });
  },
  /** 建模师工作台 */
  async workbenchModelerTodo(page: number, size: number, isB2b?: boolean): Promise<PaginatedResponse<OrderInfo>> {
    return api.get('/orders/workbench/modeler/todo', { params: { page, size, isB2b } });
  },
  async workbenchModelerDone(page: number, size: number, isB2b?: boolean): Promise<PaginatedResponse<OrderInfo>> {
    return api.get('/orders/workbench/modeler/done', { params: { page, size, isB2b } });
  },
  /** 跟单员工作台 */
  async workbenchTrackerTodo(page: number, size: number, isB2b?: boolean): Promise<PaginatedResponse<OrderInfo>> {
    return api.get('/orders/workbench/tracker/todo', { params: { page, size, isB2b } });
  },
  async workbenchTrackerDone(page: number, size: number, isB2b?: boolean): Promise<PaginatedResponse<OrderInfo>> {
    return api.get('/orders/workbench/tracker/done', { params: { page, size, isB2b } });
  },
  
  // 获取订单详情
  async getOrderById(orderId: number): Promise<OrderInfo> {
    try {
      const response = await api.get<OrderInfo>(`/orders/${orderId}`);
      return response;
    } catch (error) {
      console.error('获取订单详情失败:', error);
      throw error;
    }
  },
  
  // 创建订单
  async createOrder(orderData: OrderCreateRequest): Promise<OrderInfo> {
    try {
      const response = await api.post<OrderInfo>('/orders', orderData);
      return response;
    } catch (error) {
      console.error('创建订单失败:', error);
      throw error;
    }
  },

  /** 上传聊天截图，通义千问识别并返回草稿字段（需管理员配置） */
  async draftFromChatImage(file: File): Promise<OrderDraftFromChatImageResponse> {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<OrderDraftFromChatImageResponse>('/orders/draft-from-chat-image', fd);
  },
  
  // 更新订单基本信息
  async updateOrder(orderId: number, orderData: OrderUpdateRequest): Promise<OrderInfo> {
    try {
      const response = await api.put<OrderInfo>(`/orders/${orderId}`, orderData);
      return response;
    } catch (error) {
      console.error('更新订单失败:', error);
      throw error;
    }
  },
  
  // 删除订单
  async deleteOrder(orderId: number): Promise<void> {
    try {
      await api.delete(`/orders/${orderId}`);
    } catch (error) {
      console.error('删除订单失败:', error);
      throw error;
    }
  },
  
  // 批量删除订单
  async deleteOrders(orderIds: number[]): Promise<void> {
    try {
      await api.delete('/orders/batch', { data: { orderIds } });
    } catch (error) {
      console.error('批量删除订单失败:', error);
      throw error;
    }
  },
  
  // 更新订单设计信息
  async updateOrderDesign(orderId: number, designData: OrderDesignUpdateRequest): Promise<OrderInfo> {
    try {
      const response = await api.put<OrderInfo>(`/orders/${orderId}/design`, designData);
      return response;
    } catch (error) {
      console.error('更新订单设计信息失败:', error);
      throw error;
    }
  },
  
  // 更新订单建模信息
  async updateOrderModel(orderId: number, modelData: OrderModelUpdateRequest): Promise<OrderInfo> {
    try {
      const response = await api.put<OrderInfo>(`/orders/${orderId}/model`, modelData);
      return response;
    } catch (error) {
      console.error('更新订单建模信息失败:', error);
      throw error;
    }
  },
  
  // 更新订单评审信息
  async updateOrderReview(orderId: number, reviewData: OrderReviewUpdateRequest): Promise<OrderInfo> {
    try {
      const response = await api.put<OrderInfo>(`/orders/${orderId}/review`, reviewData);
      return response;
    } catch (error) {
      console.error('更新订单评审信息失败:', error);
      throw error;
    }
  },
  
  // 更新订单报价信息
  async updateOrderQuotation(orderId: number, quotationData: OrderQuotationUpdateRequest): Promise<OrderInfo> {
    try {
      const response = await api.put<OrderInfo>(`/orders/${orderId}/quotation`, quotationData);
      return response;
    } catch (error) {
      console.error('更新订单报价信息失败:', error);
      throw error;
    }
  },
  
  // 变更订单状态
  async changeOrderStatus(orderId: number, statusData: OrderStatusChangeRequest): Promise<OrderInfo> {
    try {
      const response = await api.put<OrderInfo>(`/orders/${orderId}/status`, statusData);
      return response;
    } catch (error) {
      console.error('变更订单状态失败:', error);
      throw error;
    }
  },
  
  // 分配订单
  async assignOrder(orderId: number, assignData: OrderAssignRequest): Promise<OrderInfo> {
    try {
      const response = await api.put<OrderInfo>(`/orders/${orderId}/assign`, assignData);
      return response;
    } catch (error) {
      console.error('分配订单失败:', error);
      throw error;
    }
  },
  
  // 上传设计文件
  async uploadDesignFile(orderId: number, file: File, notes?: string): Promise<FileInfo> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (notes) {
        formData.append('notes', notes);
      }
      
      const response = await api.post<FileInfo>(
        `/orders/${orderId}/design/files`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response;
    } catch (error) {
      console.error('上传设计文件失败:', error);
      throw error;
    }
  },
  
  // 上传建模文件
  async uploadModelFile(orderId: number, file: File, notes?: string): Promise<FileInfo> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (notes) {
        formData.append('notes', notes);
      }
      
      const response = await api.post<FileInfo>(
        `/orders/${orderId}/model/files`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response;
    } catch (error) {
      console.error('上传建模文件失败:', error);
      throw error;
    }
  },
  
  // 删除文件
  async deleteFile(fileId: number): Promise<void> {
    try {
      await api.delete(`/files/${fileId}`);
    } catch (error) {
      console.error('删除文件失败:', error);
      throw error;
    }
  },
  
  // 获取文件列表
  async getOrderFiles(orderId: number, fileType?: string): Promise<FileInfo[]> {
    try {
      const params = fileType ? { fileType } : {};
      const response = await api.get<FileInfo[]>(`/orders/${orderId}/files`, { params });
      return response;
    } catch (error) {
      console.error('获取文件列表失败:', error);
      throw error;
    }
  },
  
  // 下载文件
  async downloadFile(fileId: number): Promise<Blob> {
    try {
      const response = await api.get(`/files/${fileId}/download`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('下载文件失败:', error);
      throw error;
    }
  },
  
  // 预览文件
  async previewFile(fileId: number): Promise<string> {
    try {
      const response = await api.get<string>(`/files/${fileId}/preview`);
      return response;
    } catch (error) {
      console.error('预览文件失败:', error);
      throw error;
    }
  },
  
  // 获取订单统计信息
  async getOrderStatistics(): Promise<OrderStatistics> {
    try {
      const response = await api.get<OrderStatistics>('/orders/statistics');
      return response;
    } catch (error) {
      console.error('获取订单统计信息失败:', error);
      throw error;
    }
  },
  
  // 获取员工工作统计
  async getEmployeeWorkStatistics(employeeId?: number): Promise<EmployeeWorkStatistics[]> {
    try {
      const params = employeeId ? { employeeId } : {};
      const response = await api.get<EmployeeWorkStatistics[]>('/orders/employee-statistics', { params });
      return response;
    } catch (error) {
      console.error('获取员工工作统计失败:', error);
      throw error;
    }
  },
  
  /** 导出订单 CSV（后端 OrderExportRequest：orderIds + 可选 config） */
  async exportOrdersCsv(orderIds: number[]): Promise<Blob> {
    const response = (await api.post(
      '/orders/export',
      { orderIds },
      { responseType: 'blob' }
    )) as unknown as { data: Blob };
    return response.data;
  },

  /** 浏览器下载：单订单 Markdown */
  async downloadOrderMarkdown(orderId: number): Promise<void> {
    await downloadWithAuth(`/orders/${orderId}/export`, `order-${orderId}.md`);
  },

  /** 浏览器下载：单订单 HTML */
  async downloadOrderHtml(orderId: number): Promise<void> {
    await downloadWithAuth(`/orders/${orderId}/export-html`, `order-${orderId}.html`);
  },
  
  // 批量导出订单文件
  async exportOrderFiles(orderIds: number[], fileTypes: string[]): Promise<Blob> {
    try {
      const response = await api.post('/orders/export-files', {
        orderIds,
        fileTypes,
      }, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('批量导出订单文件失败:', error);
      throw error;
    }
  },
  
  // 获取订单提醒
  async getOrderReminders(params?: {
    isRead?: boolean;
    startDate?: string;
    endDate?: string;
    page?: number;
    size?: number;
  }): Promise<PaginatedResponse<OrderReminder>> {
    try {
      const response = await api.get<PaginatedResponse<OrderReminder>>('/orders/reminders', { params });
      return response;
    } catch (error) {
      console.error('获取订单提醒失败:', error);
      throw error;
    }
  },
  
  // 标记提醒为已读
  async markReminderAsRead(reminderId: number): Promise<void> {
    try {
      await api.put(`/orders/reminders/${reminderId}/read`);
    } catch (error) {
      console.error('标记提醒为已读失败:', error);
      throw error;
    }
  },
  
  // 批量标记提醒为已读
  async markRemindersAsRead(reminderIds: number[]): Promise<void> {
    try {
      await api.put('/orders/reminders/batch-read', { reminderIds });
    } catch (error) {
      console.error('批量标记提醒为已读失败:', error);
      throw error;
    }
  },
  
  // 获取订单操作日志
  async getOrderOperationLogs(orderId: number, params?: {
    page?: number;
    size?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<OrderOperationLog>> {
    try {
      const response = await api.get<PaginatedResponse<OrderOperationLog>>(
        `/orders/${orderId}/operation-logs`,
        { params }
      );
      return response;
    } catch (error) {
      console.error('获取订单操作日志失败:', error);
      throw error;
    }
  },
  
  // 搜索订单
  async searchOrders(keyword: string, limit: number = 10): Promise<OrderInfo[]> {
    try {
      const response = await api.get<OrderInfo[]>('/orders/search', {
        params: { keyword, limit },
      });
      return response;
    } catch (error) {
      console.error('搜索订单失败:', error);
      throw error;
    }
  },
  
  // 获取待处理订单数量
  async getPendingOrderCounts(): Promise<{
    pendingDesign: number;
    pendingModel: number;
    pendingReview: number;
    pendingQuotation: number;
    pendingProduction: number;
    totalPending: number;
  }> {
    try {
      const response = await api.get('/orders/pending-counts');
      return response;
    } catch (error) {
      console.error('获取待处理订单数量失败:', error);
      throw error;
    }
  },
  
  // 获取本周已处理订单
  async getThisWeekProcessedOrders(): Promise<{
    processedOrders: number;
    completedOrders: number;
    averageProcessingTime: number;
  }> {
    try {
      const response = await api.get('/orders/week-processed');
      return response;
    } catch (error) {
      console.error('获取本周已处理订单失败:', error);
      throw error;
    }
  },
  
  // 获取工艺配置
  async getProcessConfig(): Promise<ProcessInfo[]> {
    try {
      const response = await api.get<ProcessInfo[]>('/orders/process-config');
      return response;
    } catch (error) {
      console.error('获取工艺配置失败:', error);
      throw error;
    }
  },
  
  // 更新工艺配置
  async updateProcessConfig(processes: ProcessInfo[]): Promise<ProcessInfo[]> {
    try {
      const response = await api.put<ProcessInfo[]>('/orders/process-config', processes);
      return response;
    } catch (error) {
      console.error('更新工艺配置失败:', error);
      throw error;
    }
  },
  
  // 获取材质配置
  async getMaterialConfig(): Promise<{ type: string; name: string; priceFormula: string }[]> {
    try {
      const response = await api.get('/orders/material-config');
      return response;
    } catch (error) {
      console.error('获取材质配置失败:', error);
      throw error;
    }
  },
  
  // 更新材质配置
  async updateMaterialConfig(materials: { type: string; name: string; priceFormula: string }[]): Promise<any> {
    try {
      const response = await api.put('/orders/material-config', materials);
      return response;
    } catch (error) {
      console.error('更新材质配置失败:', error);
      throw error;
    }
  },
  
  // 获取系统配置
  async getSystemConfig(): Promise<{
    designBuyoutPrice: number;
    certificatePrice: number;
    silverPriceFormula: string;
    goldPriceFormula: string;
  }> {
    try {
      const response = await api.get('/orders/system-config');
      return response;
    } catch (error) {
      console.error('获取系统配置失败:', error);
      throw error;
    }
  },
  
  // 更新系统配置
  async updateSystemConfig(config: {
    designBuyoutPrice?: number;
    certificatePrice?: number;
    silverPriceFormula?: string;
    goldPriceFormula?: string;
  }): Promise<any> {
    try {
      const response = await api.put('/orders/system-config', config);
      return response;
    } catch (error) {
      console.error('更新系统配置失败:', error);
      throw error;
    }
  },
  
  // 计算材质价格
  async calculateMaterialPrice(materialType: string, basePrice: number): Promise<number> {
    try {
      const response = await api.post<number>('/orders/calculate-material-price', {
        materialType,
        basePrice,
      });
      return response;
    } catch (error) {
      console.error('计算材质价格失败:', error);
      throw error;
    }
  },
  
  // 生成订单编号
  async generateOrderNumber(): Promise<string> {
    try {
      const response = await api.get<string>('/orders/generate-order-number');
      return response;
    } catch (error) {
      console.error('生成订单编号失败:', error);
      throw error;
    }
  },
  
  // 验证订单数据
  async validateOrderData(orderData: any): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const response = await api.post('/orders/validate', orderData);
      return response;
    } catch (error) {
      console.error('验证订单数据失败:', error);
      throw error;
    }
  },
  
  // 复制订单
  async copyOrder(orderId: number): Promise<OrderInfo> {
    try {
      const response = await api.post<OrderInfo>(`/orders/${orderId}/copy`);
      return response;
    } catch (error) {
      console.error('复制订单失败:', error);
      throw error;
    }
  },
  
  // 合并订单
  async mergeOrders(orderIds: number[]): Promise<OrderInfo> {
    try {
      const response = await api.post<OrderInfo>('/orders/merge', { orderIds });
      return response;
    } catch (error) {
      console.error('合并订单失败:', error);
      throw error;
    }
  },
  
  // 拆分订单
  async splitOrder(orderId: number, splitData: any): Promise<OrderInfo[]> {
    try {
      const response = await api.post<OrderInfo[]>(`/orders/${orderId}/split`, splitData);
      return response;
    } catch (error) {
      console.error('拆分订单失败:', error);
      throw error;
    }
  },
};