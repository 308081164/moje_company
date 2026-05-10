import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, ConfigProvider, Spin, Tag, Timeline, Typography, Empty } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import { API_ORIGIN } from '@/services/api';
import type { CustomerOrderPublic } from '@/types/order';
import { orderStatusColor, orderStatusLabel } from '@/utils/orderLabels';

const { Title, Text, Paragraph } = Typography;

async function fetchPublicSummary(token: string): Promise<CustomerOrderPublic> {
  const url = `${API_ORIGIN}/api/public/customer-order/${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `加载失败（${res.status}）`);
  }
  return res.json() as Promise<CustomerOrderPublic>;
}

const CustomerOrderStatusPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<CustomerOrderPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setErr('链接无效');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const d = await fetchPublicSummary(token);
        if (!cancelled) {
          setData(d);
          setErr(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : '加载失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const body = loading ? (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <Spin size="large" />
    </div>
  ) : err ? (
    <Card style={{ maxWidth: 520, margin: '24px auto', borderRadius: 16 }}>
      <Empty description={err} />
    </Card>
  ) : data ? (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(165deg, #e6f4ff 0%, #f6f7fb 42%, #ffffff 100%)',
        padding: '20px 16px 40px',
      }}
    >
      <Card
        style={{
          maxWidth: 440,
          margin: '0 auto',
          borderRadius: 16,
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
          border: 'none',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            定制订单进度
          </Text>
          <Title level={4} style={{ margin: '8px 0 0' }}>
            {data.displayTitle}
          </Title>
          <Tag color={orderStatusColor(data.currentStatus)} style={{ marginTop: 10 }}>
            {data.currentStatusLabel || orderStatusLabel(data.currentStatus)}
          </Tag>
        </div>

        {data.firstDesignImageUrl && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <img
              src={data.firstDesignImageUrl}
              alt="设计预览"
              style={{
                width: '100%',
                maxHeight: 220,
                objectFit: 'cover',
                borderRadius: 12,
                background: '#f0f0f0',
              }}
            />
          </div>
        )}

        <DescriptionsBlock data={data} />

        {data.milestones && data.milestones.length > 0 && (
          <>
            <Paragraph type="secondary" style={{ marginTop: 24, marginBottom: 8 }}>
              关键节点
            </Paragraph>
            <Timeline
              items={data.milestones.map((m) => ({
                color: 'blue',
                children: (
                  <div>
                    <Text strong>{m.label}</Text>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(m.at).format('YYYY-MM-DD HH:mm')}
                      </Text>
                    </div>
                  </div>
                ),
              }))}
            />
          </>
        )}
      </Card>
    </div>
  ) : null;

  return (
    <ConfigProvider locale={zhCN}>
      {body}
    </ConfigProvider>
  );
};

function DescriptionsBlock({ data }: { data: CustomerOrderPublic }) {
  return (
    <div
      style={{
        background: '#fafafa',
        borderRadius: 12,
        padding: '14px 16px',
        fontSize: 14,
      }}
    >
      <Row label="订单编号" value={data.orderNumber} />
      {data.customerNameMasked && <Row label="客户称呼" value={data.customerNameMasked} />}
      {data.createdAt && (
        <Row label="创建时间" value={dayjs(data.createdAt).format('YYYY-MM-DD HH:mm')} />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0' }}>
      <Text type="secondary">{label}</Text>
      <Text style={{ textAlign: 'right', wordBreak: 'break-all' }}>{value}</Text>
    </div>
  );
}

export default CustomerOrderStatusPage;
