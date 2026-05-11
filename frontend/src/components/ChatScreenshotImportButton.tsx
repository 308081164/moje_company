import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Image, Space, Typography, message } from 'antd';
import { PictureOutlined, PlusOutlined, ThunderboltOutlined, DeleteOutlined } from '@ant-design/icons';
import { orderService } from '@/services/orderService';
import type { OrderDraftFromChatImageResponse } from '@/types/order';

const { Text } = Typography;

const MAX_IMAGES = 10;

type Slot = {
  uid: string;
  file: File;
  url: string;
  loading: boolean;
};

type Props = {
  onDraft: (draft: OrderDraftFromChatImageResponse) => void;
};

const ChatScreenshotImportButton: React.FC<Props> = ({ onDraft }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const revokeAllUrls = useCallback((list: Slot[]) => {
    list.forEach((s) => URL.revokeObjectURL(s.url));
  }, []);

  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  useEffect(
    () => () => {
      revokeAllUrls(slotsRef.current);
    },
    [revokeAllUrls]
  );

  const addFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const incoming = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (!incoming.length) {
      message.warning('请选择图片文件');
      return;
    }
    setSlots((prev) => {
      const next = [...prev];
      let added = 0;
      for (const file of incoming) {
        if (next.length >= MAX_IMAGES) break;
        next.push({
          uid: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          url: URL.createObjectURL(file),
          loading: false,
        });
        added++;
      }
      if (added < incoming.length) {
        message.warning(`最多保留 ${MAX_IMAGES} 张，已截断`);
      }
      return next;
    });
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeSlot = (uid: string) => {
    setSlots((prev) => {
      const hit = prev.find((s) => s.uid === uid);
      if (hit) URL.revokeObjectURL(hit.url);
      return prev.filter((s) => s.uid !== uid);
    });
  };

  const recognizeOne = async (uid: string) => {
    const slot = slotsRef.current.find((s) => s.uid === uid);
    if (!slot || slot.loading) return;
    setSlots((p) => p.map((s) => (s.uid === uid ? { ...s, loading: true } : s)));
    try {
      const draft = await orderService.draftFromChatImage(slot.file);
      onDraft(draft);
      message.success('已识别并填入（可与其它图片结果合并）');
    } catch {
      message.error('识别失败，请检查网络或后台通义千问配置');
    } finally {
      setSlots((p) => p.map((s) => (s.uid === uid ? { ...s, loading: false } : s)));
    }
  };

  const recognizeAll = async () => {
    const list = slotsRef.current;
    if (!list.length) {
      message.info('请先添加图片');
      return;
    }
    setBulkLoading(true);
    try {
      for (const s of list) {
        setSlots((p) => p.map((x) => (x.uid === s.uid ? { ...x, loading: true } : x)));
        try {
          const draft = await orderService.draftFromChatImage(s.file);
          onDraft(draft);
        } catch {
          message.error(`「${s.file.name}」识别失败，已跳过`);
        } finally {
          setSlots((p) => p.map((x) => (x.uid === s.uid ? { ...x, loading: false } : x)));
        }
      }
      message.success('已按顺序识别全部图片');
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => addFiles(e.target.files)}
      />
      <Space wrap align="start">
        <Button icon={<PlusOutlined />} onClick={() => inputRef.current?.click()} disabled={slots.length >= MAX_IMAGES}>
          添加聊天截图（最多 {MAX_IMAGES} 张）
        </Button>
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          loading={bulkLoading}
          disabled={!slots.length || bulkLoading}
          onClick={() => void recognizeAll()}
        >
          一键识别全部
        </Button>
      </Space>
      <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
        点击缩略图单独识别该张；多次识别会合并写入「基础需求 / 材质」等长文本，其它字段以首次识别为准（已填则不覆盖）。
      </Text>
      {slots.length > 0 ? (
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {slots.map((s) => (
            <div key={s.uid} style={{ position: 'relative', width: 112 }}>
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !s.loading) {
                    e.preventDefault();
                    void recognizeOne(s.uid);
                  }
                }}
                onClick={() => {
                  if (!s.loading) void recognizeOne(s.uid);
                }}
              >
                <Image
                  src={s.url}
                  alt={s.file.name}
                  width={112}
                  height={112}
                  style={{
                    objectFit: 'cover',
                    borderRadius: 8,
                    cursor: s.loading ? 'wait' : 'pointer',
                    opacity: s.loading ? 0.6 : 1,
                    border: '1px solid #eee',
                  }}
                  preview={false}
                />
              </div>
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                aria-label="移除"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSlot(s.uid);
                }}
                style={{ position: 'absolute', top: -6, right: -6 }}
              />
              <Text ellipsis style={{ display: 'block', fontSize: 11, marginTop: 4 }} title={s.file.name}>
                {s.loading ? '识别中…' : '点击识别'}
              </Text>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <Button icon={<PictureOutlined />} type="dashed" onClick={() => inputRef.current?.click()}>
            从相册选择截图
          </Button>
        </div>
      )}
    </div>
  );
};

export default ChatScreenshotImportButton;
