import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp, Spin, message } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useAuthStore } from './stores/authStore';
import { useAppStore } from './stores/appStore';

// 页面组件
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OrderManagementPage from './pages/OrderManagementPage';
import UserManagementPage from './pages/UserManagementPage';
import SystemConfigPage from './pages/SystemConfigPage';
import NotFoundPage from './pages/NotFoundPage';
import B2BClientPortal from './pages/B2BClientPortal';
import AdminMonitorPage from './pages/AdminMonitorPage';

// 布局组件
import AppLayout from './components/layout/AppLayout';

// 样式
import './App.css';

// 路由守卫组件
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      await checkAuth();
      setChecking(false);
    };
    verifyAuth();
  }, [checkAuth]);

  if (checking) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

// 角色权限路由守卫
const RoleRoute: React.FC<{ 
  children: React.ReactNode; 
  allowedRoles: string[];
}> = ({ children, allowedRoles }) => {
  const { user } = useAuthStore();

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!allowedRoles.includes(user.role)) {
    message.error('您没有权限访问此页面');
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const { initializeApp, appReady, loading, error } = useAppStore();

  // 初始化应用
  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  // 显示错误信息
  useEffect(() => {
    if (error) {
      message.error(error);
    }
  }, [error]);

  if (loading || !appReady) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="应用初始化中..." />
      </div>
    );
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
          colorBgContainer: '#ffffff',
        },
        components: {
          Layout: {
            headerBg: '#ffffff',
            siderBg: '#ffffff',
          },
          Card: {
            borderRadiusLG: 12,
          },
          Button: {
            borderRadius: 6,
          },
          Input: {
            borderRadius: 6,
          },
          Table: {
            borderRadius: 8,
          },
        },
      }}
    >
      <AntdApp>
        <Router>
          <Routes>
            {/* B端客户门户 - 公开路由 */}
            <Route path="/b2b" element={<B2BClientPortal />} />
            
            {/* 公开路由 */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* 受保护的路由 */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <AppLayout />
                </PrivateRoute>
              }
            >
              {/* 默认重定向到仪表盘 */}
              <Route index element={<Navigate to="/dashboard" />} />
              
              {/* 仪表盘 - 所有角色可访问 */}
              <Route path="dashboard" element={<DashboardPage />} />
              
              {/* 订单管理 - 售前客服、售中客服、管理员可访问 */}
              <Route
                path="orders"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRE_SALES', 'SALES']}>
                    <OrderManagementPage />
                  </RoleRoute>
                }
              />
              
              {/* 订单详情 - 所有角色可访问 */}
              <Route
                path="orders/:id"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRE_SALES', 'SALES', 'DESIGNER', 'MODELER', 'TRACKER']}>
                    <OrderManagementPage />
                  </RoleRoute>
                }
              />
              
              {/* 新建订单 - 售前客服、管理员可访问 */}
              <Route
                path="orders/new"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRE_SALES']}>
                    <OrderManagementPage />
                  </RoleRoute>
                }
              />
              
              {/* 用户管理 - 仅管理员可访问 */}
              <Route
                path="users"
                element={
                  <RoleRoute allowedRoles={['ADMIN']}>
                    <UserManagementPage />
                  </RoleRoute>
                }
              />
              
              {/* 系统配置 - 仅管理员可访问 */}
              <Route
                path="system/config"
                element={
                  <RoleRoute allowedRoles={['ADMIN']}>
                    <SystemConfigPage />
                  </RoleRoute>
                }
              />
              
              {/* 管理员监控 - 仅管理员可访问 */}
              <Route
                path="system/monitor"
                element={
                  <RoleRoute allowedRoles={['ADMIN']}>
                    <AdminMonitorPage />
                  </RoleRoute>
                }
              />
              
              {/* 404页面 */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Router>
      </AntdApp>
    </ConfigProvider>
  );
};

export default App;