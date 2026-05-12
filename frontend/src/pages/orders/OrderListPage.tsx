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
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
  notification,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DownloadOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useAuthStore, useIsAdmin, useIsSales } from '@/stores/authStore';
import { orderService } from '@/services/orderService';
import { OrderInfo, OrderSource, OrderStatus } from '@/types/order';
import { UserRole } from '@/types/auth';
import { orderSourceLabel, orderStatusColor, orderStatusLabel, INTERNAL_ORDER_CREATE_SOURCES } from '@/utils/orderLabels';
import ChatScreenshotImportButton from '@/components/ChatScreenshotImportButton';
import { applyChatDraftToOrderForm } from '@/utils/applyChatDraftToOrderForm';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const OrderListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const isAdmin = useIsAdmin();
  const isSales = useIsSales();

  const [orders, setOrders] = useState<OrderInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get('status') || 'ALL');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createFormLoading, setCreateFormLoading] = useState(false);

  const [searchForm] = Form.useForm();
  const [createForm] = Form.useForm();

  const loadStatistics = useCallback(async () => {
    setStatisticsLoading(true);
    try {
      const stats = await orderService.getOrderStatistics();
      const counts: Record<string, number> = {};
      // 从statusDistribution中获取各状态数量
      if (stats.statusDistribution && Array.isArray(stats.statusDistribution)) {
        stats.statusDistribution.forEach((item: any) => {
          counts[item.status] = item.count || 0;
        });
      }
      // 也从统计数据中获取
      counts['PENDING_DESIGN'] = stats.pendingDesignOrders || 0;
      counts['DESIGNING'] = stats.designingOrders || 0;
      counts['PENDING_MODEL'] = stats.pendingModelOrders || 0;
      counts['MODELING'] = stats.modelingOrders || 0;
      counts['PENDING_REVIEW'] = stats.pendingReviewOrders || 0;
      counts['REVIEWING'] = stats.reviewingOrders || 0;
      counts['PENDING_QUOTATION'] = stats.pendingQuotationOrders || 0;
      counts['PENDING_PRODUCTION'] = stats.pendingProductionOrders || 0;
      counts['PRODUCING'] = stats.producingOrders || 0;
      counts['COMPLETED'] = stats.completedOrders || 0;
      counts['CANCELLED'] = stats.cancelledOrders || 0;
      // 总订单数
      counts['ALL'] = stats.totalOrders || 0;
      setStatusCounts(counts);
    } catch (error) {
      console.error('获取统计信息失败:', error);
    } finally {
      setStatisticsLoading(false);
    }
  }, []);

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
    loadStatistics();
  }, [loadStatistics]);

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

  const canUserCloseOrder = useCallback(
    (r: OrderInfo) => {
      if (!isAdmin && !isSales) return false;
      if (r.currentStatus === OrderStatus.CANCELLED || r.currentStatus === OrderStatus.COMPLETED) return false;
      if (isAdmin) return true;
      return !r.assignedSalesId || r.assignedSalesId === user?.id;
    },
    [isAdmin, isSales, user?.id]
  );

  const runCloseOrderWithGuards = useCallback(
    async (orderId: number, orderNumber: string) => {
      const confirmStep = (title: string, content: string, okText: string, cancelText: string) =>
        new Promise<boolean>((resolve) => {
          Modal.confirm({
            title,
            content,
            okText,
            cancelText,
            maskClosable: false,
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });

      if (
        !(await confirmStep(
          '关闭订单 — 第一次确认',
          `您即将关闭订单「${orderNumber}」。关闭后订单状态将变为「已取消」，请谨慎操作。`,
          '继续',
          '放弃'
        ))
      ) {
        return;
      }
      if (
        !(await confirmStep(
          '关闭订单 — 第二次确认',
          '再次确认：该操作对客户可见进度与内部统计均有影响，确定继续关闭流程？',
          '继续关闭流程',
          '放弃'
        ))
      ) {
        return;
      }
      const thirdConfirm = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: '关闭订单 — 第三次确认',
          content:
            '最后一次确认。防误触设计：左侧为「取消关闭」，右侧红色按钮为「确认关闭」。请点击右侧按钮才会真正提交关闭请求。',
          okText: '取消关闭订单',
          cancelText: '确认关闭此订单',
          okButtonProps: { type: 'default' },
          cancelButtonProps: { type: 'primary', danger: true },
          maskClosable: false,
          keyboard: false,
          onOk: () => resolve(false),
          onCancel: () => resolve(true),
        });
      });
      if (!thirdConfirm) return;

      const secondaryKeyRef = { current: '' };

      const postClose = async (sk?: string) => {
        await orderService.closeOrder(orderId, sk);
      };

      try {
        await postClose();
      } catch (e: unknown) {
        const msg = String((e as any)?.response?.data?.message || (e as any)?.message || '');
        if (msg.includes('二级密钥') || msg.includes('secondaryKey')) {
          await new Promise<void>((resolve, reject) => {
            Modal.confirm({
              title: '需要当日二级密钥',
              content: (
                <div>
                  <p style={{ marginBottom: 10 }}>{msg}</p>
                  <p style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>
                    请向杨兴辉索取当日密钥后填入下方（密钥与服务器日期相关）。
                  </p>
                  <Input
                    placeholder="请输入二级密钥"
                    onChange={(ev) => {
                      secondaryKeyRef.current = ev.target.value;
                    }}
                  />
                </div>
              ),
              okText: '提交密钥并关闭',
              cancelText: '取消',
              maskClosable: false,
              onOk: async () => {
                try {
                  await postClose(secondaryKeyRef.current);
                  resolve();
                } catch (err) {
                  reject(err);
                }
              },
              onCancel: () => reject(new Error('abort')),
            });
          });
        } else {
          throw e;
        }
      }

      notification.success({
        message: '订单已成功关闭',
        description: `订单「${orderNumber}」已置为已取消，列表已刷新。`,
        duration: 8,
        placement: 'top',
      });
      loadOrders();
    },
    [loadOrders]
  );

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
        width: 280,
        render: (_, record) => (
          <Space wrap>
            <Button
              size="small"
              type="link"
              onClick={() => navigate(`/orders/${record.baseInfo.id}`)}
            >
              详情
            </Button>
            {canUserCloseOrder(record) && (
              <Button
                size="small"
                type="link"
                danger
                onClick={() => void runCloseOrderWithGuards(record.baseInfo.id, record.baseInfo.orderNumber || '')}
              >
                关闭订单
              </Button>
            )}
          </Space>
        ),
      },
    ],
    [navigate, canUserCloseOrder, runCloseOrderWithGuards]
  );

  const handleOpenCreateModal = () => {
    createForm.resetFields();
    createForm.setFieldsValue({
      orderTime: dayjs(),
      depositAmount: 0,
      source: OrderSource.DOUYIN,
    });
    setCreateModalVisible(true);
  };

  const handleCloseCreateModal = () => {
    setCreateModalVisible(false);
  };

  const handleCreateOrder = async (values: any) => {
    setCreateFormLoading(true);
    try {
      const payload = {
        source: values.source,
        sourceDetail: values.sourceDetail,
        depositAmount: Number(values.depositAmount),
        basicRequirements: values.basicRequirements,
        orderTime: (values.orderTime || dayjs()).format('YYYY-MM-DD HH:mm:ss'),
        style: values.style,
        materialInfo: values.materialInfo,
        customerContact: values.customerContact,
        customerName: values.customerName,
        customerWechat: values.customerWechat,
      };
      const created = await orderService.createOrder(payload);
      message.success('创建成功');
      setCreateModalVisible(false);
      loadOrders(); // 刷新订单列表
      navigate(`/orders/${created.baseInfo.id}`); // 跳转到新订单详情
    } catch (e) {
      message.error('创建失败');
    } finally {
      setCreateFormLoading(false);
    }
  };

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
                onClick={handleOpenCreateModal}
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
                <Badge 
                  count={statusCounts[t.key] || 0} 
                  style={{ backgroundColor: '#1890ff' }} 
                  showZero 
                />
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
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* 新建订单弹窗 */}
      <Modal
        title="新建订单"
        open={createModalVisible}
        onCancel={handleCloseCreateModal}
        footer={null}
        width={720}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateOrder}
        >
          <Form.Item label="智能填单（通义千问）">
            <ChatScreenshotImportButton
              onDraft={(d) => {
                applyChatDraftToOrderForm(createForm, d, { merge: true });
                if (d.aiParseNote) {
                  message.info(d.aiParseNote);
                } else {
                  message.success('已根据截图预填，请核对后再提交');
                }
              }}
            />
          </Form.Item>
          <Form.Item name="customerName" label="客户姓名">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item
            name="customerContact"
            label="联系方式"
            rules={[{ required: true, message: '请输入手机或微信' }]}
          >
            <Input placeholder="手机或微信号" />
          </Form.Item>
          <Form.Item name="customerWechat" label="客户微信（若与联系方式不同）">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item name="source" label="订单来源" rules={[{ required: true }]}>
            <Select
              options={INTERNAL_ORDER_CREATE_SOURCES.map((s) => ({
                value: s,
                label: orderSourceLabel(s),
              }))}
            />
          </Form.Item>
          {Form.useWatch('source', createForm) === OrderSource.RECOMMEND && (
            <Form.Item name="sourceDetail" label="达人昵称">
              <Input placeholder="达人推荐时填写" />
            </Form.Item>
          )}
          <Form.Item
            name="depositAmount"
            label="定金（元）"
            rules={[{ required: true, message: '请输入定金' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="style" label="款式">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item name="materialInfo" label="材质信息">
            <Input.TextArea rows={2} placeholder="选填" />
          </Form.Item>
          <Form.Item
            name="basicRequirements"
            label="基础需求"
            rules={[{ required: true, message: '请填写基础需求' }]}
          >
            <Input.TextArea rows={4} placeholder="必填" />
          </Form.Item>
          <Form.Item
            name="orderTime"
            label="下单时间"
            rules={[{ required: true, message: '请选择下单时间' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createFormLoading}>
                提交创建
              </Button>
              <Button onClick={handleCloseCreateModal}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OrderListPage;
