import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Space,
  Typography,
  Button,
  Badge,
  Tooltip,
  theme,
  message,
} from 'antd';
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  BellOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TeamOutlined,
  FileTextOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { useAppStore } from '@/stores/appStore';
import './AppLayout.css';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar, notifications, unreadNotifications } = useAppStore();
  const [collapsed, setCollapsed] = useState(sidebarCollapsed);

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const getMenuItems = (): any[] => {
    if (!user) return [];

    const baseItems: any[] = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: '仪表盘',
      },
    ];

    switch (user.role) {
      case 'ADMIN':
        return [
          ...baseItems,
          {
            key: '/orders',
            icon: <ShoppingCartOutlined />,
            label: '订单管理',
            children: [
              { key: '/orders', label: '订单列表' },
              { key: '/orders/new', label: '新建订单' },
            ],
          },
          {
            key: '/users',
            icon: <TeamOutlined />,
            label: '用户管理',
          },
          {
            key: '/system/config',
            icon: <SettingOutlined />,
            label: '系统配置',
          },
          {
            key: '/system/monitor',
            icon: <ShopOutlined />,
            label: '系统监控',
          },
        ];
      case 'PRE_SALES':
        return [
          ...baseItems,
          {
            key: '/orders',
            icon: <ShoppingCartOutlined />,
            label: '订单管理',
            children: [
              { key: '/orders', label: '订单列表' },
              { key: '/orders/new', label: '新建订单' },
            ],
          },
        ];
      case 'SALES':
        return [
          ...baseItems,
          {
            key: '/orders',
            icon: <ShoppingCartOutlined />,
            label: '订单管理',
            children: [
              { key: '/orders', label: '全部订单' },
              { key: '/orders?status=PENDING_DESIGN', label: '待设计' },
              { key: '/orders?status=PENDING_MODEL', label: '待建模' },
              { key: '/orders?status=PENDING_REVIEW', label: '待工艺验证' },
              { key: '/orders?status=PENDING_PRODUCTION', label: '待生产' },
            ],
          },
        ];
      case 'DESIGNER':
        return [
          ...baseItems,
          {
            key: '/workbench',
            icon: <FileTextOutlined />,
            label: '我的工作台',
          },
          {
            key: '/orders',
            icon: <ShoppingCartOutlined />,
            label: '订单列表',
            children: [
              { key: '/orders', label: '全部订单' },
              { key: '/orders?status=PENDING_DESIGN', label: '待设计师设计' },
              { key: '/orders?status=DESIGNING', label: '设计中' },
            ],
          },
        ];
      case 'MODELER':
        return [
          ...baseItems,
          {
            key: '/workbench',
            icon: <FileTextOutlined />,
            label: '我的工作台',
          },
          {
            key: '/orders',
            icon: <ShoppingCartOutlined />,
            label: '订单列表',
            children: [
              { key: '/orders', label: '全部订单' },
              { key: '/orders?status=PENDING_MODEL', label: '待建模' },
              { key: '/orders?status=MODELING', label: '建模中' },
            ],
          },
        ];
      case 'TRACKER':
        return [
          ...baseItems,
          {
            key: '/workbench',
            icon: <FileTextOutlined />,
            label: '我的工作台',
          },
          {
            key: '/orders',
            icon: <ShoppingCartOutlined />,
            label: '订单列表',
            children: [
              { key: '/orders', label: '全部订单' },
              { key: '/orders?status=PENDING_REVIEW', label: '待工艺验证' },
            ],
          },
        ];
      default:
        return baseItems;
    }
  };

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const handleLogout = async () => {
    try {
      await logout();
      message.success('已成功登出');
      navigate('/login');
    } catch (error) {
      console.error('登出失败:', error);
      message.error('登出失败');
    }
  };

  const userMenuItems = [
    {
      key: 'profile',
      label: '个人资料',
      icon: <UserOutlined />,
      onClick: () => navigate('/profile'),
    },
    {
      key: 'settings',
      label: '设置',
      icon: <SettingOutlined />,
      onClick: () => navigate('/settings'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      onClick: handleLogout,
    },
  ];

  const notificationItems = notifications.slice(0, 5).map((notification) => ({
    key: notification.id,
    label: (
      <Space direction="vertical" size={2} style={{ width: 250 }}>
        <Text strong>{notification.title}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {notification.message}
        </Text>
        <Text type="secondary" style={{ fontSize: 10 }}>
          {new Date(notification.timestamp).toLocaleTimeString()}
        </Text>
      </Space>
    ),
    onClick: () => {
      console.log('通知点击:', notification);
    },
  }));

  const getSelectedKeys = (): string[] => {
    const path = location.pathname;
    const items = getMenuItems();

    if (path.startsWith('/users')) {
      return ['/users'];
    }
    if (path.startsWith('/system')) {
      return [path];
    }
    if (path.startsWith('/dashboard')) {
      return ['/dashboard'];
    }
    if (path.startsWith('/workbench')) {
      return ['/workbench'];
    }

    for (const item of items) {
      if (item.key === path) {
        return [item.key];
      }
      if (item.children) {
        for (const child of item.children) {
          const ckey = String(child.key);
          if (ckey === path || path.startsWith(ckey.split('?')[0])) {
            return [item.key, child.key];
          }
        }
      }
    }

    return ['/dashboard'];
  };

  return (
    <Layout className="app-layout">
      <Sider
        width={240}
        collapsedWidth={80}
        collapsed={collapsed}
        onCollapse={(value) => {
          setCollapsed(value);
          toggleSidebar();
        }}
        style={{
          background: 'linear-gradient(180deg, #fff 0%, #f5f5f5 100%)',
          borderRight: '1px solid #e8e8e8',
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 1000,
        }}
      >
        <div className="logo-container">
          {collapsed ? (
            <div className="logo-collapsed">
              <ShopOutlined style={{ fontSize: 28, color: '#C9A962' }} />
            </div>
          ) : (
            <div className="logo-expanded">
              <div className="logo-main">
                <ShopOutlined className="logo-icon" />
                <div className="logo-text-container">
                  <Text className="logo-title">MOJE</Text>
                  <Text className="logo-subtitle">珠宝定制系统</Text>
                </div>
              </div>
              <Text className="logo-role">{user?.roleDescription || '企业管理系统'}</Text>
            </div>
          )}
        </div>

        <Menu
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={['/orders']}
          items={getMenuItems()}
          onClick={handleMenuClick}
          style={{
            borderRight: 0,
            padding: '8px 0',
          }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'all 0.2s' }}>
        <Header
          style={{
            padding: '0 24px',
            background: 'linear-gradient(180deg, #fff 0%, #f5f5f5 100%)',
            borderBottom: '1px solid #e8e8e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 999,
          }}
        >
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => {
                setCollapsed(!collapsed);
                toggleSidebar();
              }}
              style={{ fontSize: 16 }}
            />
            <Text strong className="header-title">
              {getMenuItems().find(item => item.key === getSelectedKeys()[0])?.label || '仪表盘'}
            </Text>
          </Space>

          <Space size="large">
            <Dropdown
              menu={{ items: notificationItems }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Badge count={unreadNotifications} size="small" className="notification-badge">
                <Button
                  type="text"
                  icon={<BellOutlined />}
                  style={{ fontSize: 16 }}
                />
              </Badge>
            </Dropdown>

            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
              <Space className="user-info-trigger" style={{ cursor: 'pointer', padding: '8px 12px', borderRadius: 8 }}>
                <Avatar
                  size="default"
                  icon={<UserOutlined />}
                  className="user-avatar"
                />
                {!collapsed && (
                  <Space direction="vertical" size={0} className="user-info-text">
                    <Text strong className="user-info-name">
                      {user?.realName || user?.username}
                    </Text>
                    <Text type="secondary" className="user-info-role">
                      {user?.roleDescription}
                    </Text>
                  </Space>
                )}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: 'transparent',
            borderRadius: borderRadiusLG,
            overflow: 'auto',
          }}
        >
          <div className="content-wrapper">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;