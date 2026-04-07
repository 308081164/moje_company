import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Badge,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DownloadOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { orderService } from '@/services/orderService';
import { OrderInfo, OrderStatus } from '@/types/order';
import { UserRole } from '@/types/auth';
import { orderSourceLabel, orderStatusColor, orderStatusLabel } from '@/utils/orderLabels';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const OrderListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();

  const [orders, setOrders] = useState<OrderInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get('status') || 'ALL');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [searchForm] = Form.useForm();

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const sf = searchForm.getFieldsValue();
      const range = sf.dateRange as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
      const keyword = sf.keyword?.trim() || undefined;
      const res: any = await orderService.getOrders({
        page: currentPage - 1,
        size: pageSize,
        status: activeTab === 'ALL' ? undefined : (activeTab as OrderStatus),
        keyword,
        startDate: range?.[0] ? range[0].format('YYYY-MM-DD') : undefined,
        endDate: range?.[1] ? range[1].format('YYYY-MM-DD') : undefined,
      });

      const content = res?.content ?? [];
      const totalElements = res?.totalElements ?? content.length;

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
  }, [activeTab, currentPage, pageSize, searchForm]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const st = searchParams.get('status');
    if (st) {
      setActiveTab(st);
    }
  }, [searchParams]);

  const handleSearch = () => {
    setCurrentPage(1);
    loadOrders();
  };

  const handleResetSearch = () => {
    searchForm.resetFields();
    setCurrentPage(1);
    setSearchParams({});
    loadOrders();
  };

  const handlePageChange = (page: number, size: number) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  const canCreate = useMemo(
    () => [UserRole.PRE_SALES, UserRole.ADMIN].includes(user?.role as UserRole),
    [user?.role]
  );

  const tabs = useMemo(() => {
    const all = [{ key: 'ALL', label: '全部' }];
    const statuses = Object.values(OrderStatus).map((s) => ({
      key: s,
      label: orderStatusLabel(s),
    }));
    return [...all, ...statuses];
  }, []);

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
        width: 120,
        render: (v) => v || '-',
      },
      {
        title: '联系方式',
        dataIndex: ['baseInfo', 'customerContact'],
        width: 140,
        ellipsis: true,
      },
      {
        title: '来源',
        dataIndex: ['baseInfo', 'source'],
        width: 100,
        render: (v) => orderSourceLabel(v),
      },
      {
        title: '状态',
        dataIndex: 'currentStatus',
        width: 120,
        render: (v: string) => (
          <Tag color={orderStatusColor(v)}>{orderStatusLabel(v)}</Tag>
        ),
      },
      {
        title: '下单时间',
        dataIndex: ['baseInfo', 'orderTime'],
        width: 170,
        render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '操作',
        key: 'actions',
        fixed: 'right',
        width: 200,
        render: (_, record) => (
          <Space wrap>
            <Button
              size="small"
              type="link"
              onClick={() => navigate(`/orders/${record.baseInfo.id}`)}
            >
              详情
            </Button>
          </Space>
        ),
      },
    ],
    [navigate]
  );

  const exportCsv = async () => {
    const ids = (selectedRowKeys as number[]).filter(Boolean);
    if (!ids.length) {
      message.warning('请勾选要导出的订单');
      return;
    }
    try {
      const blob = await orderService.exportOrdersCsv(ids);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('已开始下载 CSV');
    } catch (e) {
      message.error('导出失败');
    }
  };

  return (
    <div className="order-management-page">
      <Card bordered={false}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
          <div>
            <Title level={3} style={{ margin: 0 }}>
              订单管理
            </Title>
            <Text type="secondary">共 {total} 个订单</Text>
          </div>
          <Space wrap>
            {canCreate && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/orders/new')}
              >
                新建订单
              </Button>
            )}
            <Button icon={<ReloadOutlined />} onClick={loadOrders}>
              刷新
            </Button>
            <Button icon={<DownloadOutlined />} onClick={exportCsv}>
              导出选中 CSV
            </Button>
          </Space>
        </Space>
      </Card>

      <Card bordered={false} style={{ marginTop: 16 }}>
        <Form form={searchForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="keyword" label="关键词">
            <Input placeholder="编号 / 客户 / 电话 / 微信" style={{ width: 220 }} allowClear />
          </Form.Item>
          <Form.Item name="dateRange" label="创建日期">
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
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              if (k === 'ALL') {
                next.delete('status');
              } else {
                next.set('status', k);
              }
              return next;
            });
          }}
          items={tabs.map((t) => ({
            key: t.key,
            label: (
              <Space>
                {t.label}
                <Badge count={0} style={{ backgroundColor: '#1890ff' }} showZero />
              </Space>
            ),
          }))}
        />
        <Table
          style={{ marginTop: 16 }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
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
          scroll={{ x: 1100 }}
        />
      </Card>
    </div>
  );
};

export default OrderListPage;
