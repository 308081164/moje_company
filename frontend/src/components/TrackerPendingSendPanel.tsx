import React, { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Empty, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, WechatOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  clearWaxSendQueue,
  completeWaxSendByKeys,
  listWaxSendQueue,
  subscribeWaxSendQueue,
  unmarkWaxSendByKeys,
  type WaxSendQueueItem,
} from '@/utils/waxSendQueue';
import { shareOrderFilesToWeChat } from '@/utils/shareFilesToWeChat';
import { orderService } from '@/services/orderService';
import { resolveProductionGate } from '@/utils/productionReady';

const { Text, Title } = Typography;

const TrackerPendingSendPanel: React.FC = () => {
  const [items, setItems] = useState<WaxSendQueueItem[]>(() => listWaxSendQueue());
  const [selected, setSelected] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);

  useEffect(() => subscribeWaxSendQueue(() => setItems(listWaxSendQueue())), []);

  useEffect(() => {
    setSelected((prev) => prev.filter((k) => items.some((i) => i.key === k)));
  }, [items]);

  const columns: ColumnsType<WaxSendQueueItem> = useMemo(
    () => [
      {
        title: '订单',
        dataIndex: 'orderNumber',
        width: 160,
        render: (v, r) => (
          <Space direction="vertical" size={0}>
            <Text strong>{v || `订单${r.orderId}`}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              #{r.orderId}
            </Text>
          </Space>
        ),
      },
      {
        title: '单件',
        dataIndex: 'pieceName',
        width: 140,
        render: (v) => v || '-',
      },
      {
        title: '文件',
        dataIndex: 'fileName',
        ellipsis: true,
        render: (v, r) => (
          <Space size={6} wrap>
            <span title={v}>{v}</span>
            {/\.stl$/i.test(r.fileName) ? <Tag color="gold">STL</Tag> : <Tag>文件</Tag>}
          </Space>
        ),
      },
      {
        title: '标记时间',
        dataIndex: 'markedAt',
        width: 160,
        render: (v: string) => (v ? dayjs(v).format('MM-DD HH:mm') : '-'),
      },
      {
        title: '操作',
        key: 'op',
        width: 90,
        render: (_, r) => (
          <Button
            type="link"
            size="small"
            danger
            onClick={() => {
              unmarkWaxSendByKeys([r.key]);
              message.success('已移出待发送', 2);
            }}
          >
            移除
          </Button>
        ),
      },
    ],
    []
  );

  const shareSelected = async () => {
    const targets = items.filter((i) => selected.includes(i.key));
    if (!targets.length) {
      message.warning('请先勾选要转发的文件', 2);
      return;
    }
    setSharing(true);
    try {
      const orderIds = [...new Set(targets.map((t) => t.orderId))];
      const unpaid: string[] = [];
      for (const oid of orderIds) {
        try {
          const detail = await orderService.getOrderById(oid);
          const gate = resolveProductionGate(detail);
          if (!gate.canMarkSend) {
            unpaid.push(detail.baseInfo.orderNumber || String(oid));
          }
        } catch {
          unpaid.push(String(oid));
        }
      }
      if (unpaid.length) {
        message.warning(
          `以下订单尚未完成「报价+客户付款」，不能发送给喷蜡厂：${unpaid.join('、')}`,
          2
        );
        return;
      }

      const batchId = `batch-${Date.now()}`;
      const res = await shareOrderFilesToWeChat(
        targets.map((t) => ({ id: t.fileId, name: t.fileName })),
        {
          displayNamePrefix: targets.length === 1
            ? [targets[0].orderNumber, targets[0].pieceName].filter(Boolean).join('_')
            : undefined,
          batchId,
        }
      );
      if (res.method === 'cancelled') {
        message.info(res.message, 2);
        return;
      }
      if (!res.ok) {
        message.warning(res.message, 2);
        return;
      }
      completeWaxSendByKeys(
        targets.map((t) => t.key),
        res.batchId || batchId
      );
      setSelected([]);
      message.success(res.message || '已执行发送', 2);
    } catch (e: unknown) {
      message.error(String((e as Error)?.message || e), 2);
    } finally {
      setSharing(false);
    }
  };

  if (!items.length) {
    return (
      <Empty
        style={{ padding: '48px 16px' }}
        description="暂无待发送文件。请先完成核对 → 报价并由客户支付尾款后，再「标记待发送」，然后在此批量转发到微信。"
      />
    );
  }

  return (
    <div className="tracker-pending-send">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <div>
          <Title level={5} style={{ margin: 0 }}>
            待发送喷蜡文件
          </Title>
          <Text type="secondary">勾选后一键调起微信选聊天，适合一次转发多件 STL</Text>
        </div>
        <Space wrap>
          <Checkbox
            checked={selected.length > 0 && selected.length === items.length}
            indeterminate={selected.length > 0 && selected.length < items.length}
            onChange={(e) => setSelected(e.target.checked ? items.map((i) => i.key) : [])}
          >
            全选（{selected.length}/{items.length}）
          </Checkbox>
          <Button
            type="primary"
            icon={<WechatOutlined />}
            loading={sharing}
            disabled={!selected.length}
            onClick={() => void shareSelected()}
          >
            批量转发到微信
          </Button>
          <Button
            icon={<DeleteOutlined />}
            disabled={!items.length || sharing}
            onClick={() => {
              clearWaxSendQueue();
              setSelected([]);
              message.success('已清空待发送', 2);
            }}
          >
            清空
          </Button>
        </Space>
      </div>

      <Table
        rowKey="key"
        size="middle"
        columns={columns}
        dataSource={items}
        pagination={false}
        scroll={{ x: 720 }}
        rowSelection={{
          selectedRowKeys: selected,
          onChange: (keys) => setSelected(keys as string[]),
        }}
      />
    </div>
  );
};

export default TrackerPendingSendPanel;
