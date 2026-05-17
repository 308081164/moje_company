import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Badge, Button, Card, Pagination, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { orderService } from '@/services/orderService';
import type { OrderInfo } from '@/types/order';
import { UserRole } from '@/types/auth';
import { orderSourceLabel, orderStatusColor, orderStatusLabel } from '@/utils/orderLabels';
import dayjs from 'dayjs';
import ModelerStatusPanel from '@/components/ModelerStatusPanel';
import TrackerReviewTodoPanel from '@/components/TrackerReviewTodoPanel';

const { Title, Text } = Typography;

const B2B_OPTIONS = [
  { value: undefined, label: '全部订单' },
  { value: false, label: 'C端订单' },
  { value: true, label: 'B端订单' },
];

const WorkbenchPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const role = user?.role as UserRole | undefined;

  const [tab, setTab] = useState<'todo' | 'done'>('todo');
  const [isB2b, setIsB2b] = useState<boolean | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
        title: '跟单员工作台',
      };
    }
    return null;
  }, [role]);

  const load = useCallback(async () => {
    if (!loader) return;
    setLoading(true);
    try {
      const fn = tab === 'todo' ? loader.todo : loader.done;
      const res: any = await fn(page, pageSize, isB2b);
      setOrders(res?.content ?? []);
      setTotal(res?.totalElements ?? 0);
    } catch (e) {
      message.error('加载工作台失败');
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [loader, tab, page, pageSize, isB2b]);

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
        title: '状态',
        dataIndex: 'currentStatus',
        width: 130,
        render: (v: string) => (
          <Tag color={orderStatusColor(v)}>{orderStatusLabel(v)}</Tag>
        ),
      },
      {
        title: '来源',
        dataIndex: ['baseInfo', 'source'],
        width: 100,
        render: (v) => orderSourceLabel(v),
      },
      {
        title: '下单时间',
        dataIndex: ['baseInfo', 'orderTime'],
        width: 170,
        render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '操作',
        key: 'a',
        width: 100,
        render: (_, r) => (
          <Button
            type="link"
            size="small"
            onClick={() =>
              navigate(`/orders/${r.baseInfo.id}`, {
                state: { backTo: `${location.pathname}${location.search}` },
              })
            }
          >
            详情
          </Button>
        ),
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

  return (
    <div>
      {role === UserRole.MODELER && <ModelerStatusPanel />}
      <Card bordered={false}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} align="center">
          <div>
            <Title level={3} style={{ margin: 0 }}>
              {loader.title}
            </Title>
            <Text type="secondary">与后端 /orders/workbench/* 联调</Text>
          </div>
          <Space>
            <Select
              value={isB2b}
              onChange={handleB2bChange}
              options={B2B_OPTIONS}
              style={{ width: 120 }}
              placeholder="选择订单类型"
            />
            <Button icon={<ReloadOutlined />} onClick={load}>
              刷新
            </Button>
          </Space>
        </Space>

        <Tabs
        style={{ marginTop: 16 }}
        activeKey={tab}
        onChange={(k) => {
          setTab(k as 'todo' | 'done');
          setPage(1);
        }}
        items={[
          {
            key: 'todo',
            label: (
              <Space>
                {role === UserRole.TRACKER ? '我的任务' : '待办'}
                <Badge status="processing" />
              </Space>
            ),
          },
          {
            key: 'done',
            label: '已完成',
          },
        ]}
      />

      {role === UserRole.TRACKER && tab === 'todo' ? (
        <>
          <TrackerReviewTodoPanel orders={orders} loading={loading} onRefresh={() => void load()} />
          <Pagination
            style={{ marginTop: 16, textAlign: 'right' }}
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            onChange={(p, ps) => {
              setPage(p);
              setPageSize(ps);
            }}
          />
        </>
      ) : (
        <Table
          style={{ marginTop: 8 }}
          rowKey={(r) => r.baseInfo.id}
          loading={loading}
          columns={columns}
          dataSource={orders}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      )}
      </Card>
    </div>
  );
};

export default WorkbenchPage;
