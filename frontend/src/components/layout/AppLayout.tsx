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
  HomeOutlined,
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

  // 根据用户角色获取菜单项
  const getMenuItems = (): any[] => {
    if (!user) return [];

    const baseItems: any[] = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: '仪表盘',
      },
    ];

    // 根据角色添加菜单项
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

  // 处理菜单点击
  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  // 处理登出
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

  // 用户菜单
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

  // 通知菜单
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
      // 处理通知点击
      console.log('通知点击:', notification);
    },
  }));

  // 获取当前选中的菜单项（HashRouter 下 pathname 为 /users、/system/config 等）
  const getSelectedKeys = (): string[] => {
    const path = location.pathname;
    const items = getMenuItems();

    if (path.startsWith('/users')) {
      return ['/users'];
    }
    if (path.startsWith('/system')) {
      return ['/system/config'];
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
      {/* 侧边栏 */}
      <Sider
        width={240}
        collapsedWidth={80}
        collapsed={collapsed}
        onCollapse={(value) => {
          setCollapsed(value);
          toggleSidebar();
        }}
        style={{
          background: colorBgContainer,
          borderRight: '1px solid #f0f0f0',
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 1000,
        }}
      >
        {/* Logo区域 */}
        <div className="logo-container">
          {collapsed ? (
            <div className="logo-collapsed">
              <HomeOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            </div>
          ) : (
            <div className="logo-expanded">
              <Space>
                <HomeOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                <Text strong style={{ fontSize: 18 }}>
                  珠宝定制系统
                </Text>
              </Space>
              <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
                {user?.roleDescription || '企业管理系统'}
              </Text>
            </div>
          )}
        </div>

        {/* 菜单 */}
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

      {/* 主内容区域 */}
      <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'all 0.2s' }}>
        {/* 顶部导航栏 */}
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            borderBottom: '1px solid #f0f0f0',
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
            <Text strong style={{ fontSize: 16 }}>
              {getMenuItems().find(item => item.key === getSelectedKeys()[0])?.label || '仪表盘'}
            </Text>
          </Space>

          <Space size="large">
            {/* 通知 */}
            <Dropdown
              menu={{ items: notificationItems }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Badge count={unreadNotifications} size="small">
                <Button
                  type="text"
                  icon={<BellOutlined />}
                  style={{ fontSize: 16 }}
                />
              </Badge>
            </Dropdown>

            {/* 用户信息 */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
              <Space className="user-info-trigger" style={{ cursor: 'pointer', padding: '8px 12px', borderRadius: 8 }}>
                <Avatar
                  size="default"
                  icon={<UserOutlined />}
                  style={{ backgroundColor: '#1890ff' }}
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

        {/* 内容区域 */}
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;