import React, { useState } from 'react';
import { Button, Card, DatePicker, Form, Input, Select, Space, Typography, message } from 'antd';
import type { Dayjs } from 'dayjs';
import { downloadPostWithAuth } from '@/utils/download';

const { Paragraph } = Typography;

type Range = [Dayjs | null, Dayjs | null] | null;

const BulkExportPage: React.FC = () => {
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingArch, setLoadingArch] = useState(false);
  const [range, setRange] = useState<Range>(null);
  const [segment, setSegment] = useState<string>('ALL');
  const [orderIdsText, setOrderIdsText] = useState('');

  const exportOrdersZip = async () => {
    setLoadingOrders(true);
    try {
      const body: { segment: string; startDate?: string; endDate?: string } = { segment };
      if (range?.[0]) body.startDate = range[0].format('YYYY-MM-DD');
      if (range?.[1]) body.endDate = range[1].format('YYYY-MM-DD');
      await downloadPostWithAuth('/admin/exports/orders-zip', body, 'orders_export.zip');
      message.success('已开始下载订单 ZIP');
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '导出失败');
    } finally {
      setLoadingOrders(false);
    }
  };

  const exportArchivesZip = async () => {
    const ids = orderIdsText
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!ids.length) {
      message.warning('请输入至少一个订单数字 ID（逗号或空格分隔）');
      return;
    }
    setLoadingArch(true);
    try {
      await downloadPostWithAuth('/admin/exports/modeling-archives-zip', { orderIds: ids }, 'modeling_archives_export.zip');
      message.success('已开始下载建模归档 ZIP');
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '导出失败');
    } finally {
      setLoadingArch(false);
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="批量导出订单（含附件）">
        <Paragraph type="secondary">
          按创建时间筛选，可选 B 端 / C 端 / 全部；ZIP 内含 orders_index.csv、每单 summary 与 attachments 目录（从 OSS 拉取）。
        </Paragraph>
        <Form layout="inline" style={{ flexWrap: 'wrap', rowGap: 12 }}>
          <Form.Item label="端">
            <Select
              style={{ width: 140 }}
              value={segment}
              onChange={setSegment}
              options={[
                { value: 'ALL', label: '全部' },
                { value: 'B2B', label: 'B 端' },
                { value: 'C2C', label: 'C 端' },
              ]}
            />
          </Form.Item>
          <Form.Item label="创建日期">
            <DatePicker.RangePicker value={range} onChange={(v) => setRange(v as Range)} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" loading={loadingOrders} onClick={() => void exportOrdersZip()}>
              下载订单 ZIP
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="批量导出建模归档材料">
        <Paragraph type="secondary">
          输入订单 ID 列表（数字），打包每单的 archive.json、标记截图及建模相关附件（MODEL / ARCHIVE_MARKER）。
        </Paragraph>
        <Space direction="vertical" style={{ width: '100%', maxWidth: 720 }}>
          <Input.TextArea
            rows={4}
            value={orderIdsText}
            onChange={(e) => setOrderIdsText(e.target.value)}
            placeholder="订单数字 ID，逗号、空格或换行分隔，例如：101, 205 310"
          />
          <Button type="primary" loading={loadingArch} onClick={() => void exportArchivesZip()}>
            下载建模归档 ZIP
          </Button>
        </Space>
      </Card>
    </Space>
  );
};

export default BulkExportPage;
