import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Button,
  Card,
  Image,
  Input,
  Pagination,
  Select,
  Space,
  Timeline,
  Typography,
  Upload,
  message,
  Modal,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { DownloadOutlined, PlusOutlined, ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { orderService } from '@/services/orderService';
import type { OrderInfo, OrderProductionFollowLogDto } from '@/types/order';
import { orderStatusLabel } from '@/utils/orderLabels';
import { isRasterImageFileName } from '@/utils/isRasterImageFileName';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
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

const FollowLogImages: React.FC<{ fileIds: number[] }> = ({ fileIds }) => {
  const [urls, setUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;
    const key = fileIds.join(',');
    if (!key) return;
    void (async () => {
      const next: Record<number, string> = {};
      for (const id of fileIds) {
        try {
          const u = await orderService.previewFile(id);
          if (u) next[id] = u;
        } catch {
          /* 单张失败不影响其余 */
        }
      }
      if (!cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [fileIds]);

  if (!fileIds.length) return null;
  return (
    <Space wrap style={{ marginTop: 8 }}>
      {fileIds.map((fid) =>
        urls[fid] ? (
          <Image key={fid} width={96} height={96} src={urls[fid]} style={{ objectFit: 'cover', borderRadius: 6 }} />
        ) : (
          <Text key={fid} type="secondary">
            加载图片…
          </Text>
        )
      )}
    </Space>
  );
};

const B2B_OPTIONS = [
  { value: undefined, label: '全部订单' },
  { value: false, label: 'C端订单' },
  { value: true, label: 'B端订单' },
];

const TrackerFollowUpPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isB2b, setIsB2b] = useState<boolean | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [logsByOrder, setLogsByOrder] = useState<Record<number, OrderProductionFollowLogDto[]>>({});
  const [logsLoading, setLogsLoading] = useState<Record<number, boolean>>({});

  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});
  const [fileDraft, setFileDraft] = useState<Record<number, UploadFile[]>>({});
  const [submitting, setSubmitting] = useState<Record<number, boolean>>({});
  const [completing, setCompleting] = useState<Record<number, boolean>>({});

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orderService.workbenchTrackerProducing(page - 1, pageSize, isB2b);
      setOrders(res?.content ?? []);
      setTotal(res?.totalElements ?? 0);
    } catch {
      message.error('加载生产中订单失败');
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, isB2b]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const fetchLogs = useCallback(async (orderId: number) => {
    setLogsLoading((m) => ({ ...m, [orderId]: true }));
    try {
      const list = await orderService.listProductionFollowLogs(orderId);
      setLogsByOrder((m) => ({ ...m, [orderId]: list }));
    } catch {
      message.error('加载跟单记录失败');
    } finally {
      setLogsLoading((m) => ({ ...m, [orderId]: false }));
    }
  }, []);

  const orderIdsKey = useMemo(() => orders.map((o) => o.baseInfo.id).join(','), [orders]);

  useEffect(() => {
    if (!orderIdsKey) return;
    orders.forEach((o) => void fetchLogs(o.baseInfo.id));
  }, [orderIdsKey, orders, fetchLogs]);

  const submitLog = async (orderId: number) => {
    const note = (noteDraft[orderId] || '').trim();
    const files = fileDraft[orderId] || [];
    const rawFiles = files.map((f) => f.originFileObj).filter(Boolean) as File[];
    if (!note && rawFiles.length === 0) {
      message.warning('请填写工序说明或选择至少一张过程图');
      return;
    }
    setSubmitting((m) => ({ ...m, [orderId]: true }));
    try {
      const ids: number[] = [];
      for (const file of rawFiles) {
        const info = await orderService.uploadProductionFollowImage(orderId, file);
        ids.push(info.id);
      }
      await orderService.addProductionFollowLog(orderId, { note: note || undefined, imageFileIds: ids.length ? ids : undefined });
      message.success('已添加跟单记录');
      setNoteDraft((m) => ({ ...m, [orderId]: '' }));
      setFileDraft((m) => ({ ...m, [orderId]: [] }));
      await fetchLogs(orderId);
    } catch (e: unknown) {
      message.error(String((e as Error)?.message || e));
    } finally {
      setSubmitting((m) => ({ ...m, [orderId]: false }));
    }
  };

  const confirmComplete = (order: OrderInfo) => {
    const id = order.baseInfo.id;
    Modal.confirm({
      title: '确认生产完成？',
      content: '确认后订单将关闭完整生产流程并进入「已完成」，请确保生产已全部结束。',
      okText: '确认完成',
      cancelText: '取消',
      onOk: async () => {
        setCompleting((m) => ({ ...m, [id]: true }));
        try {
          await orderService.completeProduction(id);
          message.success('订单已标记为生产完成');
          await loadOrders();
          setLogsByOrder((m) => {
            const next = { ...m };
            delete next[id];
            return next;
          });
        } catch (e: unknown) {
          message.error(String((e as Error)?.message || e));
        } finally {
          setCompleting((m) => ({ ...m, [id]: false }));
        }
      },
    });
  };

  const orderCards = useMemo(
    () =>
      orders.map((order) => {
        const id = order.baseInfo.id;
        const designUrls = order.designInfo?.designImages || [];
        const effectUrls = order.modelInfo?.modelEffectImages || [];
        const modelRows = collectModelFileRows(order);
        const logs = logsByOrder[id] || [];
        const logPending = logsLoading[id] && logs.length === 0;

        return (
          <Card
            key={id}
            style={{ marginBottom: 16 }}
            title={
              <Space wrap>
                <Title level={5} style={{ margin: 0 }}>
                  {order.baseInfo.orderNumber}
                </Title>
                <Text type="secondary">{orderStatusLabel(order.currentStatus)}</Text>
                <Text type="secondary">{order.baseInfo.customerName || '-'}</Text>
              </Space>
            }
            extra={
              <Space wrap>
                <Button
                  type="link"
                  size="small"
                  onClick={() =>
                    navigate(`/orders/${id}`, {
                      state: { backTo: `${location.pathname}${location.search}` },
                    })
                  }
                >
                  订单详情
                </Button>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={!!completing[id]}
                  onClick={() => confirmComplete(order)}
                >
                  生产完成
                </Button>
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div style={{ background: '#fafafa', padding: 12, borderRadius: 8 }}>
                <Text strong>设计图</Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {designUrls.length === 0 ? (
                    <Text type="secondary">暂无</Text>
                  ) : (
                    designUrls.map((url, i) => (
                      <Image key={i} width={100} height={100} src={url} style={{ objectFit: 'cover', borderRadius: 6 }} />
                    ))
                  )}
                </div>
              </div>
              <div style={{ background: '#fafafa', padding: 12, borderRadius: 8 }}>
                <Text strong>建模效果图（预览）</Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {effectUrls.length === 0 ? (
                    <Text type="secondary">暂无</Text>
                  ) : (
                    effectUrls.map((url, i) => (
                      <Image key={i} width={100} height={100} src={url} style={{ objectFit: 'cover', borderRadius: 6 }} />
                    ))
                  )}
                </div>
              </div>
              <div style={{ background: '#fafafa', padding: 12, borderRadius: 8 }}>
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
                            <Image src={f.url} width={64} height={64} style={{ objectFit: 'cover', borderRadius: 4 }} />
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
                            下载
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

              <div>
                <Text strong>跟单过程记录</Text>
                {logPending ? (
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">加载中…</Text>
                  </div>
                ) : logs.length === 0 ? (
                  <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                    暂无记录，可在下方添加。
                  </Text>
                ) : (
                  <Timeline style={{ marginTop: 12 }} items={logs.map((log) => ({
                    children: (
                      <div>
                        <Text type="secondary">
                          {log.createdAt ? dayjs(log.createdAt).format('YYYY-MM-DD HH:mm') : ''} · {log.authorName || '跟单员'}
                        </Text>
                        {log.note ? (
                          <div style={{ marginTop: 4 }}>
                            <Text>{log.note}</Text>
                          </div>
                        ) : null}
                        {log.imageFileIds?.length ? <FollowLogImages fileIds={log.imageFileIds} /> : null}
                      </div>
                    ),
                  }))} />
                )}
              </div>

              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                <Text strong>添加过程记录</Text>
                <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                  可上传工序现场图并填写简短文字说明（至少填一项）。
                </Text>
                <Upload
                  multiple
                  listType="picture-card"
                  fileList={fileDraft[id] || []}
                  beforeUpload={() => false}
                  onChange={({ fileList }) => setFileDraft((m) => ({ ...m, [id]: fileList }))}
                  style={{ marginTop: 8 }}
                >
                  {(fileDraft[id]?.length || 0) >= 8 ? null : (
                    <div>
                      <PlusOutlined />
                      <div style={{ marginTop: 8 }}>上传图片</div>
                    </div>
                  )}
                </Upload>
                <TextArea
                  rows={3}
                  style={{ marginTop: 8 }}
                  placeholder="例如：执模完成，已交镶石。"
                  value={noteDraft[id] || ''}
                  onChange={(e) => setNoteDraft((m) => ({ ...m, [id]: e.target.value }))}
                />
                <Button
                  type="primary"
                  style={{ marginTop: 8 }}
                  loading={!!submitting[id]}
                  onClick={() => void submitLog(id)}
                >
                  提交记录
                </Button>
              </div>
            </Space>
          </Card>
        );
      }),
    [orders, logsByOrder, logsLoading, noteDraft, fileDraft, submitting, completing, navigate, location]
  );

  return (
    <div>
      <Card bordered={false}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} align="center" wrap>
          <div>
            <Title level={3} style={{ margin: 0 }}>
              跟单记录
            </Title>
            <Text type="secondary">生产中订单 · 过程记录与生产完成</Text>
          </div>
          <Space wrap>
            <Select
              value={isB2b}
              onChange={(v) => {
                setIsB2b(v);
                setPage(1);
              }}
              options={B2B_OPTIONS}
              style={{ width: 120 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void loadOrders()}>
              刷新
            </Button>
          </Space>
        </Space>

        <div style={{ marginTop: 16 }}>{loading && orders.length === 0 ? <Text type="secondary">加载中…</Text> : orderCards}</div>

        {!loading && orders.length === 0 ? (
          <Card style={{ marginTop: 16 }}>
            <Text type="secondary">暂无生产中订单。工艺评审通过后，订单会出现在此处。</Text>
          </Card>
        ) : null}

        {total > 0 ? (
          <Pagination
            style={{ marginTop: 16, textAlign: 'right' }}
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            onChange={(p, ps) => {
              setPage(p);
              setPageSize(ps);
            }}
          />
        ) : null}
      </Card>
    </div>
  );
};

export default TrackerFollowUpPage;
