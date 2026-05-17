import React, { useEffect, useState } from 'react';
import { Button, Card, Modal, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useLocation, useNavigate } from 'react-router-dom';
import { orderService } from '@/services/orderService';
import type { OrderInfo } from '@/types/order';
import { orderStatusLabel } from '@/utils/orderLabels';
import ModelingArchivePanel from '@/components/ModelingArchivePanel';

const { Paragraph } = Typography;

const ModelingArchivePoolPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<OrderInfo[]>([]);
  const [archiveOrderId, setArchiveOrderId] = useState<number | null>(null);

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
      width: 220,
      render: (_, r) => (
        <Space>
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
          <Button type="primary" size="small" ghost onClick={() => setArchiveOrderId(Number(r.baseInfo?.id) || null)}>
            建模材料归档
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card title="建模归档任务池（共享）" loading={loading}>
      <Paragraph type="secondary">
        列表为「已有建模信息且尚未被他人提交归档锁定」的订单。任一角色的首次「提交归档」会锁定再次提交，所有人仍可保存修改。
        请在列表中点击「建模材料归档」在本页完成信息化归档，避免在订单详情中堆积表单干扰日常处理。
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

      <Modal
        title="建模材料归档"
        open={archiveOrderId != null}
        onCancel={() => setArchiveOrderId(null)}
        footer={null}
        width={960}
        destroyOnClose
        styles={{ body: { maxHeight: '80vh', overflowY: 'auto' } }}
      >
        {archiveOrderId != null && <ModelingArchivePanel orderId={archiveOrderId} />}
      </Modal>
    </Card>
  );
};

export default ModelingArchivePoolPage;
