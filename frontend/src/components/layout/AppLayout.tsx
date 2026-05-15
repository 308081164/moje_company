import React, { useEffect, useState } from 'react';
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
  Drawer,
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
  MenuOutlined,
  DownloadOutlined,
  HighlightOutlined,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const fn = () => setIsMobile(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

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
            ],
          },
          {
            key: '/workbench/modeling-archive',
            icon: <FileTextOutlined />,
            label: '建模归档任务池',
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
          {
            key: '/exports',
            icon: <DownloadOutlined />,
            label: '批量导出 ZIP',
          },
          {
            key: '/marketing',
            icon: <HighlightOutlined />,
            label: '营销',
            children: [{ key: '/workbench/marketing-copy', label: '待生成营销文案订单' }],
          },
        ];
      case 'PRE_SALES':
        return [
          ...baseItems,
          {
            key: '/orders',
            icon: <ShoppingCartOutlined />,
            label: '订单管理',
            children: [{ key: '/orders', label: '订单列表' }],
          },
          {
            key: '/marketing',
            icon: <HighlightOutlined />,
            label: '营销',
            children: [{ key: '/workbench/marketing-copy', label: '待生成营销文案订单' }],
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
              { key: '/orders?status=PENDING_MODEL', label: '建模中' },
              { key: '/orders?status=PENDING_REVIEW', label: '待工艺验证' },
              { key: '/orders?status=PENDING_PRODUCTION', label: '待生产' },
              { key: '/workbench/modeling-archive', label: '建模归档任务池' },
              { key: '/workbench/marketing-copy', label: '待生成营销文案订单' },
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
              { key: '/orders?status=PENDING_DESIGN', label: '设计中' },
              { key: '/orders?status=DESIGNING', label: '设计复审中' },
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
              { key: '/orders?status=PENDING_MODEL', label: '建模中' },
              { key: '/orders?status=MODELING', label: '建模修改中' },
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
      case 'DATA_ARCHIVIST':
        return [
          ...baseItems,
          {
            key: '/workbench/modeling-archive',
            icon: <FileTextOutlined />,
            label: '建模归档任务池',
          },
          {
            key: '/orders',
            icon: <ShoppingCartOutlined />,
            label: '订单列表',
            children: [{ key: '/orders', label: '全部订单' }],
          },
        ];
      default:
        return baseItems;
    }
  };

  const menuItems = getMenuItems();

  const navigateAndCloseMobile = (key: string) => {
    navigate(key);
    setMobileMenuOpen(false);
  };

  const handleMenuClick = ({ key }: { key: string }) => {
    navigateAndCloseMobile(key);
  };

  useEffect(() => {
    if (!isMobile) setMobileMenuOpen(false);
  }, [isMobile]);

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
    const items = menuItems;

    if (path.startsWith('/users')) {
      return ['/users'];
    }
    if (path.startsWith('/system')) {
      return [path];
    }
    if (path.startsWith('/dashboard')) {
      return ['/dashboard'];
    }
    if (path.startsWith('/workbench/modeling-archive')) {
      return ['/workbench/modeling-archive'];
    }
    if (path.startsWith('/workbench/marketing-copy')) {
      return ['/marketing', '/workbench/marketing-copy'];
    }
    if (path.startsWith('/exports')) {
      return ['/exports'];
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
    <Layout
      className={`app-layout${isMobile ? ' app-layout--mobile' : ''}`}
      style={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
      }}
    >
      {!isMobile && (
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
            overflowY: 'auto',
            overflowX: 'hidden',
            height: '100%',
            maxHeight: '100%',
            position: 'sticky',
            left: 0,
            top: 0,
            zIndex: 1000,
            flexShrink: 0,
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
            defaultOpenKeys={['/orders', '/marketing']}
            items={menuItems}
            onClick={handleMenuClick}
            style={{
              borderRight: 0,
              padding: '8px 0',
            }}
          />
        </Sider>
      )}

      {isMobile && (
        <Drawer
          placement="left"
          closable
          onClose={() => setMobileMenuOpen(false)}
          open={mobileMenuOpen}
          width={280}
          styles={{ body: { padding: 0 } }}
          title={null}
        >
        <div className="logo-container">
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
        </div>
        <Menu
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={['/orders', '/marketing']}
          items={menuItems}
          onClick={handleMenuClick}
          style={{
            borderRight: 0,
            padding: '8px 0',
          }}
        />
      </Drawer>
      )}

      <Layout style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Header
          style={{
            padding: '0 16px',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            background: 'linear-gradient(180deg, #fff 0%, #f5f5f5 100%)',
            borderBottom: '1px solid #e8e8e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 999,
            flexShrink: 0,
            height: 'auto',
            minHeight: 64,
          }}
        >
          <Space>
            {isMobile ? (
              <Button type="text" icon={<MenuOutlined />} onClick={() => setMobileMenuOpen(true)} style={{ fontSize: 18 }} />
            ) : (
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => {
                  setCollapsed(!collapsed);
                  toggleSidebar();
                }}
                style={{ fontSize: 16 }}
              />
            )}
            <Text strong className="header-title">
              {menuItems.find((item) => item.key === getSelectedKeys()[0])?.label || '仪表盘'}
            </Text>
          </Space>

          <Space size="middle">
            <Dropdown
              menu={{ items: notificationItems }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Badge count={unreadNotifications} size="small" className="notification-badge">
                <Button type="text" icon={<BellOutlined />} style={{ fontSize: 16 }} />
              </Badge>
            </Dropdown>

            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
              <div className="user-info-trigger">
                <div className="user-info-content">
                  <Avatar size="default" icon={<UserOutlined />} className="user-avatar" />
                  <div className="user-info-text">
                    <Text strong className="user-info-name">
                      {user?.realName || user?.username}
                    </Text>
                    <Text type="secondary" className="user-info-role">
                      {user?.roleDescription}
                    </Text>
                  </div>
                </div>
              </div>
            </Dropdown>
          </Space>
        </Header>

        <Content
          style={{
            margin: isMobile ? '8px' : '16px',
            marginBottom: isMobile ? 72 : undefined,
            padding: 0,
            flex: 1,
            minHeight: 0,
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

      {isMobile && (
        <div className="mobile-bottom-nav" role="navigation" aria-label="主导航">
          <Button type="text" onClick={() => navigateAndCloseMobile('/dashboard')}>
            首页
          </Button>
          <Button type="text" onClick={() => navigateAndCloseMobile('/orders')}>
            订单
          </Button>
          {['DESIGNER', 'MODELER', 'TRACKER'].includes(user?.role || '') && (
            <Button type="text" onClick={() => navigateAndCloseMobile('/workbench')}>
              工作台
            </Button>
          )}
          {['ADMIN', 'SALES', 'DATA_ARCHIVIST'].includes(user?.role || '') && (
            <Button type="text" onClick={() => navigateAndCloseMobile('/workbench/modeling-archive')}>
              归档池
            </Button>
          )}
          {['ADMIN', 'PRE_SALES', 'SALES'].includes(user?.role || '') && (
            <Button type="text" onClick={() => navigateAndCloseMobile('/workbench/marketing-copy')}>
              营销
            </Button>
          )}
          <Button type="text" onClick={() => setMobileMenuOpen(true)}>
            菜单
          </Button>
        </div>
      )}
    </Layout>
  );
};

export default AppLayout;