import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Divider,
  Select,
  Space,
  Table,
  Typography,
  Upload,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, SaveOutlined, SendOutlined, UploadOutlined } from '@ant-design/icons';
import { orderService } from '@/services/orderService';
import type { ModelingArchiveData, ModelingArchiveComponentRow, ModelingArchiveInlayRow } from '@/types/order';
import { useCurrentUser } from '@/stores/authStore';

const { Text } = Typography;

const COMPLEXITY_MAIN = [
  { v: 1, l: '1 普通构型' },
  { v: 2, l: '2 异形构型' },
  { v: 3, l: '3 无主体' },
];
const COMPLEXITY_TEXTURE = [
  { v: 1, l: '1 不含纹理' },
  { v: 2, l: '2 含纹理' },
  { v: 3, l: '3 多种纹理' },
];
const COMPLEXITY_SMALL = [
  { v: 1, l: '1 简单（直线）' },
  { v: 2, l: '2 一般复杂' },
  { v: 3, l: '3 复杂（大量不规则曲线）' },
];
const COMPLEXITY_INLAY = [
  { v: 1, l: '1 简单（常规构型）' },
  { v: 2, l: '2 特殊构型（简单）' },
  { v: 3, l: '3 特殊构型（复杂）' },
];

function emptyDraft(orderId: number): ModelingArchiveData {
  return {
    orderId,
    mainMarkerFileIds: [],
    textureMarkerFileIds: [],
    components: [],
    inlays: [],
  };
}

export interface ModelingArchivePanelProps {
  orderId: number;
}

