import { CertificateType, OrderStatus, type OrderInfo, type OrderPieceInfo } from '@/types/order';

export type ProductionGate = {
  allModelConfirmed: boolean;
  quoteSent: boolean;
  balancePaid: boolean;
  canQuote: boolean;
  /** 已推送报价且客户未付款时可修改（旧报价作废） */
  canReviseQuote: boolean;
  canMarkSend: boolean;
  /** 客户未付尾款的待发送生产 */
  unpaidPendingProduction: boolean;
  /** 当前阶段文案 */
  stageLabel: string;
  /** 拦截原因（不可发送时） */
  blockReason?: string;
};

function allPiecesModelConfirmed(order: OrderInfo): boolean {
  const pieces = order.pieces ?? [];
  if (!pieces.length) return false;
  return pieces.every((p) => Boolean(p.modelConfirmed));
}

export function resolveProductionGate(order: OrderInfo): ProductionGate {
  const allModelConfirmed = allPiecesModelConfirmed(order);
  const quoteSent =
    Boolean(order.balanceQuoteSent)
    || Boolean(order.quotationInfo?.finalized);
  const balancePaid = Boolean(order.balancePaid);
  const unpaidPendingProduction =
    Boolean(order.balanceUnpaidPendingProduction)
    || (order.currentStatus === OrderStatus.PENDING_PRODUCTION && !balancePaid);
  const canQuote = unpaidPendingProduction && !quoteSent && !balancePaid;
  const canReviseQuote = unpaidPendingProduction && quoteSent && !balancePaid;
  // 硬门禁：未付尾款禁止标记/转发 STL
  const canMarkSend = balancePaid;

  let stageLabel = '待核对';
  let blockReason: string | undefined;
  if (order.awaitingCustomerModelConfirm) {
    stageLabel = '待客户审阅';
    blockReason = '工艺已通过，等待客户确认全部建模稿';
  } else if (!allModelConfirmed) {
    stageLabel = '建模未齐';
    blockReason = '请先完成工艺评审；客户确认全部建模稿后再报价与发送';
  } else if (unpaidPendingProduction && !quoteSent) {
    stageLabel = '待发送生产 · 客户未支付尾款';
    blockReason = '订单已标记待发送生产，请先报价；客户支付尾款前禁止转发建模源文件';
  } else if (unpaidPendingProduction) {
    stageLabel = '待发送生产 · 等待客户付款';
    blockReason = '客户尚未支付尾款，禁止转发建模源文件';
  } else if (!quoteSent) {
    stageLabel = '待报价';
    blockReason = '请先根据材质/克重/工艺/保密与证书等完成尾款报价并推送给客户';
  } else if (!balancePaid) {
    stageLabel = '待客户付款';
    blockReason = '尾款已推送，请等待客户支付成功后再发送建模源文件给喷蜡厂';
  } else {
    stageLabel = '可发送生产';
  }

  return {
    allModelConfirmed,
    quoteSent,
    balancePaid,
    canQuote,
    canReviseQuote,
    canMarkSend,
    unpaidPendingProduction,
    stageLabel,
    blockReason: canMarkSend ? undefined : blockReason,
  };
}

export function pieceWeightSummary(pieces: OrderPieceInfo[] | undefined): string {
  if (!pieces?.length) return '-';
  const parts = pieces
    .map((p) => {
      const w = p.model?.weight;
      if (w == null || !(Number(w) > 0)) return null;
      return `${p.name || `单件${p.seq}`} ${Number(w)}g`;
    })
    .filter(Boolean);
  return parts.length ? parts.join('；') : '未填克重';
}

export function quoteReferenceLines(order: OrderInfo): { label: string; value: string }[] {
  const q = order.quotationInfo;
  const brief = order.customerBrief;
  const certs: string[] = [];
  if (q?.copyrightCertificate || q?.certificateTypes?.includes(CertificateType.COPYRIGHT)) certs.push('版权证书');
  if (q?.appraisalCertificate || q?.certificateTypes?.includes(CertificateType.APPRAISAL)) certs.push('鉴定证书');
  if (q?.certificateTypes?.length) {
    for (const t of q.certificateTypes) {
      if (t === CertificateType.COPYRIGHT || t === CertificateType.APPRAISAL) continue;
      certs.push(String(t));
    }
  }
  const confidential =
    q?.confidential === true ? '保密不宣传' : q?.confidential === false ? '允许宣传（可享优惠）' : '未选';

  return [
    { label: '金属材质', value: brief?.metalLabel || order.baseInfo.materialInfo || '-' },
    { label: '客户预算', value: brief?.budgetLabel || '-' },
    { label: '定金', value: order.baseInfo.depositAmount != null ? `¥${order.baseInfo.depositAmount}` : '-' },
    { label: '克重参考', value: pieceWeightSummary(order.pieces) },
    { label: '保密选项', value: confidential },
    { label: '证书', value: certs.length ? certs.join('、') : (q?.certificateCost ? `证书费 ¥${q.certificateCost}` : '无/未选') },
    {
      label: '费用明细',
      value: q
        ? [
            q.materialCost ? `材质¥${q.materialCost}` : null,
            q.weightCost ? `克重¥${q.weightCost}` : null,
            q.processCost || q.laborCost ? `工艺/工费¥${(q.processCost || 0) + (q.laborCost || 0)}` : null,
            q.stoneCost ? `石料¥${q.stoneCost}` : null,
            q.designBuyout ? `买断¥${q.designBuyoutCost || 0}` : null,
            q.otherCost ? `其他¥${q.otherCost}` : null,
          ]
            .filter(Boolean)
            .join(' · ') || '暂无分项'
        : '暂无',
    },
  ];
}
