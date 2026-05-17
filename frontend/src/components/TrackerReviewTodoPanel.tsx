import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Image, Input, Modal, Space, Tag, Typography, message } from 'antd';
import type { OrderInfo } from '@/types/order';
import { orderService } from '@/services/orderService';
import { orderStatusLabel } from '@/utils/orderLabels';
import { isRasterImageFileName } from '@/utils/isRasterImageFileName';
import { DownloadOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;
const { TextArea } = Input;

function collectModelFileRows(order: OrderInfo): { id: number; name: string; url?: string }[] {
  const raw = order.modelInfo?.modelFiles;
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as { fileId?: number; fileName?: string; fileUrl?: string }[])
    .filter((x) => x.fileId != null)
    .map((x) => ({
      id: Number(x.fileId),
      name: x.fileName || `file-${x.fileId}`,
      url: x.fileUrl,
    }));
}

export interface TrackerReviewTodoPanelProps {
  orders: OrderInfo[];
  loading: boolean;
  onRefresh: () => void;
}

const TrackerReviewTodoPanel: React.FC<TrackerReviewTodoPanelProps> = ({ orders, loading, onRefresh }) => {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectOrderId, setRejectOrderId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const openReject = (orderId: number) => {
    setRejectOrderId(orderId);
    setRejectReason('');
    setRejectOpen(true);
  };

  const submitPass = async (order: OrderInfo) => {
    const id = order.baseInfo.id;
    setSubmitting(true);
    try {
      await orderService.updateOrderReview(id, {
        trackerId: order.reviewInfo?.trackerId,
        reviewNotes: order.reviewInfo?.reviewNotes,
      });
      message.success('评审已通过，订单已进入生产中');
      onRefresh();
    } catch (e: unknown) {
      message.error(String((e as Error)?.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  const submitReject = async () => {
    if (rejectOrderId == null) return;
    const reason = rejectReason.trim();
    if (!reason) {
      message.warning('请填写驳回原因');
      return;
    }
    const order = orders.find((o) => o.baseInfo.id === rejectOrderId);
    setSubmitting(true);
    try {
      await orderService.updateOrderReview(rejectOrderId, {
        trackerId: order?.reviewInfo?.trackerId,
        reviewNotes: order?.reviewInfo?.reviewNotes,
        rejectionReason: reason,
      });
      message.success('已驳回，订单已退回建模修改');
      setRejectOpen(false);
      onRefresh();
    } catch (e: unknown) {
      message.error(String((e as Error)?.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  if (!loading && orders.length === 0) {
    return <Card loading={loading}>暂无待工艺验证订单</Card>;
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {orders.map((order) => {
        const id = order.baseInfo.id;
        const designUrls = order.designInfo?.designImages || [];
        const effectUrls = order.modelInfo?.modelEffectImages || [];
        const modelRows = collectModelFileRows(order);
        return (
          <Card
            key={id}
            loading={loading}
            title={
              <Space wrap>
                <Title level={5} style={{ margin: 0 }}>
                  {order.baseInfo.orderNumber}
                </Title>
                <Tag>{orderStatusLabel(order.currentStatus)}</Tag>
                <Text type="secondary">{order.baseInfo.customerName || '-'}</Text>
              </Space>
            }
            extra={
              <Space wrap>
                <Button type="primary" onClick={() => void submitPass(order)} loading={submitting}>
                  评审通过
                </Button>
                <Button danger onClick={() => openReject(id)} disabled={submitting}>
                  评审驳回
                </Button>
                <Link to={`/orders/${id}`} target="_blank" rel="noreferrer">
                  打开订单详情
                </Link>
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Text strong>设计图</Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {designUrls.length === 0 ? (
                    <Text type="secondary">暂无</Text>
                  ) : (
                    designUrls.map((url, i) => (
                      <Image key={i} width={120} height={120} src={url} style={{ objectFit: 'cover', borderRadius: 6 }} />
                    ))
                  )}
                </div>
              </div>
              <div>
                <Text strong>建模效果图（预览）</Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {effectUrls.length === 0 ? (
                    <Text type="secondary">暂无</Text>
                  ) : (
                    effectUrls.map((url, i) => (
                      <Image key={i} width={120} height={120} src={url} style={{ objectFit: 'cover', borderRadius: 6 }} />
                    ))
                  )}
                </div>
              </div>
              <div>
                <Text strong>建模源文件（下载）</Text>
                <div style={{ marginTop: 8 }}>
                  {modelRows.length === 0 ? (
                    <Text type="secondary">暂无</Text>
                  ) : (
                    <Space direction="vertical" size={4}>
                      {modelRows.map((f) => (
                        <Space key={f.id} wrap>
                          <Text>{f.name}</Text>
                          {f.url && isRasterImageFileName(f.name) ? (
                            <Image src={f.url} width={72} height={72} style={{ objectFit: 'cover', borderRadius: 4 }} />
                          ) : null}
                          <Button
                            type="link"
                            size="small"
                            icon={<DownloadOutlined />}
                            onClick={() =>
                              void orderService
                                .downloadFile(f.id)
                                .then((blob) => {
                                  const a = document.createElement('a');
                                  a.href = URL.createObjectURL(blob);
                                  a.download = f.name || `model-${f.id}`;
                                  a.click();
                                  URL.revokeObjectURL(a.href);
                                })
                                .catch((e: unknown) => message.error(String((e as Error)?.message || e)))
                            }
                          >
                            下载到本地
                          </Button>
                          {f.url ? (
                            <Button type="link" size="small" href={f.url} target="_blank" rel="noopener noreferrer">
                              打开链接
                            </Button>
                          ) : null}
                        </Space>
                      ))}
                    </Space>
                  )}
                </div>
              </div>
            </Space>
          </Card>
        );
      })}

      <Modal
        title="评审驳回"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={() => void submitReject()}
        okText="确认驳回"
        okButtonProps={{ danger: true, loading: submitting, disabled: !rejectReason.trim() }}
        confirmLoading={submitting}
      >
        <Text type="secondary">请填写驳回原因（必填）。</Text>
        <TextArea
          rows={4}
          style={{ marginTop: 8 }}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="例如：主石镶口尺寸与图纸不符，请建模师按新版说明修改。"
        />
      </Modal>
    </Space>
  );
};

export default TrackerReviewTodoPanel;
