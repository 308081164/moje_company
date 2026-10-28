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
  mode?: 'review' | 'balance';
}

const TrackerReviewTodoPanel: React.FC<TrackerReviewTodoPanelProps> = ({ orders, loading, onRefresh, mode = 'review' }) => {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectOrderId, setRejectOrderId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteOrderId, setQuoteOrderId] = useState<number | null>(null);
  const [quoteAmount, setQuoteAmount] = useState<string>('');
  const [quoteSaving, setQuoteSaving] = useState(false);

  const openQuote = (orderId: number) => {
    setQuoteOrderId(orderId);
    setQuoteAmount('');
    setQuoteOpen(true);
  };

  const submitQuote = async () => {
    if (quoteOrderId == null) return;
    const amount = Number(quoteAmount);
    if (!quoteAmount.trim() || !(amount > 0)) {
      message.warning('请填写有效的尾款金额');
      return;
    }
    setQuoteSaving(true);
    try {
      await orderService.quoteOrderBalance(quoteOrderId, amount);
      message.success('尾款报价已推送给客户');
      setQuoteOpen(false);
      onRefresh();
    } catch (e: unknown) {
      message.error(String((e as Error)?.message || e));
    } finally {
      setQuoteSaving(false);
    }
  };

  const openReject = (orderId: number) => {
    setRejectOrderId(orderId);
    setRejectReason('');
    setRejectOpen(true);
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
    return <Card loading={loading}>{mode === 'balance' ? '暂无待尾款报价订单' : '暂无待工艺验证订单'}</Card>;
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
            className="tracker-review-card"
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
                {mode === 'balance' ? (
                  <Button type="primary" onClick={() => openQuote(id)} disabled={submitting || quoteSaving}>
                    尾款报价
                  </Button>
                ) : (
                  <Button danger onClick={() => openReject(id)} disabled={submitting}>
                    评审驳回
                  </Button>
                )}
                <Link to={`/orders/${id}`} target="_blank" rel="noreferrer">
                  打开订单详情
                </Link>
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Text strong>单件工艺验证</Text>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">
                    喷蜡照片同步成功后，这一件自动通过。全部单件都喷蜡后，订单进入生产，不必再点评审通过。尚未喷蜡的单件仍可驳回。
                  </Text>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {(order.pieces ?? []).length === 0 ? (
                    <Text type="secondary">暂无单件</Text>
                  ) : (
                    (order.pieces ?? []).map((piece) => (
                      <Tag key={piece.id} color={piece.processVerified ? 'success' : 'default'}>
                        {piece.name || `单件${piece.seq}`} · {piece.processVerified ? '已通过' : '待喷蜡'}
                      </Tag>
                    ))
                  )}
                </div>
              </div>
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

      <Modal
        title="尾款报价"
        open={quoteOpen}
        onCancel={() => setQuoteOpen(false)}
        onOk={() => void submitQuote()}
        okText="推送尾款报价"
        okButtonProps={{ loading: quoteSaving, disabled: !quoteAmount.trim() }}
        confirmLoading={quoteSaving}
      >
        <Text type="secondary">客户确认全部建模稿后，只填一个最终尾款金额（元）。提交后会推送给客户支付。</Text>
        <Input
          style={{ marginTop: 12 }}
          inputMode="decimal"
          value={quoteAmount}
          onChange={(e) => setQuoteAmount(e.target.value)}
          placeholder="例如 8000"
        />
      </Modal>
    </Space>
  );
};

export default TrackerReviewTodoPanel;
