import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Badge,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DownloadOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { orderService } from '@/services/orderService';
import { OrderInfo, OrderSource, OrderStatus } from '@/types/order';
import { UserRole } from '@/types/auth';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const OrderManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [orders, setOrders] = useState<OrderInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeTab, setActiveTab] = useState<string>('ALL');

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'view' | 'edit' | 'create'>('view');
  const [selectedOrder, setSelectedOrder] = useState<OrderInfo | null>(null);

  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();

  const getStatusText = (status: OrderStatus) => {
    const map: Record<OrderStatus, string> = {
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
    return map[status] ?? String(status);
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING_DESIGN:
      case OrderStatus.PENDING_MODEL:
      case OrderStatus.PENDING_REVIEW:
      case OrderStatus.PENDING_QUOTATION:
      case OrderStatus.PENDING_PRODUCTION:
        return 'orange';
      case OrderStatus.DESIGNING:
      case OrderStatus.MODELING:
      case OrderStatus.REVIEWING:
      case OrderStatus.PRODUCING:
        return 'blue';
      case OrderStatus.COMPLETED:
        return 'green';
      case OrderStatus.CANCELLED:
        return 'red';
      default:
        return 'default';
    }
  };

  const getSourceText = (source: OrderSource) => {
    const map: Record<OrderSource, string> = {
      [OrderSource.DOUYIN]: '抖音',
      [OrderSource.BILIBILI]: 'B站',
      [OrderSource.XIAOHONGSHU]: '小红书',
      [OrderSource.TAOBAO]: '淘宝',
      [OrderSource.XIANYU]: '闲鱼',
      [OrderSource.RECOMMEND]: '达人推荐',
      [OrderSource.OTHER]: '其他',
    };
    return map[source] ?? String(source);
  };

  const tabs = useMemo(() => {
    const all = [{ key: 'ALL', label: '全部' }];
    const statuses = Object.values(OrderStatus).map((s) => ({
      key: s,
      label: getStatusText(s),
    }));
    return [...all, ...statuses];
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res: any = await orderService.getOrders({
        page: currentPage - 1,
        size: pageSize,
        status: activeTab === 'ALL' ? undefined : (activeTab as any),
        ...searchForm.getFieldsValue(),
      });

      const content = res?.content ?? res?.data?.content ?? [];
      const totalElements = res?.totalElements ?? res?.data?.totalElements ?? content.length;

      setOrders(content);
      setTotal(totalElements);
    } catch (e) {
      console.error('加载订单失败:', e);
      setOrders([]);
      setTotal(0);
      message.error('加载订单失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, activeTab]);

  const handleSearch = () => {
    setCurrentPage(1);
    loadOrders();
  };

  const handleResetSearch = () => {
    searchForm.resetFields();
    setCurrentPage(1);
    loadOrders();
  };

  const handlePageChange = (page: number, size: number) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  const handleCreateOrder = () => {
    setModalType('create');
    setSelectedOrder(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleViewOrder = (order: OrderInfo) => {
    setModalType('view');
    setSelectedOrder(order);
    setModalVisible(true);
  };

  const handleEditOrder = (order: OrderInfo) => {
    setModalType('edit');
    setSelectedOrder(order);
    form.setFieldsValue({
      customerName: order.baseInfo.customerName,
      customerContact: order.baseInfo.customerContact,
      source: order.baseInfo.source,
      depositAmount: order.baseInfo.depositAmount,
      basicRequirements: order.baseInfo.basicRequirements,
      orderTime: dayjs(order.baseInfo.orderTime),
    });
    setModalVisible(true);
  };

  const columns: ColumnsType<OrderInfo> = useMemo(
    () => [
      {
        title: '订单编号',
        dataIndex: ['baseInfo', 'orderNumber'],
        width: 160,
      },
      {
        title: '客户',
        dataIndex: ['baseInfo', 'customerName'],
        width: 140,
        render: (v) => v || '-',
      },
      {
        title: '联系方式',
        dataIndex: ['baseInfo', 'customerContact'],
        width: 160,
      },
      {
        title: '来源',
        dataIndex: ['baseInfo', 'source'],
        width: 120,
        render: (v: OrderSource) => getSourceText(v),
      },
      {
        title: '状态',
        dataIndex: 'currentStatus',
        width: 120,
        render: (v: OrderStatus) => <Tag color={getStatusColor(v)}>{getStatusText(v)}</Tag>,
      },
      {
        title: '下单时间',
        dataIndex: ['baseInfo', 'orderTime'],
        width: 180,
        render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '操作',
        key: 'actions',
        fixed: 'right',
        width: 160,
        render: (_, record) => (
          <Space>
            <Button size="small" onClick={() => handleViewOrder(record)}>
              查看
            </Button>
            <Button size="small" onClick={() => handleEditOrder(record)}>
              编辑
            </Button>
            <Button size="small" type="link" onClick={() => navigate(`/orders/${record.baseInfo.id}`)}>
              详情页
            </Button>
          </Space>
        ),
      },
    ],
    [navigate]
  );

  const renderOrderDetail = () => {
    if (!selectedOrder) return null;
    return (
      <Descriptions column={2} bordered>
        <Descriptions.Item label="订单编号">
          <Text strong>{selectedOrder.baseInfo.orderNumber}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="订单状态">
          <Tag color={getStatusColor(selectedOrder.currentStatus)}>{getStatusText(selectedOrder.currentStatus)}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="客户姓名">{selectedOrder.baseInfo.customerName || '未填写'}</Descriptions.Item>
        <Descriptions.Item label="联系方式">{selectedOrder.baseInfo.customerContact || '未填写'}</Descriptions.Item>
        <Descriptions.Item label="订单来源">{getSourceText(selectedOrder.baseInfo.source)}</Descriptions.Item>
        <Descriptions.Item label="定金金额">
          <Text strong style={{ color: '#52c41a' }}>
            ¥{(selectedOrder.baseInfo.depositAmount ?? 0).toLocaleString()}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="下单时间">
          {selectedOrder.baseInfo.orderTime ? dayjs(selectedOrder.baseInfo.orderTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="基础需求">{selectedOrder.baseInfo.basicRequirements || '未填写'}</Descriptions.Item>
      </Descriptions>
    );
  };

  const renderOrderForm = () => {
    return (
      <Form
        form={form}
        layout="vertical"
        onFinish={async (values) => {
          try {
            const payload = {
              ...values,
              orderTime: values.orderTime ? values.orderTime.toISOString() : new Date().toISOString(),
            };
            if (modalType === 'create') {
              await orderService.createOrder(payload as any);
              message.success('订单创建成功');
            } else if (modalType === 'edit' && selectedOrder) {
              await orderService.updateOrder(selectedOrder.baseInfo.id, payload as any);
              message.success('订单更新成功');
            }
            setModalVisible(false);
            loadOrders();
          } catch (e) {
            console.error('保存订单失败:', e);
            message.error('保存订单失败');
          }
        }}
      >
        <Form.Item name="customerName" label="客户姓名" rules={[{ required: true, message: '请输入客户姓名' }]}>
          <Input placeholder="请输入客户姓名" />
        </Form.Item>
        <Form.Item name="customerContact" label="联系方式" rules={[{ required: true, message: '请输入联系方式' }]}>
          <Input placeholder="请输入联系方式" />
        </Form.Item>
        <Form.Item name="source" label="订单来源" rules={[{ required: true, message: '请选择订单来源' }]}>
          <Select
            placeholder="请选择订单来源"
            options={Object.values(OrderSource).map((s) => ({ value: s, label: getSourceText(s) }))}
          />
        </Form.Item>
        <Form.Item name="depositAmount" label="定金金额" rules={[{ required: true, message: '请输入定金金额' }]}>
          <Input type="number" placeholder="请输入定金金额" addonAfter="元" />
        </Form.Item>
        <Form.Item name="basicRequirements" label="基础需求" rules={[{ required: true, message: '请输入基础需求' }]}>
          <Input.TextArea rows={3} placeholder="请输入基础需求" />
        </Form.Item>
        <Form.Item name="orderTime" label="下单时间" rules={[{ required: true, message: '请选择下单时间' }]}>
          <DatePicker showTime style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    );
  };

  const canCreate = useMemo(() => {
    return [UserRole.PRE_SALES, UserRole.ADMIN].includes(user?.role as any);
  }, [user?.role]);

  return (
    <div className="order-management-page">
      <Card bordered={false}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>
              订单管理
            </Title>
            <Text type="secondary">共 {total} 个订单</Text>
          </div>
          <Space>
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateOrder}>
                新建订单
              </Button>
            )}
            <Button icon={<ReloadOutlined />} onClick={loadOrders}>
              刷新
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => message.info('导出功能开发中')}>
              导出
            </Button>
          </Space>
        </Space>
      </Card>

      <Card bordered={false} style={{ marginTop: 16 }}>
        <Form form={searchForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="orderNumber" label="订单编号">
            <Input placeholder="请输入订单编号" />
          </Form.Item>
          <Form.Item name="customerName" label="客户姓名">
            <Input placeholder="请输入客户姓名" />
          </Form.Item>
          <Form.Item name="dateRange" label="创建时间">
            <RangePicker />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              搜索
            </Button>
            <Button onClick={handleResetSearch} icon={<ReloadOutlined />}>
              重置
            </Button>
          </Space>
        </Form>
      </Card>

      <Card bordered={false} style={{ marginTop: 16 }}>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => {
            setActiveTab(k);
            setCurrentPage(1);
          }}
          items={tabs.map((t) => ({
            key: t.key,
            label: (
              <Space>
                {t.label}
                <Badge count={0} style={{ backgroundColor: '#1890ff' }} />
              </Space>
            ),
            children: (
              <Table
                columns={columns}
                dataSource={orders}
                rowKey={(r) => r.baseInfo.id}
                loading={loading}
                pagination={{
                  current: currentPage,
                  pageSize,
                  total,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (t) => `共 ${t} 条记录`,
                  onChange: handlePageChange,
                  onShowSizeChange: handlePageChange,
                }}
                scroll={{ x: 1000 }}
              />
            ),
          }))}
        />
      </Card>

      <Modal
        title={modalType === 'view' ? '订单详情' : modalType === 'edit' ? '编辑订单' : '新建订单'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
        footer={
          modalType === 'view' ? (
            <Button onClick={() => setModalVisible(false)}>关闭</Button>
          ) : (
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" onClick={() => form.submit()}>
                {modalType === 'create' ? '创建' : '保存'}
              </Button>
            </Space>
          )
        }
      >
        {modalType === 'view' ? renderOrderDetail() : renderOrderForm()}
      </Modal>
    </div>
  );
};

export default OrderManagementPage;

