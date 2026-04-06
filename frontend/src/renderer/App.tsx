import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import AppHeader from '@/components/layout/AppHeader';
import AppSider from '@/components/layout/AppSider';
import AppFooter from '@/components/layout/AppFooter';
import './App.css';

const { Content } = Layout;

const App: React.FC = () => {
  const { isAuthenticated, user, loading: authLoading, checkAuth } = useAuthStore();
  const { appReady, initializeApp } = useAppStore();
  const [initializing, setInitializing] = useState(true);

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
  }, [checkAuth, initializeApp, isAuthenticated, user]);

  // 监听Electron菜单事件
  useEffect(() => {
    if (window.electronAPI) {
      const handleNewOrder = () => {
        if (isAuthenticated) {
          // 跳转到新建订单页面
          window.location.href = '/orders/new';
        }
      };

      const handleShowAbout = () => {
        notification.info({
          message: '关于珠宝定制管理系统',
          description: '版本 1.0.0 © 2024 珠宝定制工作室',
          duration: 5,
        });
      };

      window.electronAPI.onMenuNewOrder(handleNewOrder);
      window.electronAPI.onShowAbout(handleShowAbout);

      return () => {
        window.electronAPI.removeMenuNewOrderListener(handleNewOrder);
        window.electronAPI.removeShowAboutListener(handleShowAbout);
      };
    }
  }, [isAuthenticated]);

  // 显示加载状态
  if (initializing || authLoading || !appReady) {
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
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

  // 主应用布局
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <AppSider />
        <Layout>
          <AppHeader />
          <Content style={{ margin: '16px', overflow: 'auto' }}>
            <div style={{ padding: 24, background: '#fff', minHeight: 360 }}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/orders/*" element={<OrderManagementPage />} />
                <Route path="/users/*" element={<UserManagementPage />} />
                <Route path="/system/*" element={<SystemConfigPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </div>
          </Content>
          <AppFooter />
        </Layout>
      </Layout>
    </Router>
  );
};

export default App;