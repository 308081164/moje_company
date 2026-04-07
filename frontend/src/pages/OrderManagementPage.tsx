import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import OrderListPage from '@/pages/orders/OrderListPage';
import OrderCreatePage from '@/pages/orders/OrderCreatePage';
import OrderDetailPage from '@/pages/orders/OrderDetailPage';

/**
 * 订单模块子路由：/orders、/orders/new、/orders/:id
 */
const OrderManagementPage: React.FC = () => {
  return (
    <Routes>
      <Route index element={<OrderListPage />} />
      <Route path="new" element={<OrderCreatePage />} />
      <Route path=":id" element={<OrderDetailPage />} />
      <Route path="*" element={<Navigate to="/orders" replace />} />
    </Routes>
  );
};

export default OrderManagementPage;
