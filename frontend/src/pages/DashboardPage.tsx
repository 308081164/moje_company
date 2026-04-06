import React, { useEffect, useState } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Button,
  Space,
  Typography,
  Progress,
  Tag,
  Avatar,
  Timeline,
  Badge,
  Tooltip,
  message,
} from 'antd';
import {
  ShoppingCartOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  FileTextOutlined,
  TeamOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { orderService } from '@/services/orderService';
import { OrderInfo, OrderStatus, OrderSource } from '@/types/order';
import { UserRole } from '@/types/auth';
import './DashboardPage.css';

const { Title, Text } = Typography;

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderInfo[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  // 加载数据
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 获取订单列表
      const ordersResponse = await orderService.getOrders({
        page: 0,
        size: 10,
        sort: 'createdAt',
        order: 'desc',
      });
      setOrders(ordersResponse.content);

      // 获取统计信息
      const stats = await orderService.getOrderStatistics();
      setStatistics(stats);

      // 模拟最近活动
      const activities = [
        {
          id: 1,
          type: 'order_created',
          title: '新订单创建',
          description: '客户张三创建了一个新订单',
          time: '10分钟前',
          user: '售前客服-李四',
        },
        {
          id: 2,
          type: 'design_completed',
          title: '设计完成',
          description: '设计师王五完成了订单#20240001的设计',
          time: '1小时前',
          user: '设计师-王五',
        },
        {
          id: 3,
          type: 'model_completed',
          title: '建模完成',
          description: '建模师赵六完成了订单#20240002的建模',
          time: '2小时前',
          user: '建模师-赵六',
        },
        {
          id: 4,
          type: 'review_passed',
          title: '工艺评审通过',
          description: '跟单员钱七通过了订单#20240003的工艺评审',
          time: '3小时前',
          user: '跟单员-钱七',
        },
        {
          id: 5,
          type: 'order_completed',
          title: '订单完成',
          description: '订单#20240004已完成生产并交付',
          time: '1天前',
          user: '售中客服-孙八',
        },
      ];
      setRecentActivities(activities);
    } catch (error) {
      console.error('加载仪表盘数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 根据角色获取待办事项
  const getTodoItems = () => {
    if (!user) return [];

    const todos = [];

    switch (user.role) {
      case UserRole.PRE_SALES:
        todos.push(
          { id: 1, title: '待创建订单', count: 5, color: '#1890ff' },
          { id: 2, title: '待联系客户', count: 3, color: '#52c41a' }
        );
        break;
      case UserRole.SALES:
        todos.push(
          { id: 1, title: '待对接设计师', count: 8, color: '#1890ff' },
          { id: 2, title: '待分配建模师', count: 4, color: '#faad14' },
          { id: 3, title: '待报价订单', count: 6, color: '#722ed1' }
        );
        break;
      case UserRole.DESIGNER:
        todos.push(
          { id: 1, title: '待设计订单', count: 3, color: '#1890ff' },
          { id: 2, title: '设计中订单', count: 2, color: '#faad14' }
        );
        break;
      case UserRole.MODELER:
        todos.push(
          { id: 1, title: '待建模订单', count: 4, color: '#1890ff' },
          { id: 2, title: '建模中订单', count: 1, color: '#faad14' }
        );
        break;
      case UserRole.TRACKER:
        todos.push(
          { id: 1, title: '待评审订单', count: 5, color: '#1890ff' },
          { id: 2, title: '评审中订单', count: 2, color: '#faad14' }
        );
        break;
      case UserRole.ADMIN:
        todos.push(
          { id: 1, title: '待审核用户', count: 2, color: '#1890ff' },
          { id: 2, title: '系统配置更新', count: 1, color: '#faad14' },
          { id: 3, title: '数据备份', count: 1, color: '#52c41a' }
        );
        break;
      default:
        break;
    }

    return todos;
  };

  // 获取状态标签颜色
  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING_DESIGN:
        return 'blue';
      case OrderStatus.DESIGNING:
        return 'orange';
      case OrderStatus.PENDING_MODEL:
        return 'cyan';
      case OrderStatus.MODELING:
        return 'purple';
      case OrderStatus.PENDING_REVIEW:
        return 'gold';
      case OrderStatus.REVIEWING:
        return 'lime';
      case OrderStatus.PENDING_QUOTATION:
        return 'magenta';
      case OrderStatus.PENDING_PRODUCTION:
        return 'volcano';
      case OrderStatus.PRODUCING:
        return 'red';
      case OrderStatus.COMPLETED:
        return 'green';
      case OrderStatus.CANCELLED:
        return 'default';
      default:
        return 'default';
    }
  };

  // 获取状态文本
  const getStatusText = (status: OrderStatus) => {
    const statusMap: Record<OrderStatus, string> = {
      [OrderStatus.PENDING_DESIGN]: '待设计',
      [OrderStatus.DESIGNING]: '设计中',
      [OrderStatus.PENDING_MODEL]: '待建模',
      [OrderStatus.MODELING]: '建模中',
      [OrderStatus.PENDING_REVIEW]: '待评审',
      [OrderStatus.REVIEWING]: '评审中',
      [OrderStatus.PENDING_QUOTATION]: '待报价',
      [OrderStatus.PENDING_PRODUCTION]: '待生产',
      [OrderStatus.PRODUCING]: '生产中',
      [OrderStatus.COMPLETED]: '已完成',
      [OrderStatus.CANCELLED]: '已取消',
    };
    return statusMap[status] || status;
  };

  // 获取来源文本
  const getSourceText = (source: OrderSource) => {
    const sourceMap: Record<OrderSource, string> = {
      [OrderSource.DOUYIN]: '抖音',
      [OrderSource.BILIBILI]: 'B站',
      [OrderSource.XIAOHONGSHU]: '小红书',
      [OrderSource.TAOBAO]: '淘宝',
      [OrderSource.XIANYU]: '闲鱼',
      [OrderSource.RECOMMEND]: '达人推荐',
      [OrderSource.OTHER]: '其他',
    };
    return sourceMap[source] || source;
  };

  // 表格列定义
  const columns = [
    {
      title: '订单编号',
      dataIndex: ['baseInfo', 'orderNumber'],
      key: 'orderNumber',
      render: (text: string) => (
        <Text strong style={{ color: '#1890ff' }}>
          {text}
        </Text>
      ),
    },
    {
      title: '客户',
      dataIndex: ['baseInfo', 'customerName'],
      key: 'customerName',
      render: (text: string, record: OrderInfo) => (
        <div>
          <div>{text || '未填写'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.baseInfo.customerContact}
          </Text>
        </div>
      ),
    },
    {
      title: '来源',
      dataIndex: ['baseInfo', 'source'],
      key: 'source',
      render: (source: OrderSource) => (
        <Tag color="blue">{getSourceText(source)}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'currentStatus',
      key: 'status',
      render: (status: OrderStatus) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: ['baseInfo', 'orderTime'],
      key: 'orderTime',
      render: (time: string) => new Date(time).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: OrderInfo) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/orders/${record.baseInfo.id}`)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 快速操作按钮
  const quickActions = [
    {
      key: 'new_order',
      title: '新建订单',
      icon: <PlusOutlined />,
      color: '#1890ff',
      onClick: () => navigate('/orders/new'),
      visible: [UserRole.PRE_SALES, UserRole.ADMIN].includes(user?.role as UserRole),
    },
    {
      key: 'view_orders',
      title: '查看订单',
      icon: <ShoppingCartOutlined />,
      color: '#52c41a',
      onClick: () => navigate('/orders'),
      visible: true,
    },
    {
      key: 'manage_users',
      title: '用户管理',
      icon: <TeamOutlined />,
      color: '#722ed1',
      onClick: () => navigate('/users'),
      visible: user?.role === UserRole.ADMIN,
    },
    {
      key: 'system_config',
      title: '系统配置',
      icon: <FileTextOutlined />,
      color: '#fa8c16',
      onClick: () => navigate('/system/config'),
      visible: user?.role === UserRole.ADMIN,
    },
  ];

  return (
    <div className="dashboard-page">
      {/* 欢迎区域 */}
      <Card className="welcome-card" bordered={false}>
        <Row align="middle" justify="space-between">
          <Col>
            <Space direction="vertical" size="small">
              <Title level={2} style={{ margin: 0 }}>
                欢迎回来，{user?.realName || user?.username}！
              </Title>
              <Text type="secondary">
                {new Date().toLocaleDateString('zh-CN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </Space>
          </Col>
          <Col>
            <Avatar
              size={64}
              icon={<UserOutlined />}
              style={{ backgroundColor: '#1890ff' }}
            />
          </Col>
        </Row>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} className="stat-card">
            <Statistic
              title="总订单数"
              value={statistics?.totalOrders || 0}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <div className="stat-trend">
              <ArrowUpOutlined style={{ color: '#52c41a', marginRight: 4 }} />
              <Text type="secondary">较上月增长 12%</Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} className="stat-card">
            <Statistic
              title="待处理订单"
              value={statistics?.pendingOrders || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
            <div className="stat-trend">
              <ArrowDownOutlined style={{ color: '#ff4d4f', marginRight: 4 }} />
              <Text type="secondary">较上周减少 8%</Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} className="stat-card">
            <Statistic
              title="已完成订单"
              value={statistics?.completedOrders || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <div className="stat-trend">
              <ArrowUpOutlined style={{ color: '#52c41a', marginRight: 4 }} />
              <Text type="secondary">较上月增长 15%</Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} className="stat-card">
            <Statistic
              title="总营收"
              value={statistics?.totalRevenue || 0}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#722ed1' }}
              suffix="元"
              formatter={(value) => {
                const num = Number(value);
                return num.toLocaleString('zh-CN');
              }}
            />
            <div className="stat-trend">
              <ArrowUpOutlined style={{ color: '#52c41a', marginRight: 4 }} />
              <Text type="secondary">较上月增长 18%</Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 快速操作 */}
      <Card
        title="快速操作"
        bordered={false}
        style={{ marginTop: 16 }}
        extra={
          <Button type="link" onClick={loadDashboardData}>
            刷新
          </Button>
        }
      >
        <Row gutter={[16, 16]}>
          {quickActions
            .filter((action) => action.visible)
            .map((action) => (
              <Col xs={12} sm={8} md={6} lg={4} key={action.key}>
                <div
                  className="quick-action-card"
                  onClick={action.onClick}
                  style={{ borderColor: action.color }}
                >
                  <div
                    className="quick-action-icon"
                    style={{ backgroundColor: action.color }}
                  >
                    {action.icon}
                  </div>
                  <Text strong style={{ marginTop: 8 }}>
                    {action.title}
                  </Text>
                </div>
              </Col>
            ))}
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* 待办事项 */}
        <Col xs={24} lg={12}>
          <Card
            title="待办事项"
            bordered={false}
            extra={
              <Button type="link" size="small">
                查看全部
              </Button>
            }
          >
            <Row gutter={[16, 16]}>
              {getTodoItems().map((item) => (
                <Col xs={24} sm={12} key={item.id}>
                  <Card
                    size="small"
                    className="todo-card"
                    style={{ borderLeft: `4px solid ${item.color}` }}
                  >
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <Row justify="space-between" align="middle">
                        <Col>
                          <Text strong>{item.title}</Text>
                        </Col>
                        <Col>
                          <Badge
                            count={item.count}
                            style={{ backgroundColor: item.color }}
                          />
                        </Col>
                      </Row>
                      <Progress
                        percent={Math.min((item.count / 10) * 100, 100)}
                        size="small"
                        strokeColor={item.color}
                        showInfo={false}
                      />
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        {/* 最近活动 */}
        <Col xs={24} lg={12}>
          <Card
            title="最近活动"
            bordered={false}
            extra={
              <Button type="link" size="small">
                查看全部
              </Button>
            }
          >
            <Timeline>
              {recentActivities.map((activity) => (
                <Timeline.Item
                  key={activity.id}
                  dot={
                    <Avatar
                      size="small"
                      style={{
                        backgroundColor:
                          activity.type === 'order_created'
                            ? '#1890ff'
                            : activity.type === 'design_completed'
                            ? '#52c41a'
                            : activity.type === 'model_completed'
                            ? '#722ed1'
                            : activity.type === 'review_passed'
                            ? '#faad14'
                            : '#52c41a',
                      }}
                      {activity.user.charAt(0)}
                    </Avatar>
                  }
                >
                  <Space direction="vertical" size={2}>
                    <Text strong>{activity.title}</Text>
                    <Text type="secondary">{activity.description}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {activity.time} • {activity.user}
                    </Text>
                  </Space>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </Col>
      </Row>

      {/* 最近订单 */}
      <Card
        title="最近订单"
        bordered={false}
        style={{ marginTop: 16 }}
        extra={
          <Button type="link" onClick={() => navigate('/orders')}>
            查看全部
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={orders}
          rowKey={(record) => record.baseInfo.id}
          pagination={false}
          loading={loading}
          size="middle"
        />
      </Card>

      {/* 系统状态 */}
      <Card
        title="系统状态"
        bordered={false}
        style={{ marginTop: 16 }}
        extra={
          <Space>
            <Tag color="green">运行正常</Tag>
            <Text type="secondary">最后更新: {new Date().toLocaleTimeString()}</Text>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Card size="small" className="system-status-card">
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Row justify="space-between" align="middle">
                  <Col>
                    <Text strong>API服务</Text>
                  </Col>
                  <Col>
                    <Badge status="success" text="正常" />
                  </Col>
                </Row>
                <Progress percent={100} size="small" status="active" />
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card size="small" className="system-status-card">
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Row justify="space-between" align="middle">
                  <Col>
                    <Text strong>数据库</Text>
                  </Col>
                  <Col>
                    <Badge status="success" text="正常" />
                  </Col>
                </Row>
                <Progress percent={95} size="small" status="active" />
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card size="small" className="system-status-card">
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Row justify="space-between" align="middle">
                  <Col>
                    <Text strong>文件存储</Text>
                  </Col>
                  <Col>
                    <Badge status="success" text="正常" />
                  </Col>
                </Row>
                <Progress percent={78} size="small" status="active" />
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default DashboardPage;
