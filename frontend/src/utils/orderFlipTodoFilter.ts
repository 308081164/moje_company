import type { UserInfo } from '@/types/auth';
import { UserRole } from '@/types/auth';
import type { OrderInfo } from '@/types/order';
import { OrderStatus } from '@/types/order';

function isActiveOrder(o: OrderInfo): boolean {
  return o.currentStatus !== OrderStatus.COMPLETED && o.currentStatus !== OrderStatus.CANCELLED;
}

/**
 * 订单详情「仅待办」翻页：无工作台专用接口的角色（管理员、售前、售中等）用列表结果做客户端过滤。
 */
export function filterOrdersForTodoFlip(user: UserInfo, orders: OrderInfo[]): OrderInfo[] {
  const role = user.role as UserRole;
  const uid = user.id;
  if (role === UserRole.ADMIN) {
    return orders.filter(isActiveOrder);
  }
  if (role === UserRole.SALES) {
    return orders.filter((o) => o.assignedSalesId === uid && isActiveOrder(o));
  }
  if (role === UserRole.PRE_SALES) {
    return orders.filter(
      (o) =>
        o.assignedPreSalesId === uid &&
        (o.currentStatus === OrderStatus.PENDING_DESIGN || o.currentStatus === OrderStatus.DESIGNING)
    );
  }
  return [];
}
