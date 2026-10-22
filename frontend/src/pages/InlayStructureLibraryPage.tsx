import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Tabs,
  Card,
  Table,
  Button,
  Input,
  Space,
  Tag,
  Image,
  Drawer,
  Form,
  Select,
  InputNumber,
  Upload,
  message,
  Typography,
  Empty,
  Spin,
  Divider,
  Row,
  Col,
  Alert,
  Modal,
  Switch,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  UploadOutlined,
  DownloadOutlined,
  EyeOutlined,
  ScanOutlined,
  PlusOutlined,
  DeleteOutlined,
  UserOutlined,
  PictureOutlined,
  SendOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  inlayDbService,
  setJewelryStructureAuthPrompt,
  InlayAuthRequiredError,
  type InlayDbItem,
  type InlayCategoryNode,
  type RegionBox,
  type SearchHit,
  type LibraryAgentHit,
} from '@/services/inlayDbService';

const { Title, Paragraph, Text } = Typography;

const pipelineStatusColor: Record<string, string> = {
  ready: 'green',
  pending: 'default',
  converting: 'blue',
  rendering: 'cyan',
  failed: 'red',
};

// ============ 浏览 Tab ============
const BrowseTab: React.FC = () => {
  const [items, setItems] = useState<InlayDbItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [tags, setTags] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [categories, setCategories] = useState<InlayCategoryNode[]>([]);
  const [detail, setDetail] = useState<InlayDbItem | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = {
        page,
        page_size: pageSize,
        sort: 'updated_at:desc',
        q: q || undefined,
        tags: tags || undefined,
        category_id: categoryId,
      };
      const data = await inlayDbService.listItems(params);
      setItems((data as any).items || []);
      setTotal((data as any).total || 0);
    } catch (e: any) {
      if (e?.name === 'InlayAuthRequiredError' || e instanceof InlayAuthRequiredError) {
        return;
      }
      message.error(e?.message || '加载结构列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, q, tags, categoryId]);

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await inlayDbService.listCategories());
    } catch {
      /* 分类加载失败不阻塞列表 */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const loadThumb = useCallback(async (id: string) => {
    if (thumbs[id]) return;
    try {
      const url = await inlayDbService.imageBlobUrl(`/inlay-db/items/${id}/thumbnail`);
      setThumbs((prev) => ({ ...prev, [id]: url }));
    } catch {
      /* 无缩略图则留空 */
    }
  }, [thumbs]);

  useEffect(() => {
    items.forEach((it) => loadThumb(it.id));
  }, [items, loadThumb]);

  const columns: ColumnsType<InlayDbItem> = [
    {
      title: '预览',
      width: 80,
      render: (_, row) =>
        thumbs[row.id] ? (
          <Image src={thumbs[row.id]} width={52} height={52} style={{ objectFit: 'cover', borderRadius: 4 }} />
        ) : (
          <div style={{ width: 52, height: 52, background: '#f5f5f5', borderRadius: 4 }} />
        ),
    },
    {
      title: '名称',
      dataIndex: 'displayName',
      render: (_, row) => (
        <a onClick={() => setDetail(row)}>{row.displayName || row.id}</a>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      render: (_, row) => (
        <Space size={4} wrap>
          {(row.tags || []).slice(0, 5).map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '大类',
      width: 120,
      dataIndex: 'categoryName',
      render: (v) => v || '—',
    },
    {
      title: '流水线状态',
      width: 120,
      dataIndex: 'assetPipelineStatus',
      render: (v) => (v ? <Tag color={pipelineStatusColor[v] || 'default'}>{v}</Tag> : '—'),
    },
    {
      title: '操作',
      width: 160,
      render: (_, row) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetail(row)}>
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => inlayDbService.downloadFile(`/inlay-db/items/${row.id}/download?format=step`, `${row.displayName || row.id}.step`)}
          >
            下载
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="搜索名称/标签/路径"
          style={{ width: 220 }}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <Input
          allowClear
          placeholder="标签（逗号分隔）"
          style={{ width: 180 }}
          value={tags}
          onChange={(e) => {
            setTags(e.target.value);
            setPage(1);
          }}
        />
        <Select
          allowClear
          placeholder="大类"
          style={{ width: 180 }}
          value={categoryId}
          onChange={(v) => {
            setCategoryId(v);
            setPage(1);
          }}
          options={(categories || []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          刷新
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={items}
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Drawer
        title={detail?.displayName || '结构详情'}
        open={!!detail}
        width={720}
        onClose={() => setDetail(null)}
        destroyOnClose
      >
        {detail && <DetailBody item={detail} thumb={thumbs[detail.id]} />}
      </Drawer>
    </div>
  );
};

const DetailBody: React.FC<{ item: InlayDbItem; thumb?: string }> = ({ item, thumb }) => {
  const [views, setViews] = useState<string[]>([]);
  const [loadingViews, setLoadingViews] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingViews(true);
      const urls: string[] = [];
      for (let i = 0; i < 8; i++) {
        try {
          urls.push(await inlayDbService.imageBlobUrl(`/inlay-db/items/${item.id}/assets/preview_view_${i}`));
        } catch {
          break; // 无更多视角即停止
        }
      }
      if (!cancelled) {
        setViews(urls);
        setLoadingViews(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  return (
    <div>
      {thumb && <Image src={thumb} style={{ maxWidth: 200, borderRadius: 8, marginBottom: 16 }} />}
      <DescriptionsList item={item} />
      <Divider>多视角合成图</Divider>
      {loadingViews ? (
        <Spin />
      ) : views.length ? (
        <Image.PreviewGroup>
          <Space wrap>
            {views.map((v, i) => (
              <Image key={i} src={v} width={140} height={140} style={{ objectFit: 'cover', borderRadius: 6 }} />
            ))}
          </Space>
        </Image.PreviewGroup>
      ) : (
        <Empty description="暂无多视角图" />
      )}
      <Divider />
      <Space>
        <Button icon={<DownloadOutlined />} onClick={() => inlayDbService.downloadFile(`/inlay-db/items/${item.id}/download?format=jcd`, `${item.displayName || item.id}.jcd`)}>
          下载 JCD
        </Button>
        <Button icon={<DownloadOutlined />} onClick={() => inlayDbService.downloadFile(`/inlay-db/items/${item.id}/download?format=step`, `${item.displayName || item.id}.step`)}>
          下载 STEP
        </Button>
        <Button icon={<DownloadOutlined />} onClick={() => inlayDbService.downloadFile(`/inlay-db/items/${item.id}/download?format=stl`, `${item.displayName || item.id}.stl`)}>
          下载 STL
        </Button>
      </Space>
    </div>
  );
};

const DescriptionsList: React.FC<{ item: InlayDbItem }> = ({ item }) => (
  <Space direction="vertical" style={{ width: '100%' }}>
    <Text>ID：{item.id}</Text>
    <Text>名称：{item.displayName || '—'}</Text>
    <Text>大类：{item.categoryName || '—'}</Text>
    <Text>镶嵌类型：{item.inlayType || '—'}</Text>
    <Text>石径：{item.stoneDiameterMm != null ? `${item.stoneDiameterMm} mm` : '—'}</Text>
    <Text>上传者：{item.uploadedByUsername || '—'}</Text>
    <Text>流水线状态：{item.assetPipelineStatus || '—'}</Text>
    <Space size={4} wrap>
      标签：
      {(item.tags || []).map((t) => (
        <Tag key={t}>{t}</Tag>
      ))}
    </Space>
  </Space>
);

// ============ 上传 Tab ============
const UploadTab: React.FC = () => {
  const [categories, setCategories] = useState<InlayCategoryNode[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [tags, setTags] = useState('');
  const [inlayType, setInlayType] = useState<string | undefined>();
  const [stoneDiameterMm, setStoneDiameterMm] = useState<number | null>(null);
  const [cad, setCad] = useState<File | null>(null);
  const [jcd, setJcd] = useState<File | null>(null);
  const [stl, setStl] = useState<File | null>(null);
  const [preview, setPreview] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<InlayDbItem | null>(null);

  useEffect(() => {
    inlayDbService.listCategories().then(setCategories).catch(() => {});
  }, []);

  const submit = async () => {
    if (!cad) {
      message.warning('请上传 STEP/STP 文件');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('cad', cad);
      if (jcd) fd.append('jcd', jcd);
      if (stl) fd.append('stl', stl);
      if (preview) fd.append('preview', preview);
      if (displayName) fd.append('display_name', displayName);
      if (categoryId) fd.append('category_id', categoryId);
      if (tags) fd.append('tags', tags);
      if (inlayType) fd.append('inlay_type', inlayType);
      if (stoneDiameterMm != null) fd.append('stone_diameter_mm', String(stoneDiameterMm));
      const item = await inlayDbService.upload(fd);
      setResult(item);
      message.success('上传成功，进入流水线处理');
    } catch (e: any) {
      message.error(e?.message || '上传失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="上传说明"
        description="STEP/STP 文件必填，JCD/STL/预览图可选。上传后进入资产流水线（转换/渲染），可在浏览列表查看处理状态。"
      />
      <Form layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="结构名称">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="如 四爪镶口-6mm" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="大类">
              <Select
                allowClear
                value={categoryId}
                onChange={setCategoryId}
                placeholder="选择大类"
                options={(categories || []).map((c) => ({ value: c.id, label: c.name }))}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="镶嵌类型">
              <Select
                allowClear
                value={inlayType}
                onChange={setInlayType}
                placeholder="选择镶嵌类型"
                options={[
                  { value: 'xiangkou', label: '镶口' },
                  { value: 'zujian', label: '组件' },
                  { value: 'jiequan', label: '戒圈' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="石径（mm）">
              <InputNumber value={stoneDiameterMm} onChange={setStoneDiameterMm} style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="标签（逗号分隔）">
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="如 蔷薇,四爪" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="STEP/STP（必填）" required>
              <Upload beforeUpload={(f) => { setCad(f); return false; }} maxCount={1} onRemove={() => setCad(null)}>
                <Button icon={<UploadOutlined />}>选择 CAD 文件</Button>
              </Upload>
              {cad && <Text type="secondary">{cad.name}</Text>}
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="JCD（可选）">
              <Upload beforeUpload={(f) => { setJcd(f); return false; }} maxCount={1} onRemove={() => setJcd(null)}>
                <Button icon={<UploadOutlined />}>选择 JCD</Button>
              </Upload>
              {jcd && <Text type="secondary">{jcd.name}</Text>}
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="STL（可选）">
              <Upload beforeUpload={(f) => { setStl(f); return false; }} maxCount={1} onRemove={() => setStl(null)}>
                <Button icon={<UploadOutlined />}>选择 STL</Button>
              </Upload>
              {stl && <Text type="secondary">{stl.name}</Text>}
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="预览图（可选）">
              <Upload beforeUpload={(f) => { setPreview(f); return false; }} maxCount={1} onRemove={() => setPreview(null)}>
                <Button icon={<UploadOutlined />}>选择预览图</Button>
              </Upload>
              {preview && <Text type="secondary">{preview.name}</Text>}
            </Form.Item>
          </Col>
        </Row>

        <Button type="primary" icon={<UploadOutlined />} loading={submitting} onClick={submit}>
          提交上传
        </Button>
      </Form>

      {result && (
        <Alert
          style={{ marginTop: 16 }}
          type="success"
          showIcon
          message={`上传成功：${result.displayName || result.id}`}
          description="结构已入库，进入流水线处理。请在浏览 Tab 查看处理状态。"
        />
      )}
    </div>
  );
};

// ============ Agent 查询 Tab ============
type AgentChatMessage = {
  id: string;
  role: 'user' | 'agent';
  text: string;
  understood?: string;
  images?: string[];
  hits?: LibraryAgentHit[];
  loading?: boolean;
};

const AgentQueryTab: React.FC = () => {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [categories, setCategories] = useState<InlayCategoryNode[]>([]);
  const [deepseekAvailable, setDeepseekAvailable] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [pending, setPending] = useState<{ id: string; file: File; url: string }[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<InlayDbItem | null>(null);
  const [detailThumb, setDetailThumb] = useState<string | undefined>();
  const threadRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSend = (!!draft.trim() || pending.length > 0) && !sending;

  useEffect(() => {
    inlayDbService.listCategories().then(setCategories).catch(() => {});
    inlayDbService
      .deepseekStatus()
      .then((s) => setDeepseekAvailable(Boolean(s?.available)))
      .catch(() => setDeepseekAvailable(null));
  }, []);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const addFiles = (files: File[]) => {
    setPending((prev) => {
      const next = [...prev];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        if (next.length >= 6) {
          message.warning('最多上传 6 张参考图');
          break;
        }
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          url: URL.createObjectURL(file),
        });
      }
      return next;
    });
  };

  const removePending = (id: string) => {
    setPending((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  const loadHitThumb = async (id: string) => {
    if (!id || thumbs[id]) return;
    try {
      const url = await inlayDbService.imageBlobUrl(`/inlay-db/items/${id}/thumbnail`);
      setThumbs((prev) => (prev[id] ? prev : { ...prev, [id]: url }));
    } catch {
      /* 无缩略图 */
    }
  };

  const send = async () => {
    if (!canSend) return;
    const query = draft.trim();
    const images = pending.map((p) => p.file);
    const previewUrls = pending.map((p) => p.url);
    setDraft('');
    setPending([]);
    const userMsg: AgentChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: query,
      images: previewUrls,
    };
    const loadingId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, userMsg, { id: loadingId, role: 'agent', text: '', loading: true }]);
    setSending(true);
    try {
      const data = await inlayDbService.agentSearch({
        query,
        images,
        category_id: categoryId,
        only_mine: onlyMine || undefined,
        top_k: 16,
      });
      if (data.deepseek_available != null) {
        setDeepseekAvailable(Boolean(data.deepseek_available));
      }
      const hits = data.hits || [];
      hits.forEach((h) => void loadHitThumb(h.id));
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? {
                ...m,
                loading: false,
                text: data.reply || (hits.length ? '检索完成。' : '没有找到足够接近的现成结构。'),
                understood:
                  data.understood_query && data.understood_query !== query ? data.understood_query : undefined,
                hits,
              }
            : m
        )
      );
    } catch (e: any) {
      if (e?.name === 'InlayAuthRequiredError' || e instanceof InlayAuthRequiredError) {
        setMessages((prev) => prev.filter((m) => m.id !== loadingId && m.id !== userMsg.id));
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? { ...m, loading: false, text: e?.message || '检索失败，请稍后重试。' }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  const openDetail = async (hit: LibraryAgentHit) => {
    try {
      const item = await inlayDbService.getItem(hit.id);
      setDetail(item);
      if (thumbs[hit.id]) setDetailThumb(thumbs[hit.id]);
      else {
        const url = await inlayDbService.imageBlobUrl(`/inlay-db/items/${hit.id}/thumbnail`).catch(() => undefined);
        setDetailThumb(url);
      }
    } catch (e: any) {
      message.error(e?.message || '加载详情失败');
    }
  };

  return (
    <div className="inlay-library-shell">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="结构检索 Agent"
        description="口语也可以，例如：「帮我找几个现成的四爪镶口」。会自动去掉废话、按结构名召回；可同时粘贴或上传参考图。"
      />
      {deepseekAvailable === false ? (
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          DeepSeek 未配置，将降级为关键词匹配；上传参考图时仍会走视觉检索。
        </Text>
      ) : null}
      <Space wrap style={{ marginBottom: 12 }}>
        <Select
          allowClear
          placeholder="限定大类"
          style={{ width: 180 }}
          value={categoryId}
          onChange={setCategoryId}
          options={(categories || []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <Space>
          <Switch checked={onlyMine} onChange={setOnlyMine} />
          <Text>仅看我的</Text>
        </Space>
      </Space>

      <div
        ref={threadRef}
        className="inlay-thread"
        style={{
          flex: 1,
          overflowY: 'auto',
          background: '#fafafa',
          border: '1px solid #f0f0f0',
          borderRadius: 8,
          padding: 16,
          marginBottom: 12,
        }}
      >
        {!messages.length ? (
          <Empty
            image={<RobotOutlined style={{ fontSize: 36, color: '#bfbfbf' }} />}
            description="用自然语言描述要找的结构，Enter 发送"
          />
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                marginBottom: 16,
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '86%',
                  background: msg.role === 'user' ? '#1677ff' : '#fff',
                  color: msg.role === 'user' ? '#fff' : 'inherit',
                  borderRadius: 10,
                  padding: '10px 12px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                }}
              >
                {msg.images?.length ? (
                  <Space wrap style={{ marginBottom: 8 }}>
                    {msg.images.map((src, i) => (
                      <Image key={i} src={src} width={72} height={72} style={{ objectFit: 'cover', borderRadius: 6 }} />
                    ))}
                  </Space>
                ) : null}
                {msg.understood ? (
                  <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                    理解为「{msg.understood}」
                  </Text>
                ) : null}
                {msg.loading ? <Spin size="small" /> : null}
                {msg.text ? <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div> : null}
                {msg.hits?.length ? (
                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                    {msg.hits.map((hit) => (
                      <Card key={hit.id} size="small" hoverable onClick={() => void openDetail(hit)}>
                        {thumbs[hit.id] ? (
                          <Image
                            src={thumbs[hit.id]}
                            preview={false}
                            width="100%"
                            height={110}
                            style={{ objectFit: 'cover', borderRadius: 4 }}
                          />
                        ) : (
                          <div style={{ width: '100%', height: 110, background: '#f5f5f5', borderRadius: 4 }} />
                        )}
                        <Text strong style={{ display: 'block', marginTop: 8 }}>
                          {hit.display_name || hit.id}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {[hit.category, hit.uploader].filter(Boolean).join(' · ') || '—'}
                          {hit.score != null ? ` · ${hit.score.toFixed(3)}` : ''}
                        </Text>
                        {hit.matched_reason ? (
                          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                            {hit.matched_reason}
                          </Text>
                        ) : null}
                        <Space size="small" style={{ marginTop: 6 }}>
                          <Button
                            type="link"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              void openDetail(hit);
                            }}
                          >
                            详情
                          </Button>
                          <Button
                            type="link"
                            size="small"
                            icon={<DownloadOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              void inlayDbService.downloadFile(
                                `/inlay-db/items/${hit.id}/download?format=step`,
                                `${hit.display_name || hit.id}.step`
                              );
                            }}
                          >
                            下载 STEP
                          </Button>
                        </Space>
                      </Card>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {pending.length > 0 ? (
        <Space wrap style={{ marginBottom: 8 }}>
          {pending.map((p) => (
            <div key={p.id} style={{ position: 'relative' }}>
              <img src={p.url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6 }} />
              <Button
                size="small"
                type="text"
                danger
                style={{ position: 'absolute', top: -8, right: -8 }}
                onClick={() => removePending(p.id)}
              >
                ×
              </Button>
            </div>
          ))}
        </Space>
      ) : null}

      <div
        className="inlay-composer"
        style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
          if (!files.length) return;
          e.preventDefault();
          addFiles(files);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addFiles(Array.from(e.target.files || []));
            e.target.value = '';
          }}
        />
        <Button icon={<PictureOutlined />} onClick={() => fileInputRef.current?.click()} title="添加参考图" />
        <Input.TextArea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoSize={{ minRows: 2, maxRows: 4 }}
          placeholder="描述要找的结构，Enter 发送，Shift+Enter 换行"
          disabled={sending}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button type="primary" icon={<SendOutlined />} loading={sending} disabled={!canSend} onClick={() => void send()}>
          发送
        </Button>
      </div>

      <Drawer
        title={detail?.displayName || '结构详情'}
        open={!!detail}
        width={720}
        onClose={() => setDetail(null)}
        destroyOnClose
      >
        {detail && <DetailBody item={detail} thumb={detailThumb} />}
      </Drawer>
    </div>
  );
};

// ============ 识结构 Tab（暂时不开放） ============
const RECOGNIZE_ENABLED = false;

const RecognizeTab: React.FC = () => {
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [regions, setRegions] = useState<RegionBox[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<SearchHit[][]>([]);
  const [categories, setCategories] = useState<InlayCategoryNode[]>([]);
  const [indexStatus, setIndexStatus] = useState<Record<string, unknown> | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    inlayDbService.listCategories().then(setCategories).catch(() => {});
    inlayDbService.indexStatus().then(setIndexStatus).catch(() => {});
  }, []);

  const onImageChosen = (f: File) => {
    setImage(f);
    setRegions([]);
    setHits([]);
    const url = URL.createObjectURL(f);
    setImagePreview(url);
  };

  const detect = async () => {
    if (!image) return;
    setDetecting(true);
    try {
      const r = await inlayDbService.detectRegions(image);
      const boxes: RegionBox[] = (r.regions || []).map((b: any) => ({
        region_id: b.region_id || `r_${Math.random().toString(36).slice(2, 8)}`,
        x: b.x, y: b.y, w: b.w, h: b.h,
        category_id: '',
      }));
      setRegions(boxes);
      if (!boxes.length) message.info('未自动检测到结构区域，可手动添加');
    } catch (e: any) {
      message.error(e?.message || '区域检测失败');
    } finally {
      setDetecting(false);
    }
  };

  const addRegion = () => {
    setRegions((prev) => [
      ...prev,
      { region_id: `r_${Math.random().toString(36).slice(2, 8)}`, x: 0.1, y: 0.1, w: 0.3, h: 0.3, category_id: '' },
    ]);
  };

  const removeRegion = (id: string) => {
    setRegions((prev) => prev.filter((r) => r.region_id !== id));
  };

  const setRegionCategory = (id: string, categoryId: string) => {
    setRegions((prev) => prev.map((r) => (r.region_id === id ? { ...r, category_id: categoryId } : r)));
  };

  const search = async () => {
    if (!image || !regions.length) return;
    const missing = regions.filter((r) => !r.category_id);
    if (missing.length) {
      message.warning('请为每个区域选择大类');
      return;
    }
    setSearching(true);
    try {
      const result = await inlayDbService.searchByRegions(image, regions, 5);
      setHits(Array.isArray(result) ? result : []);
    } catch (e: any) {
      message.error(e?.message || '检索失败');
    } finally {
      setSearching(false);
    }
  };

  const statusText = useMemo(() => {
    if (!indexStatus) return '';
    const n = indexStatus.structure_count ?? indexStatus.vector_count;
    return `索引状态：模型 ${indexStatus.model || '—'}，结构数 ${n ?? '—'}`;
  }, [indexStatus]);

  return (
    <div>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="识结构（视觉检索）"
        description="上传含一个或多个结构的图片，系统自动框选区域；每个区域需选择大类后检索 Top-K 候选，再人工确认。检索依赖远程已构建的索引。"
      />
      {statusText && <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>{statusText}</Text>}

      <Space wrap style={{ marginBottom: 16 }}>
        <Upload beforeUpload={(f) => { onImageChosen(f); return false; }} showUploadList={false} accept="image/*">
          <Button icon={<ScanOutlined />}>选择识别图片</Button>
        </Upload>
        <Button icon={<ScanOutlined />} onClick={detect} loading={detecting} disabled={!image}>
          自动框选区域
        </Button>
        <Button icon={<PlusOutlined />} onClick={addRegion} disabled={!imagePreview}>
          添加区域
        </Button>
        <Button type="primary" icon={<SearchOutlined />} onClick={search} loading={searching} disabled={!regions.length}>
          检索全部区域
        </Button>
      </Space>

      {imagePreview && (
        <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
          <img
            ref={imgRef}
            src={imagePreview}
            alt="识别图"
            style={{ maxWidth: '100%', maxHeight: 480, borderRadius: 8 }}
          />
          {regions.map((r) => (
            <div
              key={r.region_id}
              style={{
                position: 'absolute',
                left: `${r.x * 100}%`,
                top: `${r.y * 100}%`,
                width: `${r.w * 100}%`,
                height: `${r.h * 100}%`,
                border: '2px solid #1890ff',
                borderRadius: 4,
                pointerEvents: 'none',
              }}
            />
          ))}
        </div>
      )}

      {regions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Divider>区域与候选</Divider>
          {regions.map((r, idx) => (
            <Card key={r.region_id} size="small" style={{ marginBottom: 12 }}>
              <Space style={{ marginBottom: 8 }} wrap>
                <Text strong>区域 {idx + 1}</Text>
                <Select
                  placeholder="选择大类"
                  style={{ width: 180 }}
                  value={r.category_id || undefined}
                  onChange={(v) => setRegionCategory(r.region_id, v)}
                  options={(categories || []).map((c) => ({ value: c.id, label: c.name }))}
                />
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeRegion(r.region_id)}>
                  删除
                </Button>
              </Space>
              <HitsList hits={hits[idx]} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const HitsList: React.FC<{ hits?: SearchHit[] }> = ({ hits }) => {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    (hits || []).forEach(async (h) => {
      if (h.id && !thumbs[h.id]) {
        try {
          const url = await inlayDbService.imageBlobUrl(`/inlay-db/items/${h.id}/thumbnail`);
          setThumbs((prev) => ({ ...prev, [h.id]: url }));
        } catch {
          /* ignore */
        }
      }
    });
  }, [hits]);

  if (!hits || !hits.length) return <Text type="secondary">暂无候选结果</Text>;

  return (
    <Space wrap>
      {hits.map((h) => (
        <Card key={h.id} size="small" style={{ width: 200 }}>
          {thumbs[h.id] ? (
            <Image src={thumbs[h.id]} width="100%" height={120} style={{ objectFit: 'cover', borderRadius: 4 }} />
          ) : (
            <div style={{ width: '100%', height: 120, background: '#f5f5f5', borderRadius: 4 }} />
          )}
          <Text strong style={{ display: 'block', marginTop: 8 }}>{h.display_name || h.id}</Text>
          <Text type="secondary">相似度 {(h.score ?? 0).toFixed(3)}</Text>
          <div style={{ marginTop: 8 }}>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => inlayDbService.downloadFile(`/inlay-db/items/${h.id}/download?format=step`, `${h.display_name || h.id}.step`)}
            >
              下载 STEP
            </Button>
          </div>
        </Card>
      ))}
    </Space>
  );
};

// ============ 主页面 ============
const InlayStructureLibraryPage: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [sessionUser, setSessionUser] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [authMsg, setAuthMsg] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authForm] = Form.useForm();
  const authResolver = useRef<((v: { username: string; password: string } | null) => void) | null>(null);

  useLayoutEffect(() => {
    setJewelryStructureAuthPrompt(({ username, message }) => {
      return new Promise((resolve) => {
        authResolver.current = resolve;
        setAuthMsg(message || '请输入珠宝结构库账号和密码');
        authForm.setFieldsValue({ username: username || '', password: '' });
        setAuthOpen(true);
      });
    });
    return () => {
      setJewelryStructureAuthPrompt(null);
      authResolver.current?.(null);
      authResolver.current = null;
    };
  }, [authForm]);

  const bootstrap = useCallback(async () => {
    try {
      await inlayDbService.ensureSession();
      setSessionUser(inlayDbService.currentUsername());
      setReady(true);
    } catch (e: any) {
      setReady(false);
      if (e?.name !== 'InlayAuthRequiredError' && !(e instanceof InlayAuthRequiredError)) {
        message.error(e?.message || '珠宝结构库登录失败');
      }
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const finishAuth = (value: { username: string; password: string } | null) => {
    const resolve = authResolver.current;
    authResolver.current = null;
    setAuthOpen(false);
    resolve?.(value);
  };

  const submitAuth = async () => {
    try {
      const v = await authForm.validateFields();
      setAuthLoading(true);
      finishAuth({ username: v.username.trim(), password: v.password });
    } catch {
      /* form */
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Space align="start" style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>珠宝结构库</Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            对接公司内网结构库：支持 Agent 口语检索、结构浏览/搜索、上传（STEP 建模）与多格式下载。
          </Paragraph>
        </div>
        <Button icon={<UserOutlined />} onClick={() => { void inlayDbService.relogin().then(() => { setSessionUser(inlayDbService.currentUsername()); setReady(true); }).catch(() => {}); }}>
          {sessionUser ? `账号：${sessionUser}` : '登录珠宝结构库'}
        </Button>
      </Space>
      <Card>
        {ready ? (
          <Tabs
            defaultActiveKey="browse"
            items={[
              { key: 'browse', label: '浏览', children: <BrowseTab /> },
              { key: 'agent', label: 'Agent 查询', children: <AgentQueryTab /> },
              { key: 'upload', label: '上传', children: <UploadTab /> },
              ...(RECOGNIZE_ENABLED
                ? [{ key: 'recognize', label: '识结构', children: <RecognizeTab /> }]
                : []),
            ]}
          />
        ) : (
          <Empty description="登录珠宝结构库后即可浏览和上传结构">
            <Button type="primary" onClick={() => { void bootstrap(); }}>
              登录
            </Button>
          </Empty>
        )}
      </Card>
      <Modal
        title="登录珠宝结构库"
        open={authOpen}
        onCancel={() => finishAuth(null)}
        onOk={() => { void submitAuth(); }}
        confirmLoading={authLoading}
        okText="登录"
        cancelText="取消"
        destroyOnClose={false}
        maskClosable={false}
      >
        {authMsg ? <Alert type="info" showIcon message={authMsg} style={{ marginBottom: 16 }} /> : null}
        <Form form={authForm} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} autoComplete="username" placeholder="请输入珠宝结构库用户名" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password autoComplete="current-password" placeholder="请输入密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InlayStructureLibraryPage;
