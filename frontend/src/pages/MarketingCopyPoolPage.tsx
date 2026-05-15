import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Drawer,
  Input,
  message,
  Modal,
  Space,
  Table,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useLocation, useNavigate } from 'react-router-dom';
import { orderService } from '@/services/orderService';
import type { OrderInfo, OrderMarketingCopyDto } from '@/types/order';
import { orderStatusLabel } from '@/utils/orderLabels';

const { Paragraph, Text } = Typography;
const { TextArea } = Input;

const MarketingCopyPoolPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<OrderInfo[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [copyDto, setCopyDto] = useState<OrderMarketingCopyDto | null>(null);
  const [genLoading, setGenLoading] = useState(false);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await orderService.workbenchMarketingCopyPending(p, size);
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

  const openOrder = (id: number) => {
    const backTo = `${location.pathname}${location.search}`;
    navigate(`/orders/${id}`, { state: { backTo } });
  };

  const openCopyDrawer = async (orderId: number) => {
    setActiveOrderId(orderId);
    setDrawerOpen(true);
    setCopyDto(null);
    try {
      const dto = await orderService.getMarketingCopy(orderId);
      setCopyDto(dto);
    } catch {
      message.error('加载营销文案失败');
    }
  };

  const runGenerate = async () => {
    if (activeOrderId == null) return;
    setGenLoading(true);
    try {
      const dto = await orderService.generateMarketingCopy(activeOrderId);
      setCopyDto(dto);
      message.success('已生成并保存三类营销文案');
      void load(page);
    } catch (e: unknown) {
      message.error(String((e as Error)?.message || e));
    } finally {
      setGenLoading(false);
    }
  };

  const downloadZip = async () => {
    const ids = selectedRowKeys.map((k) => Number(k)).filter((n) => !Number.isNaN(n));
    if (!ids.length) {
      message.warning('请勾选已生成文案的订单（可多选）');
      return;
    }
    Modal.confirm({
      title: '打包下载 ZIP',
      content: `将下载 ${ids.length} 个订单的文案（每个订单三个 txt）。未生成文案的订单会被拒绝。`,
      onOk: async () => {
        try {
          await orderService.downloadMarketingCopyZip(ids, 'marketing-copy.zip');
          message.success('已开始下载');
        } catch (e: unknown) {
          message.error(String((e as Error)?.message || e));
        }
      },
    });
  };

  const columns: ColumnsType<OrderInfo> = [
    { title: '订单号', key: 'on', render: (_, r) => r.baseInfo?.orderNumber || '-' },
    {
      title: '客户',
      render: (_, r) => r.baseInfo?.customerName || '-',
    },
    {
      title: '状态',
      render: (_, r) => orderStatusLabel(r.currentStatus),
    },
    {
      title: '操作',
      width: 260,
      render: (_, r) => {
        const id = r.baseInfo?.id;
        if (id == null) return null;
        return (
          <Space wrap>
            <Button type="link" size="small" onClick={() => openOrder(id)}>
              打开订单
            </Button>
            <Button type="link" size="small" onClick={() => void openCopyDrawer(id)}>
              营销文案
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <Card title="待生成营销文案订单" loading={loading}>
      <Paragraph type="secondary">
        订单进入「已完成」后会自动出现在此列表。请配置「系统配置 → 销售助手集成」中通义千问
        API。管理员、售前客服、售中客服均可使用；生成后可多选订单打包下载 ZIP。
      </Paragraph>
      <Space style={{ marginBottom: 12 }} wrap>
        <Button type="primary" onClick={() => void downloadZip()}>
          打包下载选中订单 ZIP
        </Button>
        <Button onClick={() => void load(page)}>刷新</Button>
      </Space>
      <Table<OrderInfo>
        rowKey={(r) => String(r.baseInfo?.id ?? r.baseInfo?.orderNumber ?? Math.random())}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
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

      <Drawer
        title={activeOrderId != null ? `订单 #${activeOrderId} 营销文案` : '营销文案'}
        width={560}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setActiveOrderId(null);
          setCopyDto(null);
        }}
        extra={
          <Space>
            {copyDto?.generationComplete && activeOrderId != null && (
              <Button
                onClick={() =>
                  void orderService
                    .downloadMarketingCopyZip([activeOrderId], `marketing-order-${activeOrderId}.zip`)
                    .then(() => message.success('已开始下载'))
                    .catch((e: unknown) => message.error(String((e as Error)?.message || e)))
                }
              >
                下载本单 ZIP
              </Button>
            )}
            <Button type="primary" loading={genLoading} onClick={() => void runGenerate()}>
              一键生成（通义千问）
            </Button>
          </Space>
        }
      >
        {!copyDto ? (
          <Text type="secondary">加载中…</Text>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Text strong>小红书种草文案</Text>
              <TextArea value={copyDto.xhsGrassCopy || ''} readOnly rows={8} style={{ marginTop: 6 }} />
            </div>
            <div>
              <Text strong>闲鱼 / 淘宝展示文案</Text>
              <TextArea value={copyDto.xianyuTaobaoCopy || ''} readOnly rows={8} style={{ marginTop: 6 }} />
            </div>
            <div>
              <Text strong>抖音口播文案</Text>
              <TextArea value={copyDto.douyinBroadcastCopy || ''} readOnly rows={8} style={{ marginTop: 6 }} />
            </div>
            {copyDto.generationComplete && copyDto.lastGeneratedAt && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                最近生成：{copyDto.lastGeneratedAt}
                {copyDto.lastGeneratedByName ? ` · ${copyDto.lastGeneratedByName}` : ''}
              </Text>
            )}
          </Space>
        )}
      </Drawer>
    </Card>
  );
};

export default MarketingCopyPoolPage;