const ModelingArchivePanel: React.FC<ModelingArchivePanelProps> = ({ orderId }) => {
  const user = useCurrentUser();
  const canAccess = useMemo(
    () => ['ADMIN', 'SALES', 'DATA_ARCHIVIST'].includes(user?.role || ''),
    [user?.role]
  );
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<ModelingArchiveData>(() => emptyDraft(orderId));

  const load = useCallback(async () => {
    if (!canAccess) return;
    setLoading(true);
    try {
      const d = await orderService.getModelingArchive(orderId);
      setDraft({
        ...emptyDraft(orderId),
        ...d,
        mainMarkerFileIds: d.mainMarkerFileIds || [],
        textureMarkerFileIds: d.textureMarkerFileIds || [],
        components: d.components?.length ? d.components : [],
        inlays: d.inlays?.length ? d.inlays : [],
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载归档失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [canAccess, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadMarker = async (file: File, push: (id: number) => void) => {
    const fi = await orderService.uploadModelingArchiveMarker(orderId, file);
    if (fi?.id) push(fi.id);
  };

  const saveDraft = async () => {
    setLoading(true);
    try {
      const saved = await orderService.saveModelingArchive(orderId, draft);
      setDraft((prev) => ({ ...prev, ...saved }));
      message.success('草稿已保存');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '保存失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    setLoading(true);
    try {
      const saved = await orderService.submitModelingArchive(orderId);
      setDraft((prev) => ({ ...prev, ...saved }));
      message.success('归档已提交锁定');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '提交失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!canAccess) {
    return null;
  }

  const locked = !!draft.completedAt;

  const compColumns: ColumnsType<ModelingArchiveComponentRow & { key: string }> = [
    {
      title: '小组件复杂度',
      dataIndex: 'complexity',
      render: (_, row, index) => (
        <Select
          style={{ minWidth: 220 }}
          value={row.complexity}
          options={COMPLEXITY_SMALL.map((x) => ({ value: x.v, label: x.l }))}
          onChange={(v) => {
            const next = [...draft.components];
            next[index] = { ...next[index], complexity: v };
            setDraft({ ...draft, components: next, smallComponentCount: next.length });
          }}
        />
      ),
    },
    {
      title: '样式标记截图',
      render: (_, row, index) => (
        <Space direction="vertical">
          <Text type="secondary">文件 ID: {(row.markerFileIds || []).join(', ') || '无'}</Text>
          <Upload
            showUploadList={false}
            beforeUpload={(file) => {
              void uploadMarker(file as File, (id) => {
                const next = [...draft.components];
                const cur = next[index] || { markerFileIds: [] };
                next[index] = {
                  ...cur,
                  markerFileIds: [...(cur.markerFileIds || []), id],
                };
                setDraft({ ...draft, components: next, smallComponentCount: next.length });
              });
              return false;
            }}
          >
            <Button size="small" icon={<UploadOutlined />}>
              上传截图
            </Button>
          </Upload>
        </Space>
      ),
    },
    {
      title: '',
      width: 80,
      render: (_, __, index) => (
        <Button
          size="small"
          danger
          onClick={() => {
            const next = draft.components.filter((_, i) => i !== index);
            setDraft({ ...draft, components: next, smallComponentCount: next.length });
          }}
        >
          删
        </Button>
      ),
    },
  ];

  const inlayColumns: ColumnsType<ModelingArchiveInlayRow & { key: string }> = [
    {
      title: '镶嵌结构复杂度',
      dataIndex: 'complexity',
      render: (_, row, index) => (
        <Select
          style={{ minWidth: 220 }}
          value={row.complexity}
          options={COMPLEXITY_INLAY.map((x) => ({ value: x.v, label: x.l }))}
          onChange={(v) => {
            const next = [...draft.inlays];
            next[index] = { ...next[index], complexity: v };
            setDraft({ ...draft, inlays: next, inlayStructureCount: next.length });
          }}
        />
      ),
    },
    {
      title: '样式标记截图',
      render: (_, row, index) => (
        <Space direction="vertical">
          <Text type="secondary">文件 ID: {(row.markerFileIds || []).join(', ') || '无'}</Text>
          <Upload
            showUploadList={false}
            beforeUpload={(file) => {
              void uploadMarker(file as File, (id) => {
                const next = [...draft.inlays];
                const cur = next[index] || { markerFileIds: [] };
                next[index] = {
                  ...cur,
                  markerFileIds: [...(cur.markerFileIds || []), id],
                };
                setDraft({ ...draft, inlays: next, inlayStructureCount: next.length });
              });
              return false;
            }}
          >
            <Button size="small" icon={<UploadOutlined />}>
              上传截图
            </Button>
          </Upload>
        </Space>
      ),
    },
    {
      title: '',
      width: 80,
      render: (_, __, index) => (
        <Button
          size="small"
          danger
          onClick={() => {
            const next = draft.inlays.filter((_, i) => i !== index);
            setDraft({ ...draft, inlays: next, inlayStructureCount: next.length });
          }}
        >
          删
        </Button>
      ),
    },
  ];

  return (
    <Card size="small" title="建模材料归档（信息化数据归档 / 管理员 / 售中共用）" style={{ marginBottom: 16 }} loading={loading}>
      {draft.completedByDisplayName && (
        <Text type="secondary">
          首次提交人：{draft.completedByDisplayName}
          {draft.completedAt ? `（${draft.completedAt}）` : ''}
        </Text>
      )}
      <Divider orientation="left">主体结构</Divider>
      <Space wrap align="start">
        <Select
          placeholder="主体结构复杂度"
          style={{ minWidth: 220 }}
          value={draft.mainStructureComplexity}
          options={COMPLEXITY_MAIN.map((x) => ({ value: x.v, label: x.l }))}
          onChange={(v) => setDraft({ ...draft, mainStructureComplexity: v })}
          allowClear
        />
        <Space direction="vertical">
          <Text type="secondary">主体结构标记图 fileIds: {draft.mainMarkerFileIds?.join(', ') || '无'}</Text>
          <Upload
            showUploadList={false}
            beforeUpload={(file) => {
              void uploadMarker(file as File, (id) =>
                setDraft((d) => ({ ...d, mainMarkerFileIds: [...(d.mainMarkerFileIds || []), id] }))
              );
              return false;
            }}
          >
            <Button size="small" icon={<UploadOutlined />}>
              上传区域截图
            </Button>
          </Upload>
        </Space>
      </Space>

      <Divider orientation="left">纹理</Divider>
      <Space wrap align="start">
        <Select
          placeholder="是否含纹理"
          style={{ minWidth: 220 }}
          value={draft.textureComplexity}
          options={COMPLEXITY_TEXTURE.map((x) => ({ value: x.v, label: x.l }))}
          onChange={(v) => setDraft({ ...draft, textureComplexity: v })}
          allowClear
        />
        <Space direction="vertical">
          <Text type="secondary">纹理标记图 fileIds: {draft.textureMarkerFileIds?.join(', ') || '无'}</Text>
          <Upload
            showUploadList={false}
            beforeUpload={(file) => {
              void uploadMarker(file as File, (id) =>
                setDraft((d) => ({ ...d, textureMarkerFileIds: [...(d.textureMarkerFileIds || []), id] }))
              );
              return false;
            }}
          >
            <Button size="small" icon={<UploadOutlined />}>
              上传区域截图
            </Button>
          </Upload>
        </Space>
      </Space>

      <Divider orientation="left">小组件（每行一类）</Divider>
      <Button
        type="dashed"
        size="small"
        icon={<PlusOutlined />}
        onClick={() => {
          const next = [...draft.components, { complexity: 1, markerFileIds: [] as number[] }];
          setDraft({ ...draft, components: next, smallComponentCount: next.length });
        }}
        style={{ marginBottom: 8 }}
      >
        添加小组件类别行
      </Button>
      <Table
        size="small"
        pagination={false}
        rowKey={(_, i) => `c-${i}`}
        columns={compColumns}
        dataSource={draft.components.map((r, i) => ({ ...r, key: `c-${i}` }))}
      />

      <Divider orientation="left">镶嵌结构（每行一类）</Divider>
      <Button
        type="dashed"
        size="small"
        icon={<PlusOutlined />}
        onClick={() => {
          const next = [...draft.inlays, { complexity: 1, markerFileIds: [] as number[] }];
          setDraft({ ...draft, inlays: next, inlayStructureCount: next.length });
        }}
        style={{ marginBottom: 8 }}
      >
        添加镶嵌结构类别行
      </Button>
      <Table
        size="small"
        pagination={false}
        rowKey={(_, i) => `i-${i}`}
        columns={inlayColumns}
        dataSource={draft.inlays.map((r, i) => ({ ...r, key: `i-${i}` }))}
      />

      <Divider />
      <Space wrap>
        <Button icon={<SaveOutlined />} onClick={() => void saveDraft()}>
          保存草稿
        </Button>
        <Button type="primary" icon={<SendOutlined />} disabled={locked} onClick={() => void submit()}>
          提交归档（首次锁定）
        </Button>
        {locked && <Text type="warning">已有人提交归档；仍可修改并保存草稿，但不可再次点击提交。</Text>}
      </Space>
    </Card>
  );
};

export default ModelingArchivePanel;
