import React, { useEffect, useRef, useState } from 'react';
import { Button, Image, Typography } from 'antd';
import { PictureOutlined } from '@ant-design/icons';
import { orderService } from '@/services/orderService';
import type { OrderDraftFromChatImageResponse } from '@/types/order';

const { Text } = Typography;

type Props = {
  onDraft: (draft: OrderDraftFromChatImageResponse) => void;
};

const ChatScreenshotImportButton: React.FC<Props> = ({ onDraft }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [echoUrl, setEchoUrl] = useState<string | null>(null);

  const replaceEchoBlob = (next: string | null) => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (next) {
      blobUrlRef.current = next;
    }
    setEchoUrl(next);
  };

  useEffect(
    () => () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    },
    []
  );

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    replaceEchoBlob(URL.createObjectURL(file));
    setLoading(true);
    try {
      const draft = await orderService.draftFromChatImage(file);
      onDraft(draft);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onChange}
      />
      <Button icon={<PictureOutlined />} loading={loading} onClick={() => inputRef.current?.click()}>
        上传聊天截图识别
      </Button>
      {echoUrl ? (
        <div style={{ marginTop: 10 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
            本次截图（点击缩略图可预览）
          </Text>
          <Image
            src={echoUrl}
            alt="聊天截图"
            width={120}
            height={120}
            style={{ objectFit: 'cover', borderRadius: 4 }}
          />
        </div>
      ) : null}
    </div>
  );
};

export default ChatScreenshotImportButton;
