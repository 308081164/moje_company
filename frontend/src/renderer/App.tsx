import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Spin, message, notification } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { useAppStore } from '@/stores/appStore';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import OrderManagementPage from '@/pages/OrderManagementPage';
import UserManagementPage from '@/pages/UserManagementPage';
import SystemConfigPage from '@/pages/SystemConfigPage';
import NotFoundPage from '@/pages/NotFoundPage';
import WorkbenchPage from '@/pages/WorkbenchPage';
import AppLayout from '@/components/layout/AppLayout';
import './App.css';

const App: React.FC = () => {
  const { isAuthenticated, user, loading: authLoading, checkAuth } = useAuthStore();
  const { appReady, initializeApp } = useAppStore();
  const [initializing, setInitializing] = useState(true);

  console.log('[App] render', { initializing, authLoading, appReady, isAuthenticated });

  // 初始化应用
  useEffect(() => {
    const init = async () => {
      try {
        // 检查认证状态
        await checkAuth();
        
        // 初始化应用
        await initializeApp();
        
        // 显示欢迎消息
        if (isAuthenticated && user) {
          message.success(`欢迎回来，${user.realName || user.username}！`);
        }
      } catch (error) {
        console.error('应用初始化失败:', error);
        notification.error({
          message: '应用初始化失败',
          description: '请检查网络连接或联系管理员',
        });
      } finally {
        setInitializing(false);
      }
    };

    init();
  }, [checkAuth, initializeApp]);

  // 监听Electron菜单事件
  useEffect(() => {
    const electronAPI = window.electronAPI;
    if (electronAPI) {
      const handleNewOrder = () => {
        if (isAuthenticated) {
          // 跳转到新建订单页面
          window.location.hash = '#/orders/new';
        }
      };

      const handleShowAbout = () => {
        notification.info({
          message: '关于珠宝定制管理系统',
          description: '版本 1.0.0 © 2024 珠宝定制工作室',
          duration: 5,
        });
      };

      electronAPI.onMenuNewOrder(handleNewOrder);
      electronAPI.onShowAbout(handleShowAbout);

      return () => {
        electronAPI.removeMenuNewOrderListener(handleNewOrder);
        electronAPI.removeShowAboutListener(handleShowAbout);
      };
    }
  }, [isAuthenticated]);

  // 显示加载状态
  if (initializing || authLoading || !appReady) {
    console.log('[App] show initializing screen');
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f0f2f5',
      }}>
        <Spin
          indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />}
          tip="正在初始化应用..."
          size="large"
        />
      </div>
    );
  }

  // 未认证用户重定向到登录页
  if (!isAuthenticated) {
    console.log('[App] not authenticated -> login router');
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

  // 主应用布局（用户管理/系统配置仅管理员可访问，与《功能设计文档》4.1 一致）
  const isAdmin = user?.role === 'ADMIN';

  console.log('[App] authenticated -> main router');
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="workbench" element={<WorkbenchPage />} />
          <Route path="orders/*" element={<OrderManagementPage />} />
          <Route
            path="users/*"
            element={isAdmin ? <UserManagementPage /> : <Navigate to="/dashboard" replace />}
          />
          <Route
            path="system/*"
            element={isAdmin ? <SystemConfigPage /> : <Navigate to="/dashboard" replace />}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;