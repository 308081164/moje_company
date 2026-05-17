import React, { useCallback, useEffect, useState } from 'react';
import { Button, Empty, Image, Modal, Space, Spin, Tabs, Typography, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import {
  portalPublicStaffService,
  type PortalCategoryDetailPublic,
  type PortalHomePublic,
  type PortalImagePublic,
} from '@/services/portalPublicStaffService';
import { downloadWithAuth } from '@/utils/download';

const { Text, Paragraph } = Typography;

const isRasterUrl = (u: string) => /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(u);

async function downloadShowcaseFile(fileId: number, caption?: string | null) {
  const name = (caption && caption.trim()) || `showcase-${fileId}`;
  await downloadWithAuth(`/files/${fileId}/download`, name);
}

const ImageTile: React.FC<{ item: PortalImagePublic }> = ({ item }) => {
  const canThumb = item.url && isRasterUrl(item.url);
  return (
    <div style={{ width: 140, marginBottom: 12 }}>
      {canThumb ? (
        <Image src={item.url} alt={item.caption || ''} width={120} height={120} style={{ objectFit: 'cover', borderRadius: 6 }} />
      ) : (
        <div style={{ width: 120, height: 120, background: '#f5f5f5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text type="secondary" style={{ fontSize: 11, padding: 4, textAlign: 'center' }}>
            非图片或外链预览
          </Text>
        </div>
      )}
      {item.caption && (
        <Paragraph ellipsis={{ rows: 2 }} style={{ marginTop: 4, marginBottom: 4, fontSize: 12 }}>
          {item.caption}
        </Paragraph>
      )}
      <Button
        type="link"
        size="small"
        icon={<DownloadOutlined />}
        onClick={() =>
          void downloadShowcaseFile(item.fileId, item.caption).catch((e: unknown) =>
            message.error(String((e as Error)?.message || e))
          )
        }
      >
        下载
      </Button>
    </div>
  );
};

export interface ModelerReferenceLibraryModalProps {
  open: boolean;
  onClose: () => void;
}

const ModelerReferenceLibraryModal: React.FC<ModelerReferenceLibraryModalProps> = ({ open, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [home, setHome] = useState<PortalHomePublic | null>(null);
  const [catSlug, setCatSlug] = useState<string | undefined>();
  const [catDetail, setCatDetail] = useState<PortalCategoryDetailPublic | null>(null);
  const [catLoading, setCatLoading] = useState(false);

  const loadHome = useCallback(async () => {
    setLoading(true);
    try {
      const h = await portalPublicStaffService.home();
      setHome(h);
    } catch (e: unknown) {
      message.error(String((e as Error)?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadHome();
      setCatSlug(undefined);
      setCatDetail(null);
    }
  }, [open, loadHome]);

  const loadCategory = useCallback(async (slug: string) => {
    setCatLoading(true);
    try {
      const d = await portalPublicStaffService.categoryDetail(slug);
      setCatDetail(d);
    } catch (e: unknown) {
      message.error(String((e as Error)?.message || e));
    } finally {
      setCatLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && catSlug) {
      void loadCategory(catSlug);
    }
  }, [open, catSlug, loadCategory]);

  const siteItems = home
    ? ([] as PortalImagePublic[]).concat(home.carousel || [], home.companyPhotos || [])
    : [];

  return (
    <Modal title="建模师资料库（门户橱窗参考）" open={open} onCancel={onClose} footer={null} width={920} destroyOnClose>
      <Spin spinning={loading}>
        <Tabs
          items={[
            {
              key: 'site',
              label: '站点轮播与企业实拍',
              children: (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {siteItems.length === 0 ? (
                    <Empty description="暂无站点公开素材（管理员可在门户展示配置中上传）" />
                  ) : (
                    siteItems.map((it) => <ImageTile key={`${it.fileId}-${it.url}`} item={it} />)
                  )}
                </div>
              ),
            },
            {
              key: 'cats',
              label: '分类橱窗',
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <Space wrap>
                    {(home?.categories || []).map((c) => (
                      <Button key={c.slug} type={catSlug === c.slug ? 'primary' : 'default'} size="small" onClick={() => setCatSlug(c.slug)}>
                        {c.nameCn}
                        <Text type="secondary">（{c.visibleItemCount}）</Text>
                      </Button>
                    ))}
                  </Space>
                  {!catSlug && <Text type="secondary">请选择一个分类查看全部对外素材与下载链接。</Text>}
                  {catSlug && (
                    <Spin spinning={catLoading}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {(catDetail?.items || []).length === 0 ? (
                          <Empty description="该分类暂无已发布素材" />
                        ) : (
                          catDetail!.items.map((it) => <ImageTile key={`${it.fileId}-${it.url}`} item={it} />)
                        )}
                      </div>
                    </Spin>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Spin>
    </Modal>
  );
};

export default ModelerReferenceLibraryModal;
