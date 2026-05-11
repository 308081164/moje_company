import type { FormInstance } from 'antd/es/form';
import dayjs from 'dayjs';
import type { OrderDraftFromChatImageResponse } from '@/types/order';
import { OrderSource } from '@/types/order';

export type ApplyChatDraftOptions = {
  /** 为 true 时：标量字段仅在表单为空时写入；基础需求/材质等长文本会追加合并 */
  merge?: boolean;
};

function mergeParagraph(prev: string, next: string): string {
  const a = (prev || '').trim();
  const b = (next || '').trim();
  if (!b) return a;
  if (!a) return b;
  return `${a}\n\n---\n\n${b}`;
}

/** 将识图草稿写入新建订单表单（不自动提交） */
export function applyChatDraftToOrderForm(
  form: FormInstance,
  d: OrderDraftFromChatImageResponse,
  opts?: ApplyChatDraftOptions
) {
  const merge = !!opts?.merge;
  const cur = merge ? (form.getFieldsValue() as Record<string, unknown>) : {};
  const values: Record<string, unknown> = {};

  const pickScalar = (field: string, draftVal: string | null | undefined) => {
    const n = draftVal?.trim();
    if (!n) return;
    const existing = cur[field];
    const empty = existing == null || String(existing).trim() === '';
    if (!merge || empty) {
      values[field] = n;
    }
  };

  pickScalar('customerName', d.customerName);
  pickScalar('customerContact', d.customerContact);
  pickScalar('customerWechat', d.customerWechat);

  if (d.source != null && d.source !== '') {
    let s = String(d.source).toUpperCase();
    if (s === 'INFLUENCER') {
      s = OrderSource.RECOMMEND;
    }
    if (Object.values(OrderSource).includes(s as OrderSource)) {
      const existing = cur.source;
      const empty = existing == null || String(existing).trim() === '';
      if (!merge || empty) {
        values.source = s as OrderSource;
      }
    }
  }
  pickScalar('sourceDetail', d.sourceDetail);

  if (d.depositAmount != null && !Number.isNaN(Number(d.depositAmount))) {
    const num = Number(d.depositAmount);
    const hasDeposit =
      merge &&
      cur.depositAmount != null &&
      !Number.isNaN(Number(cur.depositAmount)) &&
      Number(cur.depositAmount) > 0;
    if (!hasDeposit) {
      values.depositAmount = num;
    }
  }

  pickScalar('style', d.style);

  if (d.materialInfo != null && d.materialInfo.trim()) {
    if (merge) {
      const merged = mergeParagraph(String(cur.materialInfo ?? ''), d.materialInfo);
      if (merged !== String(cur.materialInfo ?? '')) values.materialInfo = merged;
    } else {
      values.materialInfo = d.materialInfo;
    }
  }

  if (d.basicRequirements != null && d.basicRequirements.trim()) {
    if (merge) {
      const merged = mergeParagraph(String(cur.basicRequirements ?? ''), d.basicRequirements);
      if (merged !== String(cur.basicRequirements ?? '')) values.basicRequirements = merged;
    } else {
      values.basicRequirements = d.basicRequirements;
    }
  }

  if (d.orderTime != null && d.orderTime !== '') {
    const t = dayjs(d.orderTime);
    if (t.isValid()) {
      const existing = cur.orderTime;
      const empty = !existing || !dayjs(existing as any).isValid();
      if (!merge || empty) {
        values.orderTime = t;
      }
    }
  }

  if (Object.keys(values).length > 0) {
    form.setFieldsValue(values);
  }
}
