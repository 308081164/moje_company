import type { FormInstance } from 'antd/es/form';
import dayjs from 'dayjs';
import type { OrderDraftFromChatImageResponse } from '@/types/order';
import { OrderSource } from '@/types/order';

/** 将识图草稿写入新建订单表单（不自动提交） */
export function applyChatDraftToOrderForm(form: FormInstance, d: OrderDraftFromChatImageResponse) {
  const values: Record<string, unknown> = {};
  if (d.customerName != null && d.customerName !== '') values.customerName = d.customerName;
  if (d.customerContact != null && d.customerContact !== '') values.customerContact = d.customerContact;
  if (d.customerWechat != null && d.customerWechat !== '') values.customerWechat = d.customerWechat;
  if (d.source != null && d.source !== '') {
    const s = String(d.source).toUpperCase();
    if (Object.values(OrderSource).includes(s as OrderSource)) {
      values.source = s as OrderSource;
    }
  }
  if (d.sourceDetail != null && d.sourceDetail !== '') values.sourceDetail = d.sourceDetail;
  if (d.depositAmount != null && !Number.isNaN(Number(d.depositAmount))) {
    values.depositAmount = Number(d.depositAmount);
  }
  if (d.style != null && d.style !== '') values.style = d.style;
  if (d.materialInfo != null && d.materialInfo !== '') values.materialInfo = d.materialInfo;
  if (d.basicRequirements != null && d.basicRequirements !== '') values.basicRequirements = d.basicRequirements;
  if (d.orderTime != null && d.orderTime !== '') {
    const t = dayjs(d.orderTime);
    if (t.isValid()) values.orderTime = t;
  }
  form.setFieldsValue(values);
}
