// 订单来源枚举
export enum OrderSource {
  DOUYIN = 'DOUYIN',           // 抖音
  BILIBILI = 'BILIBILI',       // B站
  XIAOHONGSHU = 'XIAOHONGSHU', // 小红书
  TAOBAO = 'TAOBAO',           // 淘宝
  XIANYU = 'XIANYU',           // 闲鱼
  RECOMMEND = 'RECOMMEND',     // 达人推荐
  OTHER = 'OTHER',             // 其他
}

export type { PaginatedResponse } from './auth';

// 订单状态枚举（与后端 OrderStatus 一致）
export enum OrderStatus {
  PENDING_DESIGN = 'PENDING_DESIGN',
  DESIGNING = 'DESIGNING',
  PENDING_MODEL = 'PENDING_MODEL',
  MODELING = 'MODELING',
  PENDING_REVIEW = 'PENDING_REVIEW',
  PENDING_PRODUCTION = 'PENDING_PRODUCTION',
  PRODUCING = 'PRODUCING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// 材质类型枚举
export enum MaterialType {
  SILVER_925 = 'SILVER_925',   // 925银
  PURE_SILVER = 'PURE_SILVER', // 足银
  PURE_GOLD = 'PURE_GOLD',     // 足金
  K_GOLD = 'K_GOLD',           // K金
  OTHER = 'OTHER',             // 其他
}

// 工艺类型枚举
export enum ProcessType {
  ENAMEL = 'ENAMEL',           // 珐琅
  WIRE_DRAWING = 'WIRE_DRAWING', // 拉丝
  SAND_BLASTING = 'SAND_BLASTING', // 喷砂
  NAIL_SAND = 'NAIL_SAND',     // 钉砂
  OTHER = 'OTHER',             // 其他
}

// 石料类型枚举
export enum StoneType {
  DIAMOND = 'DIAMOND',         // 钻石
  RUBY = 'RUBY',               // 红宝石
  SAPPHIRE = 'SAPPHIRE',       // 蓝宝石
  EMERALD = 'EMERALD',         // 翡翠
  JADE = 'JADE',               // 玉石
  PEARL = 'PEARL',             // 珍珠
  CRYSTAL = 'CRYSTAL',         // 水晶
  OTHER = 'OTHER',             // 其他
}

// 石料形状枚举
export enum StoneShape {
  ROUND = 'ROUND',             // 圆形
  OVAL = 'OVAL',               // 椭圆形
  PEAR = 'PEAR',               // 梨形
  MARQUISE = 'MARQUISE',       // 马眼形
  HEART = 'HEART',             // 心形
  PRINCESS = 'PRINCESS',       // 公主方形
  CUSHION = 'CUSHION',         // 垫形
  RADIANT = 'RADIANT',         // 雷迪恩形
  EMERALD_CUT = 'EMERALD_CUT', // 祖母绿形
  ASSCHER = 'ASSCHER',         // 阿斯切形
  BAGUETTE = 'BAGUETTE',       // 长阶梯形
  OTHER = 'OTHER',             // 其他
}

// 证书类型枚举
export enum CertificateType {
  COPYRIGHT = 'COPYRIGHT',     // 版权证书
  APPRAISAL = 'APPRAISAL',     // 鉴定证书
  QUALITY = 'QUALITY',         // 质量证书
  OTHER = 'OTHER',             // 其他
}

// 文件类型枚举
export enum FileType {
  DESIGN = 'DESIGN',           // 设计图
  MODEL = 'MODEL',             // 建模文件
  QUOTATION = 'QUOTATION',     // 报价单
  CONTRACT = 'CONTRACT',       // 合同
  OTHER = 'OTHER',             // 其他
}

// 订单基本信息
export interface OrderBaseInfo {
  id: number;
  orderNumber: string;         // 订单编号
  source: OrderSource;         // 订单来源
  sourceDetail?: string;       // 来源详情（如达人昵称）
  depositAmount: number;       // 定金金额
  basicRequirements: string;   // 基础需求
  orderTime: string;          // 下单时间
  style?: string;             // 款式
  materialInfo?: string;      // 材质信息
  customerContact: string;    // 客户联系方式
  customerName?: string;      // 客户姓名
  customerWechat?: string;    // 客户微信
  customerAddress?: string;   // 客户地址
  notes?: string;             // 备注
}

// 订单设计信息
export interface OrderDesignInfo {
  id: number;
  orderId: number;
  designerId: number;         // 设计师ID
  designerName?: string;      // 设计师姓名
  engravingText?: string;     // 字印
  materialType?: MaterialType; // 材质类型
  materialDetail?: string;    // 材质详情
  handSize?: string;          // 手寸/链长
  processInfo?: ProcessInfo[]; // 工艺信息
  stoneInfo?: StoneInfo[];    // 石料信息
  designFiles?: FileInfo[];   // 设计图文件
  designNotes?: string;       // 设计备注
  designPassed: boolean;      // 设计是否通过客户检验
  designPassedTime?: string;  // 设计通过时间
  createdAt: string;
  updatedAt: string;
}

// 订单建模信息
export interface OrderModelInfo {
  id: number;
  orderId: number;
  modelerId: number;          // 建模师ID
  modelerName?: string;       // 建模师姓名
  weight?: number;            // 克重（克）
  modelFiles?: FileInfo[];    // 建模文件
  modelNotes?: string;        // 建模备注
  modelPassed: boolean;       // 建模是否通过客户检验
  modelPassedTime?: string;   // 建模通过时间
  createdAt: string;
  updatedAt: string;
}

// 订单工艺评审信息
export interface OrderReviewInfo {
  id: number;
  orderId: number;
  trackerId: number;          // 跟单员ID
  trackerName?: string;       // 跟单员姓名
  reviewNotes?: string;       // 评审备注
  rejectedProcesses?: string[]; // 驳回的工艺
  rejectionReason?: string;   // 驳回原因
  reviewPassed: boolean;      // 评审是否通过
  reviewPassedTime?: string;  // 评审通过时间
  createdAt: string;
  updatedAt: string;
}

// 订单报价信息
export interface OrderQuotationInfo {
  id: number;
  orderId: number;
  processCost: number;        // 工艺费用
  stoneCost: number;          // 石料费用
  materialCost: number;       // 材质费用
  weightCost: number;         // 克重费用
  laborCost: number;          // 工费
  designBuyout: boolean;      // 是否设计买断
  designBuyoutCost: number;   // 设计买断费用
  certificateCost: number;    // 证书费用
  certificateTypes?: CertificateType[]; // 证书类型
  confidential: boolean;      // 是否保密不宣传
  otherCost: number;          // 其他费用
  totalCost: number;          // 总费用
  quotationNotes?: string;    // 报价备注
  createdAt: string;
  updatedAt: string;
}

// 订单生产信息
export interface OrderProductionInfo {
  id: number;
  orderId: number;
  productionStartTime?: string; // 生产开始时间
  productionEndTime?: string;   // 生产结束时间
  productionNotes?: string;     // 生产备注
  qualityCheckPassed: boolean;  // 质检是否通过
  qualityCheckNotes?: string;   // 质检备注
  deliveryTime?: string;        // 交付时间
  deliveryMethod?: string;      // 交付方式
  trackingNumber?: string;      // 物流单号
  createdAt: string;
  updatedAt: string;
}

// 完整订单信息
export interface OrderInfo {
  baseInfo: OrderBaseInfo;
  designInfo?: OrderDesignInfo;
  modelInfo?: OrderModelInfo;
  reviewInfo?: OrderReviewInfo;
  quotationInfo?: OrderQuotationInfo;
  productionInfo?: OrderProductionInfo;
  currentStatus: OrderStatus;
  assignedSalesId?: number;    // 售中客服ID
  assignedSalesName?: string;  // 售中客服姓名
  createdAt: string;
  updatedAt: string;
}

// 工艺信息
export interface ProcessInfo {
  id?: number;
  processType: ProcessType;    // 工艺类型
  customProcess?: string;      // 自定义工艺
  additionalCost: number;      // 额外工费
  notes?: string;              // 工艺备注
}

// 石料信息
export interface StoneInfo {
  id?: number;
  stoneType: StoneType;        // 石料类型
  shape: StoneShape;           // 形状
  size: string;                // 尺寸
  quantity: number;            // 数量
  price: number;               // 价格
  notes?: string;              // 备注
}

// 文件信息
export interface FileInfo {
  id: number;
  fileName: string;            // 文件名
  filePath: string;            // 文件路径
  fileType: FileType;          // 文件类型
  fileSize: number;            // 文件大小（字节）
  uploaderId: number;          // 上传者ID
  uploaderName?: string;       // 上传者姓名
  uploadTime: string;          // 上传时间
  version?: number;            // 版本号
  isLatest: boolean;           // 是否最新版本
  notes?: string;              // 文件备注
}

// 订单查询参数
export interface OrderQueryParams {
  page?: number;
  size?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  orderNumber?: string;
  customerName?: string;
  customerContact?: string;
  source?: OrderSource;
  status?: OrderStatus;
  designerId?: number;
  modelerId?: number;
  salesId?: number;
  startDate?: string;
  endDate?: string;
  keyword?: string;
}

// 订单创建请求
export interface OrderCreateRequest {
  source: OrderSource;
  sourceDetail?: string;
  depositAmount: number;
  basicRequirements: string;
  orderTime: string;
  style?: string;
  materialInfo?: string;
  customerContact: string;
  customerName?: string;
  customerWechat?: string;
  customerAddress?: string;
  notes?: string;
}

// 订单更新请求
export interface OrderUpdateRequest {
  source?: OrderSource;
  sourceDetail?: string;
  depositAmount?: number;
  basicRequirements?: string;
  orderTime?: string;
  style?: string;
  materialInfo?: string;
  customerContact?: string;
  customerName?: string;
  customerWechat?: string;
  customerAddress?: string;
  notes?: string;
}

// 订单设计更新请求
export interface OrderDesignUpdateRequest {
  engravingText?: string;
  materialType?: MaterialType;
  materialDetail?: string;
  handSize?: string;
  designerId?: number;
  processInfo?: ProcessInfo[];
  stoneInfo?: StoneInfo[];
  designNotes?: string;
}

// 订单建模更新请求
export interface OrderModelUpdateRequest {
  weight?: number;
  modelerId?: number;
  modelNotes?: string;
}

// 订单评审更新请求
export interface OrderReviewUpdateRequest {
  trackerId?: number;
  reviewNotes?: string;
  rejectedProcesses?: string[];
  rejectionReason?: string;
}

// 订单报价更新请求
export interface OrderQuotationUpdateRequest {
  processCost?: number;
  stoneCost?: number;
  materialCost?: number;
  weightCost?: number;
  laborCost?: number;
  designBuyout?: boolean;
  designBuyoutCost?: number;
  certificateCost?: number;
  certificateTypes?: CertificateType[];
  confidential?: boolean;
  otherCost?: number;
  quotationNotes?: string;
}

// 订单状态变更请求
export interface OrderStatusChangeRequest {
  status: OrderStatus;
  notes?: string;
}

// 订单分配请求
export interface OrderAssignRequest {
  salesId?: number;
  designerId?: number;
  modelerId?: number;
  trackerId?: number;
}

// 订单统计信息
export interface OrderStatistics {
  totalOrders: number;
  pendingDesignOrders: number;
  designingOrders: number;
  pendingModelOrders: number;
  modelingOrders: number;
  pendingReviewOrders: number;
  reviewingOrders: number;
  pendingQuotationOrders: number;
  pendingProductionOrders: number;
  producingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  todayNewOrders: number;
  weekNewOrders: number;
  monthNewOrders: number;
  totalRevenue: number;
  pendingRevenue: number;
  completedRevenue: number;
  sourceDistribution: Array<{ source: OrderSource; count: number; revenue: number }>;
  statusDistribution: Array<{ status: OrderStatus; count: number }>;
  monthlyTrend: Array<{ month: string; count: number; revenue: number }>;
}

// 员工工作统计
export interface EmployeeWorkStatistics {
  employeeId: number;
  employeeName: string;
  role: string;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  averageCompletionTime: number; // 平均完成时间（小时）
  monthlyCompletion: Array<{ month: string; count: number }>;
  qualityScore: number; // 质量评分（0-100）
  customerSatisfaction: number; // 客户满意度（0-100）
}

// 订单导出配置
export interface OrderExportConfig {
  includeBaseInfo: boolean;
  includeDesignInfo: boolean;
  includeModelInfo: boolean;
  includeReviewInfo: boolean;
  includeQuotationInfo: boolean;
  includeProductionInfo: boolean;
  includeFiles: boolean;
  format: 'WORD' | 'EXCEL' | 'PDF';
}

// 订单提醒
export interface OrderReminder {
  id: number;
  orderId: number;
  orderNumber: string;
  reminderType: 'DESIGN_DEADLINE' | 'MODEL_DEADLINE' | 'REVIEW_DEADLINE' | 'PRODUCTION_DEADLINE' | 'DELIVERY_DEADLINE';
  reminderTime: string;
  notes?: string;
  isRead: boolean;
  createdAt: string;
}

// 订单操作日志
export interface OrderOperationLog {
  id: number;
  orderId: number;
  operatorId: number;
  operatorName: string;
  operation: string;
  module: string;
  description: string;
  oldValue?: string;
  newValue?: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}