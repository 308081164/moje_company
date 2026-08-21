import React, { useEffect, useRef, useState } from 'react';
import { List, Input, Button, Avatar, Tag, Empty, Space, Typography, Spin, message } from 'antd';
import { ReloadOutlined, SendOutlined } from '@ant-design/icons';
import { conversationService } from '@/services/conversationService';
import { Conversation, ConversationMember, ConversationMessage } from '@/types/conversation';
import { useAuthStore } from '@/stores/authStore';

const { Text } = Typography;

const roleColor: Record<string, string> = {
  DESIGNER: 'gold',
  MODELER: 'blue',
  SALES_MID: 'purple',
  FOLLOW_UP: 'cyan',
  CUSTOMER: 'green',
  ADMIN: 'magenta',
  SALES_PRE: 'orange',
};

const ChatPage: React.FC = () => {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    try {
      const list = await conversationService.listConversations();
      setConversations(list);
      if (list.length && currentId == null) {
        void selectConversation(list[0].id);
      }
    } catch (e) {
      console.error('获取会话列表失败', e);
    }
  };

  const selectConversation = async (id: number) => {
    setCurrentId(id);
    setLoading(true);
    try {
      const [msgs, mems] = await Promise.all([
        conversationService.getMessages(id),
        conversationService.getMembers(id),
      ]);
      setMessages(msgs);
      setMembers(mems);
      conversationService.markRead(id).then(loadConversations).catch(() => {});
    } catch (e) {
      console.error('获取会话详情失败', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || currentId == null) return;
    setSending(true);
    try {
      const msg = await conversationService.sendMessage(currentId, text);
      setMessages((prev) => [...prev, msg]);
      setInput('');
      void loadConversations();
    } catch (e) {
      message.error('发送失败');
    } finally {
      setSending(false);
    }
  };

  const isMine = (m: ConversationMessage) =>
    m.senderType === 'STAFF' && m.senderId === (user?.id ?? -1) && m.role !== 'SYSTEM';

  const isSystem = (m: ConversationMessage) => m.role === 'SYSTEM' || m.msgType === 'event';

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        minHeight: 480,
        background: '#fff',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid #f0f0f0',
      }}
    >
      <div
        style={{
          width: 280,
          borderRight: '1px solid #f0f0f0',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: 12, borderBottom: '1px solid #f0f0f0' }}>
          <Button size="small" icon={<ReloadOutlined />} onClick={() => void loadConversations()}>
            刷新
          </Button>
        </div>
        <List
          dataSource={conversations}
          style={{ flex: 1, overflow: 'auto' }}
          locale={{ emptyText: <Empty description="暂无会话" /> }}
          renderItem={(c) => (
            <List.Item
              onClick={() => void selectConversation(c.id)}
              style={{
                cursor: 'pointer',
                padding: '12px',
                background: c.id === currentId ? '#f5f5f5' : undefined,
              }}
            >
              <List.Item.Meta
                avatar={<Avatar>{(c.title || c.orderNumber || '#').charAt(0)}</Avatar>}
                title={
                  <Space>
                    <span>{c.title || c.orderNumber}</span>
                    {c.unreadCount > 0 && <Tag color="red">{c.unreadCount}</Tag>}
                  </Space>
                }
                description={c.lastMessage || ''}
              />
            </List.Item>
          )}
        />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: 12, borderBottom: '1px solid #f0f0f0' }}>
          <Space wrap>
            {members.map((m) => (
              <Tag key={m.id} color={roleColor[m.role || ''] || 'default'}>
                {m.displayName || m.role}
              </Tag>
            ))}
          </Space>
        </div>

        <div ref={bodyRef} style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin />
            </div>
          ) : messages.length === 0 ? (
            <Empty description="暂无消息" />
          ) : (
            messages.map((m) => {
              const system = isSystem(m);
              const own = isMine(m);
              if (system) {
                return (
                  <div key={m.id} style={{ textAlign: 'center', margin: '8px 0' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {m.content}
                    </Text>
                  </div>
                );
              }
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: own ? 'flex-end' : 'flex-start',
                    marginBottom: 8,
                  }}
                >
                  <div style={{ maxWidth: '70%' }}>
                    <Text
                      type="secondary"
                      style={{ fontSize: 12, display: 'block', textAlign: own ? 'right' : 'left' }}
                    >
                      {m.displayName || m.role}
                    </Text>
                    <div
                      style={{
                        background: own ? '#1890ff' : '#f0f0f0',
                        color: own ? '#fff' : '#333',
                        padding: '8px 12px',
                        borderRadius: 8,
                        display: 'inline-block',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {m.content}
                    </div>
                    {m.translatedContent && m.translatedContent !== m.content && (
                      <div
                        style={{
                          color: '#999',
                          fontSize: 12,
                          marginTop: 3,
                          paddingLeft: 6,
                          borderLeft: '2px solid rgba(24,144,255,0.4)',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {m.translatedContent}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ padding: 12, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={() => void send()}
            placeholder="输入消息…"
            disabled={currentId == null}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={sending}
            onClick={() => void send()}
            disabled={currentId == null}
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
