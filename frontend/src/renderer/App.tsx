import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Button, Modal, Spin, message, notification } from 'antd';
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
import ModelingArchivePoolPage from '@/pages/ModelingArchivePoolPage';
import BulkExportPage from '@/pages/BulkExportPage';
import ProfilePage from '@/pages/ProfilePage';
import SettingsPage from '@/pages/SettingsPage';
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
  }, [checkAuth, initializeApp, isAuthenticated, user]);

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

  // 自动更新监听
  useEffect(() => {
    const electronAPI = window.electronAPI;
    if (!electronAPI || !isAuthenticated) {
      return;
    }

    electronAPI.checkForUpdates().catch((e) => {
      console.error('[updater] 主动检查更新失败', e);
    });

    const onAvailable = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      notification.info({
        message: '发现新版本',
        description: `检测到新版本 ${detail.version || ''}，正在后台下载...`,
        duration: 5,
      });
    };

    const onDownloaded = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      Modal.confirm({
        title: '新版本已下载完成',
        content: `版本 ${detail.version || ''} 已准备就绪，是否立即重启并安装更新？`,
        okText: '立即安装',
        cancelText: '稍后',
        onOk: () => electronAPI.quitAndInstallUpdate(),
      });
    };

    const onError = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      notification.warning({
        message: '更新检查失败',
        description: detail.message || '暂时无法获取更新信息',
        duration: 4,
      });
    };

    const onProgress = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (typeof detail.percent === 'number') {
        const p = Math.round(detail.percent);
        if (p > 0 && p % 25 === 0) {
          message.loading({ content: `更新下载中 ${p}%`, key: 'update-progress', duration: 1 });
        }
        if (p >= 100) {
          message.destroy('update-progress');
        }
      }
    };

    window.addEventListener('electron-update-available', onAvailable);
    window.addEventListener('electron-update-downloaded', onDownloaded);
    window.addEventListener('electron-update-error', onError);
    window.addEventListener('electron-update-download-progress', onProgress);

    return () => {
      window.removeEventListener('electron-update-available', onAvailable);
      window.removeEventListener('electron-update-downloaded', onDownloaded);
      window.removeEventListener('electron-update-error', onError);
      window.removeEventListener('electron-update-download-progress', onProgress);
      message.destroy('update-progress');
    };
  }, [isAuthenticated]);

  // 显示加载状态
  if (initializing || authLoading || !appReady) {
    console.log('[App] show initializing screen');
    return (
      <div className="app-router-fill app-router-fill--scroll">
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flex: 1,
            minHeight: 240,
            backgroundColor: '#f0f2f5',
          }}
        >
          <Spin
            indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />}
            tip="正在初始化应用..."
            size="large"
          />
        </div>
      </div>
    );
  }

  // 未认证用户重定向到登录页
  if (!isAuthenticated) {
    console.log('[App] not authenticated -> login router');
    return (
      <Router>
        <div className="app-router-fill app-router-fill--scroll">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </Router>
    );
  }

  // 主应用布局（用户管理/系统配置仅管理员可访问，与《功能设计文档》4.1 一致）
  const isAdmin = user?.role === 'ADMIN';

  console.log('[App] authenticated -> main router');
  return (
    <Router>
      <div className="app-router-fill">
        <Routes>
          <Route path="/" element={<AppLayout />}>
            {/* 直接渲染默认首页，避免某些环境下重定向导致 Outlet 空白 */}
            <Route index element={<DashboardPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="workbench" element={<WorkbenchPage />} />
            <Route path="workbench/modeling-archive" element={<ModelingArchivePoolPage />} />
            <Route path="exports" element={isAdmin ? <BulkExportPage /> : <Navigate to="/dashboard" replace />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="orders/*" element={<OrderManagementPage />} />
            <Route
              path="users/*"
              element={isAdmin ? <UserManagementPage /> : <Navigate to="/dashboard" replace />}
            />
            <Route
              path="system/*"
              element={isAdmin ? <SystemConfigPage /> : <Navigate to="/dashboard" replace />}
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </div>
    </Router>
  );
};

export default App;