import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Image, Input, Modal, Space, Tag, Typography, message } from 'antd';
import { CheckOutlined, DownloadOutlined, ExportOutlined, FlagOutlined } from '@ant-design/icons';
import type { OrderInfo, OrderPieceInfo } from '@/types/order';
import { orderService } from '@/services/orderService';
import { orderStatusLabel } from '@/utils/orderLabels';
import ModelMeshViewport from '@/components/ModelMeshViewport';
import {
  canInlineMeshPreview,
  collectOrderModelSourceRows,
  modelSourceRowToUploadFile,
  type ModelSourceFileRow,
} from '@/utils/modelSourcePreview';
import { isRasterImageFileName } from '@/utils/isRasterImageFileName';
import { pickShareCandidates } from '@/utils/shareFilesToWeChat';
import {
  isPieceFullyQueued,
  isPieceFullySent,
  markWaxSendItems,
  subscribeWaxSendQueue,
  unmarkWaxSendPiece,
} from '@/utils/waxSendQueue';
import { quoteReferenceLines, resolveProductionGate } from '@/utils/productionReady';
import './TrackerReviewTodoPanel.css';

const { Text } = Typography;
const { TextArea } = Input;

function pieceDesignUrls(order: OrderInfo, piece: OrderPieceInfo): string[] {
  const fromPiece = piece.design?.designImages || [];
  if (fromPiece.length) return fromPiece;
  if ((order.pieces?.length ?? 0) <= 1) {
    return order.designInfo?.designImages || [];
  }
  return [];
}

function pieceEffectUrls(order: OrderInfo, piece: OrderPieceInfo): string[] {
  const fromPiece = piece.model?.modelEffectImages || [];
  if (fromPiece.length) return fromPiece;
  if ((order.pieces?.length ?? 0) <= 1) {
    return order.modelInfo?.modelEffectImages || [];
  }
  return [];
}

