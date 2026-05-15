import React, { useEffect, useState } from 'react';
import { Button, Card, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useLocation, useNavigate } from 'react-router-dom';
import { orderService } from '@/services/orderService';
import type { OrderInfo } from '@/types/order';
import { orderStatusLabel } from '@/utils/orderLabels';

const { Paragraph } = Typography;

const ModelingArchivePoolPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<OrderInfo[]>([]);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await orderService.workbenchModelingArchivePool(p, size);
      setRows(res.content || []);
      setTotal(res.totalElements ?? 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns: ColumnsType<OrderInfo> = [
    { title: '订单号', key: 'on', render: (_, r) => r.baseInfo?.orderNumber || '-' },
    {
      title: '状态',
      render: (_, r) => orderStatusLabel(r.currentStatus),
    },
    {
      title: '操作',
      width: 120,
      render: (_, r) => (
        <Button
          type="link"
          size="small"
          onClick={() =>
            navigate(`/orders/${r.baseInfo?.id}`, {
              state: { backTo: `${location.pathname}${location.search}` },
            })
          }
        >
          打开订单
        </Button>
      ),
    },
  ];

  return (
    <Card title="建模归档任务池（共享）" loading={loading}>
      <Paragraph type="secondary">
        列表为「已有建模信息且尚未被他人提交归档锁定」的订单。任一角色的首次「提交归档」会锁定再次提交，所有人仍可保存修改。
      </Paragraph>
      <Table<OrderInfo>
        rowKey={(r) => String(r.baseInfo?.id ?? r.baseInfo?.orderNumber ?? Math.random())}
        columns={columns}
        dataSource={rows}
        pagination={{
          current: page + 1,
          pageSize: size,
          total,
          onChange: (p) => {
            const zero = p - 1;
            setPage(zero);
            void load(zero);
          },
        }}
      />
      <Space style={{ marginTop: 12 }}>
        <Button onClick={() => void load(page)}>刷新</Button>
      </Space>
    </Card>
  );
};

export default ModelingArchivePoolPage;
