import { OrderSource, OrderStatus } from '@/types/order';

/** 管理端「新建订单」可选来源（B2B/C2C 由门户录入） */
export const INTERNAL_ORDER_CREATE_SOURCES = (Object.values(OrderSource) as OrderSource[]).filter(
  (s) => s !== OrderSource.B2B && s !== OrderSource.C2C
);

export function orderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    [OrderStatus.PENDING_DESIGN]: '设计中',
    [OrderStatus.DESIGNING]: '设计复审中',
    [OrderStatus.PENDING_MODEL]: '待建模师设计',
    [OrderStatus.MODELING]: '建模中',
    [OrderStatus.PENDING_REVIEW]: '待工艺验证',
    [OrderStatus.PENDING_PRODUCTION]: '待生产',
    [OrderStatus.PRODUCING]: '生产中',
    [OrderStatus.COMPLETED]: '已完成',
    [OrderStatus.CANCELLED]: '已取消',
  };
  return map[status] ?? status;
}

export function orderStatusColor(status: string): string {
  switch (status) {
    case OrderStatus.PENDING_DESIGN:
    case OrderStatus.PENDING_MODEL:
    case OrderStatus.PENDING_REVIEW:
    case OrderStatus.PENDING_PRODUCTION:
      return 'orange';
    case OrderStatus.DESIGNING:
    case OrderStatus.MODELING:
    case OrderStatus.PRODUCING:
      return 'blue';
    case OrderStatus.COMPLETED:
      return 'green';
    case OrderStatus.CANCELLED:
      return 'red';
    default:
      return 'default';
  }
}

export function orderSourceLabel(source: OrderSource | string): string {
  const map: Record<string, string> = {
    [OrderSource.DOUYIN]: '抖音',
    [OrderSource.BILIBILI]: 'B站',
    [OrderSource.XIAOHONGSHU]: '小红书',
    [OrderSource.TAOBAO]: '淘宝',
    [OrderSource.XIANYU]: '闲鱼',
    [OrderSource.RECOMMEND]: '达人推荐',
    [OrderSource.OTHER]: '其他',
    INFLUENCER: '达人推荐',
    C2C: 'C端客户',
    B2B: 'B端客户',
  };
  return map[source] ?? String(source);
}