async function downloadModelFile(id: number, name: string) {
  const blob = await orderService.downloadFile(id);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name || `model-${id}`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function ThumbGrid({ urls, empty }: { urls: string[]; empty: string }) {
  if (urls.length === 0) {
    return <div className="tr-desk__empty">{empty}</div>;
  }
  return (
    <Image.PreviewGroup>
      <div className={`tr-desk__thumbs${urls.length === 1 ? ' tr-desk__thumbs--single' : ''}`}>
        {urls.map((url, i) => (
          <div key={`${url}-${i}`} className="tr-desk__thumb">
            <Image src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ))}
      </div>
    </Image.PreviewGroup>
  );
}

export interface TrackerReviewTodoPanelProps {
  orders: OrderInfo[];
  loading: boolean;
  onRefresh: () => void;
  /** quality=设计+建模质量审核；balance=报价付款 */
  mode?: 'quality' | 'review' | 'balance';
}

const TrackerReviewTodoPanel: React.FC<TrackerReviewTodoPanelProps> = ({
  orders,
  loading,
  onRefresh,
  mode = 'review',
}) => {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectOrderId, setRejectOrderId] = useState<number | null>(null);
  const [rejectPieceId, setRejectPieceId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteOrderId, setQuoteOrderId] = useState<number | null>(null);
  const [quoteAmount, setQuoteAmount] = useState<string>('');
  const [quoteSaving, setQuoteSaving] = useState(false);
  const [cnyPerUsd, setCnyPerUsd] = useState(7.2);
  const [activePieceByOrder, setActivePieceByOrder] = useState<Record<number, number>>({});
  const [activeFileByPiece, setActiveFileByPiece] = useState<Record<number, number>>({});
  const [queueTick, setQueueTick] = useState(0);

  useEffect(() => subscribeWaxSendQueue(() => setQueueTick((n) => n + 1)), []);

  useEffect(() => {
    if (!quoteOpen) return;
    void orderService
      .getSystemConfig()
      .then((cfg) => {
        const rate = Number(cfg?.cnyPerUsd);
        if (rate > 0) setCnyPerUsd(rate);
      })
      .catch(() => undefined);
  }, [quoteOpen]);

  const openQuote = (orderId: number) => {
    const order = orders.find((o) => o.baseInfo.id === orderId);
    const prevCny = order?.quotationInfo?.staffAmountCny;
    setQuoteOrderId(orderId);
    setQuoteAmount(prevCny != null && Number(prevCny) > 0 ? String(prevCny) : '');
    setQuoteOpen(true);
  };

  const quoteOrder = quoteOrderId != null ? orders.find((o) => o.baseInfo.id === quoteOrderId) : undefined;
  const quotePublicityDiscount =
    !!quoteOrder?.quotationInfo?.designOptionsFilled && quoteOrder.quotationInfo.confidential === false;
  const quoteRevising = !!quoteOrder && resolveProductionGate(quoteOrder).canReviseQuote;

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
      message.success(
        quoteRevising ? '报价已修改并重新推送，原报价已作废' : '尾款报价已推送给客户'
      );
      setQuoteOpen(false);
      onRefresh();
    } catch (e: unknown) {
      message.error(String((e as Error)?.message || e));
    } finally {
      setQuoteSaving(false);
    }
  };

  const openReject = (orderId: number, pieceId: number) => {
    setRejectOrderId(orderId);
    setRejectPieceId(pieceId);
    setRejectReason('');
    setRejectOpen(true);
  };

  const resolveReviewKind = (order?: OrderInfo) => {
    if (order?.qualityReviewKind === 'DESIGN' || order?.currentStatus === 'PENDING_DESIGN_REVIEW') {
      return 'DESIGN';
    }
    return 'MODEL';
  };

  const resolveActivePieceId = (order?: OrderInfo) => {
    if (!order) return null;
    const pieces = order.pieces ?? [];
    if (!pieces.length) return null;
    return activePieceByOrder[order.baseInfo.id] ?? pieces[0]?.id ?? null;
  };

  const submitPass = async (orderId: number, pieceId: number) => {
    const order = orders.find((o) => o.baseInfo.id === orderId);
    const kind = resolveReviewKind(order);
    const pieces = order?.pieces ?? [];
    const piece = pieces.find((p) => p.id === pieceId);
    const alreadyPassed =
      kind === 'DESIGN'
        ? Boolean(piece?.designQualityPassed)
        : Boolean(piece?.modelQualityPassed);
    if (alreadyPassed) {
      message.info('该单件已通过质量评审');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await orderService.updateOrderReview(orderId, {
        reviewNotes:
          (kind === 'DESIGN' ? order?.designReviewInfo?.reviewNotes : order?.reviewInfo?.reviewNotes)
          || (kind === 'DESIGN' ? '设计质量评审通过' : '建模工艺评审通过'),
        rejectionReason: undefined,
        rejectedProcesses: [],
        reviewKind: kind,
        pieceId,
      });
      const allPassed = (updated.pieces ?? []).every((p) =>
        kind === 'DESIGN' ? p.designQualityPassed : p.modelQualityPassed
      );
      message.success(
        allPassed
          ? kind === 'DESIGN'
            ? '全部单件设计评审已通过，系统已自动发给客户审阅'
            : '全部单件建模评审已通过，系统已自动发给客户审阅'
          : `「${piece?.name || '单件'}」已通过，请继续审核其他单件`
      );
      onRefresh();
    } catch (e: unknown) {
      message.error(String((e as Error)?.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  const submitReject = async () => {
    if (rejectOrderId == null || rejectPieceId == null) {
      throw new Error('未选择要驳回的单件');
    }
    const reason = rejectReason.trim();
    if (!reason) {
      message.warning('请填写驳回原因');
      throw new Error('请填写驳回原因');
    }
    const order = orders.find((o) => o.baseInfo.id === rejectOrderId);
    const kind = resolveReviewKind(order);
    const piece = (order?.pieces ?? []).find((p) => p.id === rejectPieceId);
    setSubmitting(true);
    try {
      await orderService.updateOrderReview(rejectOrderId, {
        reviewNotes: kind === 'DESIGN' ? order?.designReviewInfo?.reviewNotes : order?.reviewInfo?.reviewNotes,
        rejectionReason: reason,
        reviewKind: kind,
        pieceId: rejectPieceId,
      });
      message.success(
        kind === 'DESIGN'
          ? `已驳回「${piece?.name || '单件'}」，订单退回设计师修改`
          : `已驳回「${piece?.name || '单件'}」，订单退回建模师修改`
      );
      setRejectOpen(false);
      onRefresh();
    } catch (e: unknown) {
      message.error(String((e as Error)?.message || e));
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  if (!loading && orders.length === 0) {
    return (
      <div className="tr-desk" style={{ padding: 24 }}>
        {mode === 'balance'
          ? '暂无待处理订单（客户确认建模后进入待发送生产会出现在这里；付尾款后仍保留，便于标记转发；未付款禁止转发）'
          : '暂无待质量审核订单（设计师或建模师提交后会出现在这里）'}
      </div>
    );
  }

  return (
    <div className={loading ? 'tr-desk-loading' : undefined}>
      {orders.map((order) => (
        <OrderReviewDesk
          key={order.baseInfo.id}
          order={order}
          mode={mode}
          loading={loading}
          activePieceId={activePieceByOrder[order.baseInfo.id]}
          activeFileByPiece={activeFileByPiece}
          queueTick={queueTick}
          onSelectPiece={(pieceId) =>
            setActivePieceByOrder((prev) => ({ ...prev, [order.baseInfo.id]: pieceId }))
          }
          onSelectFile={(pieceKey, fileId) =>
            setActiveFileByPiece((prev) => ({ ...prev, [pieceKey]: fileId }))
          }
          onReject={() => {
            const pid = resolveActivePieceId(order);
            if (pid == null) {
              message.warning('请先选择要驳回的单件');
              return;
            }
            openReject(order.baseInfo.id, pid);
          }}
          onPass={() => {
            const pid = resolveActivePieceId(order);
            if (pid == null) {
              message.warning('请先选择要通过的单件');
              return;
            }
            void submitPass(order.baseInfo.id, pid);
          }}
          onQuote={() => openQuote(order.baseInfo.id)}
          submitting={submitting || quoteSaving}
        />
      ))}

      <Modal
        title="按件驳回"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={() => submitReject()}
        okText="确认驳回本单件"
        okButtonProps={{ danger: true, disabled: !rejectReason.trim() }}
        confirmLoading={submitting}
      >
        <Text type="secondary">仅驳回当前选中的单件，其他已通过的单件不受影响。请填写驳回原因（必填）。</Text>
        <TextArea
          rows={4}
          style={{ marginTop: 8 }}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="例如：主石镶口尺寸与图纸不符，请建模师按新版说明修改。"
        />
      </Modal>

      <Modal
        title={quoteRevising ? '修改尾款报价' : '尾款报价（推送给客户支付）'}
        open={quoteOpen}
        onCancel={() => setQuoteOpen(false)}
        onOk={() => void submitQuote()}
        okText={quoteRevising ? '重新推送（原报价作废）' : '推送尾款报价'}
        okButtonProps={{ loading: quoteSaving, disabled: !quoteAmount.trim() }}
        confirmLoading={quoteSaving}
        width={560}
      >
        <Text type="secondary">
          {quoteRevising
            ? '客户尚未支付时可修改报价。重新推送后，聊天中的旧支付卡片将标为「已作废」，客户只能按新金额支付。'
            : '请按人民币填写尾款报价。系统会按当前汇率自动换算为美元推送给客户；客户支付成功后才能发送建模源文件给喷蜡厂。'}
        </Text>
        {quoteRevising && quoteOrder?.quotationInfo?.totalCost != null ? (
          <Text type="warning" style={{ display: 'block', marginTop: 8 }}>
            当前已推送：客户应付 ${Number(quoteOrder.quotationInfo.totalCost).toFixed(2)} USD
            {quoteOrder.quotationInfo.staffAmountCny != null
              ? `（人民币 ¥${quoteOrder.quotationInfo.staffAmountCny}）`
              : ''}
          </Text>
        ) : null}
        {quoteOrder ? (
          <div className="tr-quote-ref" style={{ marginTop: 12 }}>
            {quoteReferenceLines(quoteOrder).map((row) => (
              <div key={row.label} className="tr-quote-ref__row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        ) : null}
        {quotePublicityDiscount ? (
          <Text type="warning" style={{ display: 'block', marginTop: 8 }}>
            该客户已选择「保密不宣传 = 否」，换算为美元后将自动减免 USD 15 限时优惠。
          </Text>
        ) : null}
        <Input
          style={{ marginTop: 12 }}
          inputMode="decimal"
          value={quoteAmount}
          onChange={(e) => setQuoteAmount(e.target.value)}
          placeholder="人民币金额，例如 8000"
          prefix="¥"
          addonAfter="人民币"
        />
        {(() => {
          const cny = Number(quoteAmount);
          if (!(cny > 0)) return null;
          const rate = cnyPerUsd > 0 ? cnyPerUsd : 7.2;
          const usdGross = Math.round((cny / rate) * 100) / 100;
          const discount = quotePublicityDiscount ? 15 : 0;
          const usdNet = Math.max(0, Math.round((usdGross - discount) * 100) / 100);
          return (
            <div className="tr-quote-ref" style={{ marginTop: 10 }}>
              <div className="tr-quote-ref__row">
                <span>客户可见（约）</span>
                <strong>${usdNet.toFixed(2)} USD</strong>
              </div>
              <div className="tr-quote-ref__row">
                <span>换算明细</span>
                <strong>
                  ¥{cny} ÷ {rate}
                  {discount > 0 ? ` − $${discount} 限时优惠` : ''}
                </strong>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

type OrderReviewDeskProps = {
  order: OrderInfo;
  mode: 'quality' | 'review' | 'balance';
  loading: boolean;
  activePieceId?: number;
  activeFileByPiece: Record<number, number>;
  queueTick: number;
  onSelectPiece: (pieceId: number) => void;
  onSelectFile: (pieceKey: number, fileId: number) => void;
  onReject: () => void;
  onPass: () => void;
  onQuote: () => void;
  submitting: boolean;
};

const OrderReviewDesk: React.FC<OrderReviewDeskProps> = ({
  order,
  mode,
  loading,
  activePieceId,
  activeFileByPiece,
  queueTick,
  onSelectPiece,
  onSelectFile,
  onReject,
  onPass,
  onQuote,
  submitting,
}) => {
  const id = order.baseInfo.id;
  const pieces = order.pieces ?? [];
  const activePiece = pieces.find((p) => p.id === (activePieceId ?? pieces[0]?.id)) ?? pieces[0];

  const designUrls = activePiece ? pieceDesignUrls(order, activePiece) : [];
  const effectUrls = activePiece ? pieceEffectUrls(order, activePiece) : [];

  const sourceRows: ModelSourceFileRow[] = useMemo(() => {
    if (activePiece) {
      return collectOrderModelSourceRows({ pieces: [activePiece], modelInfo: undefined });
    }
    if (pieces.length === 0) return collectOrderModelSourceRows(order);
    return [];
  }, [activePiece, pieces.length, order]);

  const previewable = useMemo(
    () => sourceRows.filter((r) => canInlineMeshPreview(r.name)),
    [sourceRows]
  );
  const pieceKey = activePiece?.id ?? 0;
  const preferredFileId = activeFileByPiece[pieceKey];
  const activeFile =
    previewable.find((r) => r.id === preferredFileId)
    ?? previewable[0]
    ?? sourceRows.find((r) => isRasterImageFileName(r.name))
    ?? sourceRows[0]
    ?? null;

  useEffect(() => {
    if (!activePiece && pieces[0]) onSelectPiece(pieces[0].id);
  }, [activePiece, pieces, onSelectPiece]);

  useEffect(() => {
    if (previewable.length === 0) return;
    if (!preferredFileId || !previewable.some((r) => r.id === preferredFileId)) {
      onSelectFile(pieceKey, previewable[0].id);
    }
  }, [previewable, preferredFileId, pieceKey, onSelectFile]);

  const waxPassedCount = pieces.filter((p) => p.processVerified).length;
  const shareCandidates = pickShareCandidates(sourceRows);
  void queueTick;
  const fileIds = shareCandidates.map((c) => c.id);
  const pieceQueued = isPieceFullyQueued(id, activePiece?.id ?? null, fileIds);
  const pieceSent = isPieceFullySent(id, activePiece?.id ?? null, fileIds);
  const gate = resolveProductionGate(order);
  const isDesignReview =
    order.qualityReviewKind === 'DESIGN' || order.currentStatus === 'PENDING_DESIGN_REVIEW';
  const isQualityMode = mode === 'quality' || mode === 'review';
  const qualityPassedCount = pieces.filter((p) =>
    isDesignReview ? p.designQualityPassed : p.modelQualityPassed
  ).length;
  const activeQualityPassed = activePiece
    ? isDesignReview
      ? Boolean(activePiece.designQualityPassed)
      : Boolean(activePiece.modelQualityPassed)
    : false;

  const enqueuePendingSend = () => {
    if (!gate.canMarkSend) {
      message.warning(gate.blockReason || '请先完成报价并由客户支付尾款', 2);
      return;
    }
    const pieceName = activePiece?.name || (activePiece ? `单件${activePiece.seq}` : '订单源文件');
    const added = markWaxSendItems(
      shareCandidates.map((c) => ({
        orderId: id,
        orderNumber: order.baseInfo.orderNumber || `订单${id}`,
        pieceId: activePiece?.id ?? null,
        pieceName,
        fileId: c.id,
        fileName: c.name,
      }))
    );
    message.success(
      added > 0
        ? `已标记 ${added} 个文件待发送，可到「待发送」页批量转发`
        : '这些文件已在待发送列表中',
      2
    );
  };

  const togglePendingSend = () => {
    if (!shareCandidates.length) {
      message.warning('当前单件没有可发送的建模文件（优先 STL）', 2);
      return;
    }
    if (pieceQueued) {
      const n = unmarkWaxSendPiece(id, activePiece?.id ?? null);
      message.success(n > 0 ? '已取消待发送标记' : '未在待发送列表中', 2);
      return;
    }
    enqueuePendingSend();
  };

  const pendingBtnLabel = pieceQueued
    ? '已标记待发送'
    : pieceSent
      ? '已执行发送'
      : `标记待发送${shareCandidates.length > 1 ? ` (${shareCandidates.length})` : ''}`;

  return (
    <section className={`tr-desk${mode === 'balance' ? ' tr-desk--balance' : ''}`} aria-busy={loading}>
      <header className="tr-desk__head">
        <div className="tr-desk__head-main">
          <h3 className="tr-desk__order-no">{order.baseInfo.orderNumber}</h3>
          <Tag>{orderStatusLabel(order.currentStatus)}</Tag>
          <Tag color={gate.canMarkSend ? 'success' : gate.quoteSent ? 'warning' : 'processing'}>
            {gate.stageLabel}
          </Tag>
          <span className="tr-desk__customer">{order.baseInfo.customerName || '-'}</span>
          {pieces.length > 0 ? (
            isQualityMode ? (
              <Tag color={qualityPassedCount === pieces.length ? 'success' : 'processing'}>
                质量审 {qualityPassedCount}/{pieces.length} 件
              </Tag>
            ) : (
              <Tag color={waxPassedCount === pieces.length ? 'success' : 'processing'}>
                单件 {waxPassedCount}/{pieces.length} 喷蜡同步
              </Tag>
            )
          ) : null}
        </div>
        <div className="tr-desk__actions">
          {isQualityMode ? (
            <Button type="primary" onClick={onPass} disabled={submitting || !activePiece || activeQualityPassed}>
              {activeQualityPassed
                ? '本单件已通过'
                : qualityPassedCount + 1 >= pieces.length && pieces.length > 0
                  ? '本单件通过并发给客户'
                  : '本单件通过'}
            </Button>
          ) : null}
          {gate.canQuote || (mode === 'balance' && !gate.quoteSent && !gate.balancePaid) ? (
            <Button type="primary" onClick={onQuote} disabled={submitting || !gate.allModelConfirmed}>
              填写并推送报价
            </Button>
          ) : null}
          {gate.canReviseQuote || (mode === 'balance' && gate.quoteSent && !gate.balancePaid) ? (
            <Button onClick={onQuote} disabled={submitting || !gate.allModelConfirmed}>
              修改报价
            </Button>
          ) : null}
          {mode === 'balance' && gate.unpaidPendingProduction ? (
            <Tag color="error">客户未支付尾款 · 禁止转发</Tag>
          ) : null}
          {mode === 'balance' && gate.quoteSent && !gate.balancePaid ? (
            <Tag color="orange">已报价 · 等待客户付款（可修改）</Tag>
          ) : null}
          {mode === 'balance' && gate.balancePaid ? (
            <Tag color="success">尾款已支付 · 可去待发送</Tag>
          ) : null}
          {mode === 'balance' && gate.canMarkSend ? (
            <Button
              type={pieceQueued || pieceSent ? 'default' : 'primary'}
              icon={pieceQueued || pieceSent ? <CheckOutlined /> : <FlagOutlined />}
              disabled={submitting || shareCandidates.length === 0 || (!gate.canMarkSend && !pieceQueued)}
              title={
                !gate.canMarkSend && !pieceQueued
                  ? gate.blockReason
                  : pieceSent && !pieceQueued
                    ? '再次点击可在付款后重新加入待发送'
                    : undefined
              }
              onClick={togglePendingSend}
            >
              {pendingBtnLabel}
            </Button>
          ) : null}
          {isQualityMode ? (
            <Button danger onClick={onReject} disabled={submitting || !activePiece || activeQualityPassed}>
              驳回本单件
            </Button>
          ) : null}
          <Link to={`/orders/${id}`} target="_blank" rel="noreferrer">
            <Button icon={<ExportOutlined />}>订单详情</Button>
          </Link>
        </div>
      </header>

      {isQualityMode ? (
        <div className="tr-kind" aria-label="评审类型">
          <Tag color={isDesignReview ? 'blue' : 'purple'} style={{ margin: 0, fontSize: 13, padding: '2px 10px' }}>
            {isDesignReview ? '设计图' : '建模图'}
          </Tag>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {isDesignReview ? '审核本单件设计稿' : '审核本单件建模效果图 / 源文件'}
          </Text>
        </div>
      ) : (
        <div className="tr-pipeline" aria-label="进度">
          {[
            { key: 'confirm', label: '1 客户已确认', done: gate.allModelConfirmed },
            { key: 'quote', label: '2 报价', done: gate.quoteSent || gate.balancePaid },
            { key: 'pay', label: '3 客户付款', done: gate.balancePaid },
            { key: 'send', label: '4 解锁分享', done: pieceSent || (gate.balancePaid && pieceQueued) },
          ].map((step) => (
            <div key={step.key} className={`tr-pipeline__step${step.done ? ' is-done' : ''}`}>
              {step.label}
            </div>
          ))}
        </div>
      )}

      <div className="tr-desk__pieces" role="tablist" aria-label="单件切换">
        {pieces.length === 0 ? (
          <Text type="secondary" style={{ padding: '4px 0' }}>
            暂无单件 · 将按订单级源文件预览
          </Text>
        ) : (
          pieces.map((piece) => {
            const selected = piece.id === activePiece?.id;
            const qualityOk = isDesignReview
              ? Boolean(piece.designQualityPassed)
              : Boolean(piece.modelQualityPassed);
            let statusLabel = '待审';
            if (isQualityMode) {
              if (qualityOk) {
                statusLabel = '质量已通过';
              } else if (isDesignReview && piece.designConfirmed) {
                statusLabel = '客户已确认';
              } else if (!isDesignReview && piece.modelConfirmed) {
                statusLabel = '客户已确认';
              } else {
                statusLabel = '待质量审';
              }
            } else if (piece.processVerified) {
              statusLabel = '已通过 · 喷蜡同步';
            } else {
              statusLabel = '待验证';
            }
            return (
              <button
                key={piece.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`tr-desk__piece${selected ? ' is-active' : ''}${
                  (isQualityMode ? qualityOk : piece.processVerified) ? ' is-passed' : ''
                }`}
                onClick={() => onSelectPiece(piece.id)}
              >
                <span className="tr-desk__piece-name">{piece.name || `单件${piece.seq}`}</span>
                <span className="tr-desk__piece-status">{statusLabel}</span>
              </button>
            );
          })
        )}
      </div>

      <div className="tr-desk__body">
        <aside className="tr-desk__refs">
          <div className="tr-desk__section">
            <div className="tr-desk__section-title">
              设计图
              <span>{activePiece?.name || (pieces.length ? '' : '整单')}</span>
            </div>
            <ThumbGrid urls={designUrls} empty="本单件暂无设计图" />
          </div>
          <div className="tr-desk__section">
            <div className="tr-desk__section-title">
              建模效果图
              <span>{effectUrls.length ? `${effectUrls.length} 张` : ''}</span>
            </div>
            <ThumbGrid urls={effectUrls} empty="本单件暂无效果图" />
          </div>
          {isQualityMode && !isDesignReview ? (
            <div className="tr-desk__section">
              <div className="tr-desk__section-title">
                源文件
                <span>{sourceRows.length ? `${sourceRows.length} 个` : ''}</span>
              </div>
              {sourceRows.length === 0 ? (
                <div className="tr-desk__empty">暂无建模源文件</div>
              ) : (
                <div className="tr-desk__file-list">
                  {sourceRows.map((f) => {
                    const selected = activeFile?.id === f.id;
                    const canOrbit = canInlineMeshPreview(f.name);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        className={`tr-desk__file-row${selected ? ' is-active' : ''}`}
                        onClick={() => onSelectFile(pieceKey, f.id)}
                        title={f.name}
                      >
                        <span className="tr-desk__file-name">{f.name}</span>
                        {canOrbit ? <Tag color="gold">可预览</Tag> : <Tag>下载</Tag>}
                        <Button
                          type="text"
                          size="small"
                          icon={<DownloadOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            void downloadModelFile(f.id, f.name).catch((err: unknown) =>
                              message.error(String((err as Error)?.message || err))
                            );
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </aside>

        {isQualityMode && !isDesignReview ? (
          <main className="tr-desk__stage">
            {activeFile && canInlineMeshPreview(activeFile.name) ? (
              <>
                <div className="tr-desk__stage-bar">
                  <span title={activeFile.name}>{activeFile.name}</span>
                  <Space size={4} wrap>
                    {previewable.length > 1
                      ? previewable.map((f, idx) => (
                          <Button
                            key={f.id}
                            size="small"
                            type={f.id === activeFile.id ? 'primary' : 'default'}
                            ghost={f.id !== activeFile.id}
                            onClick={() => onSelectFile(pieceKey, f.id)}
                          >
                            {idx + 1}
                          </Button>
                        ))
                      : null}
                  </Space>
                </div>
                <div className="tr-desk__stage-viewport">
                  <ModelMeshViewport
                    key={activeFile.id}
                    file={modelSourceRowToUploadFile(activeFile)}
                    fill
                    overlayControls
                    defaultAutoRotate
                    onDownload={(fileId, fileName) => {
                      void downloadModelFile(fileId, fileName).catch((e: unknown) =>
                        message.error(String((e as Error)?.message || e))
                      );
                    }}
                  />
                </div>
              </>
            ) : activeFile && isRasterImageFileName(activeFile.name) && activeFile.url ? (
              <div className="tr-desk__stage-empty" style={{ background: '#111' }}>
                <Image src={activeFile.url} style={{ maxHeight: '70vh', maxWidth: '100%' }} />
              </div>
            ) : (
              <div className="tr-desk__stage-empty">
                {sourceRows.length === 0
                  ? '选择有源文件的单件后，可在此 360° 预览 STEP / 网格模型'
                  : '当前文件无法内嵌预览，请在左侧下载后用 CAD 打开'}
              </div>
            )}
          </main>
        ) : null}
      </div>
    </section>
  );
};

export default TrackerReviewTodoPanel;
