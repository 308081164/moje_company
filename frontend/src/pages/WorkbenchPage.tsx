import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Badge, Button, Card, Pagination, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { LeftOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { orderService } from '@/services/orderService';
import type { OrderInfo } from '@/types/order';
import { UserRole } from '@/types/auth';
import { orderSourceLabel, orderStatusColor, orderStatusLabel } from '@/utils/orderLabels';
import dayjs from 'dayjs';
import ModelerStatusPanel from '@/components/ModelerStatusPanel';
import TrackerReviewTodoPanel from '@/components/TrackerReviewTodoPanel';
import TrackerPendingSendPanel from '@/components/TrackerPendingSendPanel';
import { countWaxSendQueue, subscribeWaxSendQueue } from '@/utils/waxSendQueue';
import './WorkbenchPage.css';

const { Title, Text } = Typography;

const B2B_OPTIONS = [
  { value: undefined, label: '全部订单' },
  { value: false, label: 'C端订单' },
  { value: true, label: 'B端订单' },
];

type TrackerPrepTab = 'pending-send' | 'balance' | 'done';
type GenericTab = 'todo' | 'done';

const WorkbenchPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const role = user?.role as UserRole | undefined;
  const isTracker = role === UserRole.TRACKER;
  const isQualityWorkbench = isTracker && location.pathname.includes('/workbench/quality');

  const [tab, setTab] = useState<TrackerPrepTab | GenericTab>(isQualityWorkbench ? 'todo' : isTracker ? 'balance' : 'todo');
  const [isB2b, setIsB2b] = useState<boolean | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(isQualityWorkbench ? 1 : 10);
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [pendingCount, setPendingCount] = useState(() => countWaxSendQueue());

  useEffect(() => {
    const onResize = () => setPhone(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => subscribeWaxSendQueue(() => setPendingCount(countWaxSendQueue())), []);

  useEffect(() => {
    if (isQualityWorkbench) {
      setTab('todo');
      setPage(1);
      setPageSize(1);
    } else if (isTracker) {
      setTab((prev) => (prev === 'todo' ? 'balance' : prev));
      setPage(1);
      if (pageSize === 1) setPageSize(10);
    }
  }, [isQualityWorkbench, isTracker]);

  const trackerOneOrderPage = isQualityWorkbench;
  const effectivePageSize = trackerOneOrderPage ? 1 : pageSize;

  const loader = useMemo(() => {
    if (role === UserRole.DESIGNER) {
      return {
        todo: (p: number, s: number, b?: boolean) => orderService.workbenchDesignerTodo(p - 1, s, b),
        done: (p: number, s: number, b?: boolean) => orderService.workbenchDesignerDone(p - 1, s, b),
        title: '设计师工作台',
      };
    }
    if (role === UserRole.MODELER) {
      return {
        todo: (p: number, s: number, b?: boolean) => orderService.workbenchModelerTodo(p - 1, s, b),
        done: (p: number, s: number, b?: boolean) => orderService.workbenchModelerDone(p - 1, s, b),
        title: '建模师工作台',
      };
    }
    if (role === UserRole.TRACKER) {
      return {
        todo: (p: number, s: number, b?: boolean) => orderService.workbenchTrackerTodo(p - 1, s, b),
        done: (p: number, s: number, b?: boolean) => orderService.workbenchTrackerDone(p - 1, s, b),
        title: isQualityWorkbench ? '质量审核' : '准备生产',
        balance: (p: number, s: number, b?: boolean) => orderService.workbenchTrackerBalanceTodo(p - 1, s, b, true),
      };
    }
    return null;
  }, [role, isQualityWorkbench]);

  const load = useCallback(async () => {
    if (!loader) return;
    if (isTracker && !isQualityWorkbench && tab === 'pending-send') {
      setOrders([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const size = trackerOneOrderPage ? 1 : pageSize;
      const fn =
        isQualityWorkbench || tab === 'todo'
          ? loader.todo
          : tab === 'balance' && loader.balance
            ? loader.balance
            : loader.done;
      const res: any = await fn(page, size, isB2b);
      setOrders(res?.content ?? []);
      setTotal(res?.totalElements ?? 0);
    } catch (e) {
      message.error('加载工作台失败');
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [loader, tab, page, pageSize, isB2b, isTracker, isQualityWorkbench, trackerOneOrderPage]);

  useEffect(() => {
    load();
  }, [load]);

  const handleB2bChange = (value: boolean | undefined) => {
    setIsB2b(value);
    setPage(1);
  };

  const columns: ColumnsType<OrderInfo> = useMemo(
    () => [
      {
        title: '订单号',
        dataIndex: ['baseInfo', 'orderNumber'],
        width: 160,
        render: (v, r) => (
          <Button
            type="link"
            style={{ padding: 0 }}
            onClick={() =>
              navigate(`/orders/${r.baseInfo.id}`, {
                state: { backTo: `${location.pathname}${location.search}` },
              })
            }
          >
            {v || '-'}
          </Button>
        ),
      },
      {
        title: '客户',
        dataIndex: ['baseInfo', 'customerName'],
        ellipsis: true,
        render: (v) => v || '-',
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
        render: (s) => <Tag color={orderStatusColor(s)}>{orderStatusLabel(s)}</Tag>,
      },
      {
        title: '时间',
        dataIndex: ['baseInfo', 'orderTime'],
        width: 140,
        render: (v) => (v ? dayjs(v).format('MM-DD HH:mm') : '-'),
      },
    ],
    [navigate, location.pathname, location.search]
  );

  if (!loader) {
    return (
      <Card>
        <Title level={4}>工作台</Title>
        <Text type="secondary">当前角色不使用工作台，请从「订单管理」访问订单列表。</Text>
      </Card>
    );
  }

  const trackerPrepTabs = [
    { key: 'balance', label: '待报价/发送' },
    {
      key: 'pending-send',
      label: (
        <Space>
          待发送微信
          {pendingCount > 0 ? <Badge count={pendingCount} overflowCount={99} size="small" /> : null}
        </Space>
      ),
    },
    { key: 'done', label: '已完成' },
  ];

  const genericTabs = [
    {
      key: 'todo',
      label: (
        <Space>
          待办
          <Badge status="processing" />
        </Space>
      ),
    },
    { key: 'done', label: '已完成' },
  ];

  return (
    <div className="workbench-page">
      {role === UserRole.MODELER && <ModelerStatusPanel />}
      <Card bordered={false}>
        <div className="workbench-head">
          <Title level={3} style={{ margin: 0 }}>
            {loader.title}
          </Title>
          <div className="workbench-actions">
            {!(isTracker && !isQualityWorkbench && tab === 'pending-send') ? (
              <Select
                value={isB2b}
                onChange={handleB2bChange}
                options={B2B_OPTIONS}
                placeholder="选择订单类型"
              />
            ) : null}
            <Button icon={<ReloadOutlined />} onClick={load}>
              刷新
            </Button>
          </div>
        </div>

        {isTracker && !isQualityWorkbench ? (
          <Tabs
            style={{ marginTop: 16 }}
            activeKey={tab}
            onChange={(k) => {
              setTab(k as TrackerPrepTab);
              setPage(1);
            }}
            items={trackerPrepTabs}
          />
        ) : !isTracker ? (
          <Tabs
            style={{ marginTop: 16 }}
            activeKey={tab}
            onChange={(k) => {
              setTab(k as GenericTab);
              setPage(1);
            }}
            items={genericTabs}
          />
        ) : (
          <div style={{ marginTop: 12 }}>
            <Text type="secondary">设计与建模质量评审（通过后系统自动发给客户）</Text>
          </div>
        )}

        {isTracker && !isQualityWorkbench && tab === 'pending-send' ? (
          <TrackerPendingSendPanel />
        ) : isTracker && (isQualityWorkbench || tab === 'balance') ? (
          <>
            {trackerOneOrderPage ? (
              <div className="workbench-order-nav">
                <Button
                  icon={<LeftOutlined />}
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一单
                </Button>
                <Text>
                  第 <Text strong>{total === 0 ? 0 : page}</Text> / {total} 单
                  {orders[0]?.baseInfo?.orderNumber ? (
                    <Text type="secondary"> · {orders[0].baseInfo.orderNumber}</Text>
                  ) : null}
                  {orders[0]?.qualityReviewKind ? (
                    <Tag style={{ marginLeft: 8 }} color={orders[0].qualityReviewKind === 'DESIGN' ? 'blue' : 'purple'}>
                      {orders[0].qualityReviewKind === 'DESIGN' ? '设计图' : '建模图'}
                    </Tag>
                  ) : null}
                </Text>
                <Button
                  disabled={page >= total || loading || total === 0}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一单
                  <RightOutlined />
                </Button>
              </div>
            ) : null}
            <TrackerReviewTodoPanel
              orders={orders}
              loading={loading}
              onRefresh={() => void load()}
              mode={isQualityWorkbench ? 'quality' : 'balance'}
            />
            {!trackerOneOrderPage ? (
              <Pagination
                style={{ marginTop: 16, textAlign: phone ? 'center' : 'right' }}
                current={page}
                pageSize={effectivePageSize}
                total={total}
                showSizeChanger={!phone}
                simple={phone}
                onChange={(p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                }}
              />
            ) : null}
          </>
        ) : phone ? (
          <div className="order-phone-list">
            {orders.map((record) => (
              <button
                key={record.baseInfo.id}
                type="button"
                className="order-phone-card"
                onClick={() =>
                  navigate(`/orders/${record.baseInfo.id}`, {
                    state: { backTo: `${location.pathname}${location.search}` },
                  })
                }
              >
                <div className="order-phone-card__top">
                  <strong>{record.baseInfo.orderNumber || '-'}</strong>
                  {record.baseInfo?.rushPaid ? <Tag color="volcano">加急</Tag> : null}
                  <Tag color={orderStatusColor(record.currentStatus)}>{orderStatusLabel(record.currentStatus)}</Tag>
                </div>
                <div className="order-phone-card__meta">
                  <span>{record.baseInfo.customerName || '未填客户'}</span>
                  <span>{record.baseInfo.orderTime ? dayjs(record.baseInfo.orderTime).format('MM-DD HH:mm') : ''}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <>
            <Table
              rowKey={(r) => r.baseInfo.id}
              loading={loading}
              columns={columns}
              dataSource={orders}
              pagination={false}
              size="middle"
            />
            <Pagination
              style={{ marginTop: 16, textAlign: phone ? 'center' : 'right' }}
              current={page}
              pageSize={effectivePageSize}
              total={total}
              showSizeChanger={!phone}
              simple={phone}
              onChange={(p, ps) => {
                setPage(p);
                setPageSize(ps);
              }}
            />
          </>
        )}
      </Card>
    </div>
  );
};

export default WorkbenchPage;
