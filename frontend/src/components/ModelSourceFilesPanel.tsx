import React, { useMemo } from 'react';
import { Button, Card, Image, Space, Tag, Typography, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { isRasterImageFileName } from '@/utils/isRasterImageFileName';
import {
  canInlineMeshPreview,
  collectOrderModelSourceRows,
  modelSourceRowToUploadFile,
  type ModelSourceFileRow,
} from '@/utils/modelSourcePreview';
import ModelMeshViewport from '@/components/ModelMeshViewport';
import { orderService } from '@/services/orderService';

const { Text } = Typography;

export type ModelSourceFilesPanelProps = {
  order: {
    pieces?: { id: number; seq?: number; name?: string; model?: { modelFiles?: unknown } }[];
    modelInfo?: { modelFiles?: unknown };
  };
  title?: string;
  compact?: boolean;
  /** 默认 true：每个可预览源文件在页面内直接展开 360° 视图 */
  autoPreview?: boolean;
};

async function downloadModelFile(id: number, name: string) {
  const blob = await orderService.downloadFile(id);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name || `model-${id}`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const ModelSourceFilesPanel: React.FC<ModelSourceFilesPanelProps> = ({
  order,
  title = '建模源文件（页面内 360° 预览）',
  compact = false,
  autoPreview = true,
}) => {
  const rows = useMemo(() => collectOrderModelSourceRows(order), [order]);

  const grouped = useMemo(() => {
    const map = new Map<string, ModelSourceFileRow[]>();
    for (const row of rows) {
      const key = row.pieceName || '订单源文件';
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [rows]);

  const multiPiece = (order.pieces?.length ?? 0) > 1;

  return (
    <div>
      <Text strong>{title}</Text>
      <div style={{ marginTop: 8 }}>
        {rows.length === 0 ? (
          <Text type="secondary">暂无建模源文件</Text>
        ) : (
          <Space direction="vertical" size={compact ? 10 : 16} style={{ width: '100%' }}>
            {grouped.map(([pieceName, list]) => (
              <Card
                key={pieceName}
                size="small"
                type="inner"
                title={
                  <Space wrap>
                    {multiPiece ? <Tag color="blue">{pieceName}</Tag> : <span>{pieceName}</span>}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {list.length} 个源文件
                    </Text>
                  </Space>
                }
                styles={{ body: { padding: compact ? 10 : 14 } }}
              >
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {list.map((f) => {
                    const canOrbit = canInlineMeshPreview(f.name);
                    const isImage = isRasterImageFileName(f.name);
                    return (
                      <div key={f.id}>
                        <Space wrap align="center" style={{ marginBottom: canOrbit && autoPreview ? 8 : 0 }}>
                          <Text>{f.name}</Text>
                          {canOrbit ? <Tag color="gold">STEP/网格可预览</Tag> : <Tag>需下载查看</Tag>}
                          <Button
                            type="link"
                            size="small"
                            icon={<DownloadOutlined />}
                            onClick={() =>
                              void downloadModelFile(f.id, f.name).catch((e: unknown) =>
                                message.error(String((e as Error)?.message || e))
                              )
                            }
                          >
                            下载
                          </Button>
                        </Space>
                        {isImage && f.url ? (
                          <Image
                            src={f.url}
                            width={compact ? 96 : 140}
                            height={compact ? 96 : 140}
                            style={{ objectFit: 'cover', borderRadius: 6 }}
                          />
                        ) : null}
                        {canOrbit && autoPreview ? (
                          <ModelMeshViewport
                            file={modelSourceRowToUploadFile(f)}
                            height={compact ? 260 : 320}
                            defaultAutoRotate
                            onDownload={(id, fileName) => {
                              void downloadModelFile(id, fileName).catch((e: unknown) =>
                                message.error(String((e as Error)?.message || e))
                              );
                            }}
                          />
                        ) : null}
                        {!canOrbit && !isImage ? (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            该格式无法在员工端内嵌预览，请使用「下载」到本地用 CAD 软件打开。勿依赖外链打开。
                          </Text>
                        ) : null}
                      </div>
                    );
                  })}
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </div>
    </div>
  );
};

export default ModelSourceFilesPanel;
