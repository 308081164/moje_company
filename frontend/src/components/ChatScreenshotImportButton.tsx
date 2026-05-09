import React, { useRef, useState } from 'react';
import { Button } from 'antd';
import { PictureOutlined } from '@ant-design/icons';
import { orderService } from '@/services/orderService';
import type { OrderDraftFromChatImageResponse } from '@/types/order';

type Props = {
  onDraft: (draft: OrderDraftFromChatImageResponse) => void;
};

const ChatScreenshotImportButton: React.FC<Props> = ({ onDraft }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLoading(true);
    try {
      const draft = await orderService.draftFromChatImage(file);
      onDraft(draft);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
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
    </>
  );
};

export default ChatScreenshotImportButton;
