import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { List, Input, Button, Avatar, Tag, Empty, Space, Typography, Spin, message, Modal, Popover } from 'antd';
import { ReloadOutlined, SendOutlined, FileTextOutlined, FormOutlined, SmileOutlined } from '@ant-design/icons';
import ChatDesignSubmitModal from '@/components/ChatDesignSubmitModal';
import type { InputRef } from 'antd/es/input';
import { conversationService } from '@/services/conversationService';
import { Conversation, ConversationMember, ConversationMessage, OrderEventCard } from '@/types/conversation';
import { useAuthStore } from '@/stores/authStore';
import { conversationSocket, setActiveConversationId } from '@/services/conversationSocket';

const { Text } = Typography;

const roleColor: Record<string, string> = {
  DESIGNER: 'gold',
  MODELER: 'blue',
  SALES_MID: 'purple',
  FOLLOW_UP: 'cyan',
  CUSTOMER: 'green',
  ADMIN: 'magenta',
  SALES_PRE: 'orange',
  SUPER_SERVICE: 'magenta',
};

const roleHex: Record<string, string> = {
  CUSTOMER: '#2ea043',
  DESIGNER: '#c9a96e',
  MODELER: '#4a6fff',
  SALES_MID: '#8b5cf6',
  SALES_PRE: '#f59e0b',
  FOLLOW_UP: '#22a5f7',
  SUPER_SERVICE: '#c026d3',
  ADMIN: '#c026d3',
  SYSTEM: '#999999',
};

const EVENT_STYLE: Record<string, { color: string; label: string }> = {
  DESIGN_SUBMIT: { color: '#c9a96e', label: '设计稿' },
  DESIGN_REJECT: { color: '#e05d5d', label: '驳回设计' },
  DESIGN_CONFIRM: { color: '#2ea043', label: '确认设计' },
  MODEL_SUBMIT: { color: '#4a6fff', label: '建模稿' },
  MODEL_REJECT: { color: '#e05d5d', label: '驳回建模' },
  MODEL_CONFIRM: { color: '#2ea043', label: '确认建模' },
  REVIEW_PASS: { color: '#8b5cf6', label: '工艺验证' },
  REVIEW_REJECT: { color: '#e05d5d', label: '工艺驳回' },
  QUOTATION: { color: '#f59e0b', label: '报价' },
  PRODUCTION_LOG: { color: '#22a5f7', label: '生产跟单' },
  SHIPPED: { color: '#2ea043', label: '已发货' },
  DELIVERED: { color: '#2ea043', label: '已签收' },
  STATUS_CHANGE: { color: '#6b7280', label: '状态' },
  DELIVERY_CONFIRM: { color: '#2ea043', label: '交付' },
  BALANCE_PAYMENT: { color: '#d97706', label: '支付尾款' },
  BALANCE_PAID: { color: '#2ea043', label: '已支付' },
};

const eventStyleOf = (eventType?: string) =>
  EVENT_STYLE[eventType || ''] || { color: '#6b7280', label: '事件' };

const STATUS_COLOR: Record<string, string> = {
  PENDING_DESIGN: '#f59e0b',
  DESIGNING: '#f59e0b',
  PENDING_MODEL: '#4a6fff',
  MODELING: '#4a6fff',
  PENDING_REVIEW: '#8b5cf6',
  PENDING_PRODUCTION: '#8b5cf6',
  PRODUCING: '#22a5f7',
  COMPLETED: '#2ea043',
  CANCELLED: '#999999',
};

const statusColorOf = (status?: string) => STATUS_COLOR[status || ''] || '#6b7280';

const EMOJI_LIST = (
  '😀 😁 😂 🤣 😊 😍 😘 😜 🤔 😅 😭 😡 🥰 😎 🤗 🤩 🥳 😴 😢 😤 ' +
  '👍 👎 🙏 👌 ✌️ 🤝 💪 🙌 👏 💍 💎 🌹 🌸 ⭐ ✨ 🔥 🎉 🎊 ❤️ 💖 💕 💯 ✅ ❓ ❗ 🎁'
).split(' ');

const EmojiPickerContent: React.FC<{ onPick: (emoji: string) => void }> = ({ onPick }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2, width: 300 }}>
    {EMOJI_LIST.map((emo) => (
      <Button
        key={emo}
        type="text"
        style={{ fontSize: 20, padding: '4px 0', height: 'auto' }}
        onClick={() => onPick(emo)}
      >
        {emo}
      </Button>
    ))}
  </div>
);

const SERVICE_TYPE_COLOR: Record<string, string> = {
  CUSTOM_IMAGE: '#f59e0b',
  DESIGNER_DESIGN: '#c9a96e',
  B2B_MODEL: '#8b5cf6',
};

const serviceTypeColorOf = (type?: string) => SERVICE_TYPE_COLOR[type || ''] || '#6b7280';

const ChatPage: React.FC = () => {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [designModalOpen, setDesignModalOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const inputRef = useRef<InputRef>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [currentConv, setCurrentConv] = useState<Conversation | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [detail, setDetail] = useState<ConversationMessage | null>(null);
  const [filter, setFilter] = useState<'all' | 'designing' | 'done'>('all');
  const [includeAll, setIncludeAll] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  // 同步追踪当前会话 id，避免 markRead 回调里的闭包读到过期值导致无限循环
  const currentIdRef = useRef<number | null>(null);
  const includeAllRef = useRef(false);

  // 受限角色（设计师/跟单员）需要「获取全部记录」入口
  const isRestrictedRole = user?.role === 'DESIGNER' || user?.role === 'TRACKER';

  const loadConversations = async () => {
    try {
      const list = await conversationService.listConversations();
      setConversations(list);
      if (list.length && currentIdRef.current == null) {
        const pending = (location.state as { conversationId?: number } | null)?.conversationId;
        const target = pending != null ? list.find((c) => c.id === pending) : list[0];
        void selectConversation(target || list[0]);
      }
    } catch (e) {
      console.error('获取会话列表失败', e);
    }
  };

  const selectConversation = async (conv: Conversation) => {
    const id = conv.id;
    currentIdRef.current = id;
    setCurrentId(id);
    setCurrentConv(conv);
    setLoading(true);
    try {
      const [msgs, mems] = await Promise.all([
        conversationService.getMessages(id, includeAllRef.current),
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

  const toggleIncludeAll = async () => {
    const next = !includeAll;
    includeAllRef.current = next;
    setIncludeAll(next);
    if (currentId != null) {
      setLoading(true);
      try {
        const msgs = await conversationService.getMessages(currentId, next);
        setMessages(msgs);
      } catch (e) {
        console.error('获取全部记录失败', e);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadConversations();
    return () => setActiveConversationId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setActiveConversationId(currentId);
    return () => {
      if (currentIdRef.current === currentId) {
        setActiveConversationId(null);
      }
    };
  }, [currentId]);

  useEffect(() => {
    const pending = (location.state as { conversationId?: number } | null)?.conversationId;
    if (pending == null || pending === currentIdRef.current) return;
    const conv = conversations.find((c) => c.id === pending);
    if (conv) void selectConversation(conv);
  }, [conversations, location.state]);

  useEffect(() => {
    return conversationSocket.subscribe((payload) => {
      if (payload?.type === 'MESSAGE_TRANSLATED' && payload.data) {
        const messageId = Number(payload.data.messageId);
        const translatedContent = String(payload.data.translatedContent || '');
        if (!messageId || !translatedContent) return;
        setMessages((prev) =>
          prev.map((item) => (item.id === messageId ? { ...item, translatedContent } : item))
        );
        return;
      }
      if (payload?.type !== 'MESSAGE' || !payload.data) return;
      const incoming = payload.data as ConversationMessage;
      if (!incoming?.id || incoming.conversationId == null) return;
      if (incoming.conversationId === currentIdRef.current) {
        setMessages((prev) => (prev.some((item) => item.id === incoming.id) ? prev : [...prev, incoming]));
        conversationService.markRead(incoming.conversationId).catch(() => {});
      }
      void loadConversations();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages]);

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current?.input;
    if (!el) {
      setInput((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart ?? input.length;
    const end = el.selectionEnd ?? start;
    const next = input.slice(0, start) + emoji + input.slice(end);
    setInput(next);
    const pos = start + emoji.length;
    requestAnimationFrame(() => {
      el.focus();
      try {
        el.setSelectionRange(pos, pos);
      } catch {
        /* ignore */
      }
    });
  };

  const send = async () => {
    const text = input.trim();
    if (!text || currentId == null) return;
    setSending(true);
    try {
      const msg = await conversationService.sendMessage(currentId, text);
      setMessages((prev) => (prev.some((item) => item.id === msg.id) ? prev : [...prev, msg]));
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

  const currentOrderId = currentConv?.orderId ?? null;

  const goOrderTask = () => {
    if (currentOrderId != null) navigate(`/orders/${currentOrderId}`);
  };

  const openDesignModal = () => {
    setDesignModalOpen(true);
  };

  const onDesignSubmitted = async () => {
    if (currentIdRef.current != null) {
      const msgs = await conversationService.getMessages(currentIdRef.current, includeAllRef.current);
      setMessages(msgs);
    }
    void loadConversations();
  };

  const isSystem = (m: ConversationMessage) => m.role === 'SYSTEM' && m.msgType !== 'event';

  const isEventCard = (m: ConversationMessage) => m.msgType === 'event' && !!m.event;

  const translationOf = (m: ConversationMessage) =>
    translations[m.id] ||
    (m.translatedContent && m.translatedContent !== m.content ? m.translatedContent : '');

  const toggleTranslate = async (m: ConversationMessage) => {
    if (translations[m.id]) {
      setTranslations((prev) => {
        const next = { ...prev };
        delete next[m.id];
        return next;
      });
      return;
    }
    if (m.translatedContent && m.translatedContent !== m.content) {
      setTranslations((prev) => ({ ...prev, [m.id]: '' }));
      return;
    }
    try {
      const dto = await conversationService.translateMessage(m.id, 'zh-CN');
      setTranslations((prev) => ({
        ...prev,
        [m.id]: dto.translatedContent || dto.content || m.content || '',
      }));
    } catch {
      message.error('翻译失败');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 188px)',
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
          height: '100%',
          minHeight: 0,
        }}
      >
        <div style={{ padding: 12, borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
          <Button size="small" icon={<ReloadOutlined />} onClick={() => void loadConversations()}>
            刷新
          </Button>
          {user?.role === 'ADMIN' && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
              <Tag color="magenta">系统视角</Tag> 可查看全部客户群聊
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '8px 12px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
          {(['all', 'designing', 'done'] as const).map((f) => (
            <Button
              key={f}
              size="small"
              type={filter === f ? 'primary' : 'default'}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? '全部' : f === 'designing' ? '设计中' : '已完成'}
            </Button>
          ))}
        </div>
        <List
          dataSource={conversations.filter((c) => {
            if (filter === 'all') return true;
            if (filter === 'designing') {
              return c.orderStatus === 'PENDING_DESIGN' || c.orderStatus === 'DESIGNING';
            }
            return !(c.orderStatus === 'PENDING_DESIGN' || c.orderStatus === 'DESIGNING');
          })}
          style={{ flex: 1, overflow: 'auto', minHeight: 0 }}
          locale={{ emptyText: <Empty description="暂无会话" /> }}
          renderItem={(c) => (
            <List.Item
              onClick={() => void selectConversation(c)}
              style={{
                cursor: 'pointer',
                padding: '12px',
                background: c.id === currentId ? '#f5f5f5' : undefined,
                borderBottom: '1px solid #f5f5f5',
              }}
            >
              <List.Item.Meta
                avatar={
                  <Avatar style={{ background: statusColorOf(c.orderStatus), color: '#fff' }}>
                    {(c.orderNumber || c.title || '#').charAt(0)}
                  </Avatar>
                }
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.orderNumber || c.title}
                    </span>
                    {c.unreadCount > 0 && (
                      <Tag color="red" style={{ flexShrink: 0, marginInlineEnd: 0 }}>
                        {c.unreadCount}
                      </Tag>
                    )}
                    {c.serviceTypeLabel && (
                      <span
                        style={{
                          fontSize: 10,
                          color: '#fff',
                          background: serviceTypeColorOf(c.serviceType),
                          padding: '0 6px',
                          borderRadius: 99,
                          lineHeight: 1.7,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {c.serviceTypeLabel}
                      </span>
                    )}
                  </div>
                }
                description={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, minWidth: 0 }}>
                    {c.orderStatusLabel && (
                      <span
                        style={{
                          fontSize: 11,
                          color: '#fff',
                          background: statusColorOf(c.orderStatus),
                          padding: '1px 8px',
                          borderRadius: 99,
                          lineHeight: 1.6,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {c.orderStatusLabel}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 12,
                        color: '#999',
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.lastMessage || ''}
                    </span>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </div>

      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', minHeight: 0 }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #f0f0f0',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: 'linear-gradient(180deg, #fff 0%, #fafafa 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {currentConv && (
              <>
                <Avatar style={{ background: statusColorOf(currentConv.orderStatus), color: '#fff', flexShrink: 0 }}>
                  {(currentConv.orderNumber || currentConv.title || '#').charAt(0)}
                </Avatar>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#2C2C2C', lineHeight: 1.3 }}>
                    {currentConv.orderNumber || currentConv.title}
                  </div>
                  {currentConv.orderStatusLabel && (
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 11,
                        color: '#fff',
                        background: statusColorOf(currentConv.orderStatus),
                        padding: '1px 10px',
                        borderRadius: 99,
                        lineHeight: 1.6,
                        marginTop: 2,
                      }}
                    >
                      {currentConv.orderStatusLabel}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          <Space wrap style={{ flexShrink: 0 }}>
            {currentOrderId != null && (
              <Button size="small" icon={<FileTextOutlined />} onClick={goOrderTask}>
                我的任务
              </Button>
            )}
            {currentOrderId != null && user?.role === 'DESIGNER' && (
              <Button size="small" type="primary" icon={<FormOutlined />} onClick={openDesignModal}>
                提交设计稿
              </Button>
            )}
            {isRestrictedRole && (
              <Button
                size="small"
                type={includeAll ? 'primary' : 'default'}
                onClick={() => void toggleIncludeAll()}
              >
                {includeAll ? '仅看本环节' : '获取全部记录'}
              </Button>
            )}
            {members.map((m) => (
              <Tag key={m.id} color={roleColor[m.role || ''] || 'default'}>
                {m.displayName || m.role}
              </Tag>
            ))}
          </Space>
        </div>

        <div ref={bodyRef} style={{ flex: 1, overflow: 'auto', padding: 16, minHeight: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin />
            </div>
          ) : messages.length === 0 ? (
            <Empty description="暂无消息" />
          ) : (
            messages.map((m) => {
              if (isEventCard(m)) {
                const ev = m.event as OrderEventCard;
                const style = eventStyleOf(ev.eventType);
                const senderRole = ev.actorRole || m.role || 'SYSTEM';
                const senderName = ev.actorName || m.displayName || senderRole || '?';
                const mineEvent = ev.actorType === 'STAFF' && ev.actorId === user?.id;
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      justifyContent: mineEvent ? 'flex-end' : 'flex-start',
                      marginBottom: 14,
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ maxWidth: '70%', minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: roleHex[senderRole] || '#999',
                          marginBottom: 2,
                          textAlign: mineEvent ? 'right' : 'left',
                        }}
                      >
                        {senderName}
                      </div>
                      <div
                        onClick={() => setDetail(m)}
                        style={{
                          width: 340,
                          maxWidth: '100%',
                          cursor: 'pointer',
                          backgroundImage: `radial-gradient(circle at 15% 0%, ${style.color}1f 0, transparent 42%), radial-gradient(circle at 90% 100%, ${style.color}14 0, transparent 50%), linear-gradient(160deg, rgba(255,255,255,0.96) 0%, rgba(248,248,250,0.86) 100%)`,
                          backdropFilter: 'blur(14px)',
                          border: '1px solid rgba(255,255,255,0.75)',
                          borderTop: `3px solid ${style.color}`,
                          borderRadius: ev.eventType === 'BALANCE_PAYMENT' || ev.eventType === 'BALANCE_PAID' ? 999 : 16,
                          padding: '12px 14px',
                          boxSizing: 'border-box',
                          boxShadow: `0 10px 28px ${style.color}1f, 0 2px 8px rgba(0,0,0,0.05)`,
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = `0 16px 38px ${style.color}2f, 0 3px 10px rgba(0,0,0,0.06)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = '';
                          e.currentTarget.style.boxShadow = `0 10px 28px ${style.color}1f, 0 2px 8px rgba(0,0,0,0.05)`;
                        }}
                      >
                        {ev.title && (
                          <div style={{ fontWeight: 600, fontSize: 13, color: style.color, marginBottom: 8 }}>
                            {ev.title}
                          </div>
                        )}
                        {(ev.images || []).length > 0 && (
                          <div style={{ position: 'relative', marginBottom: 8 }}>
                            <img
                              src={ev.images![0]}
                              alt="design"
                              style={{
                                width: '100%',
                                height: 150,
                                objectFit: 'cover',
                                borderRadius: 10,
                                border: '1px solid rgba(0,0,0,0.05)',
                                boxShadow: '0 4px 14px rgba(0,0,0,0.10)',
                              }}
                            />
                            {ev.images!.length > 1 && (
                              <span
                                style={{
                                  position: 'absolute',
                                  top: 8,
                                  right: 8,
                                  background: 'rgba(0,0,0,0.6)',
                                  color: '#fff',
                                  fontSize: 12,
                                  padding: '2px 8px',
                                  borderRadius: 99,
                                }}
                              >
                                +{ev.images!.length - 1}
                              </span>
                            )}
                          </div>
                        )}
                        {ev.content && (
                          <div
                            style={{
                              fontSize: 13,
                              lineHeight: 1.6,
                              color: '#3a3a3a',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              marginBottom: 8,
                            }}
                          >
                            {ev.content}
                          </div>
                        )}
                        {ev.reason && (
                          <div
                            style={{
                              fontSize: 12,
                              color: '#d9534f',
                              padding: '6px 10px',
                              borderRadius: 8,
                              background: 'rgba(224,93,93,0.08)',
                              borderLeft: '3px solid #e05d5d',
                            }}
                          >
                            {ev.reason}
                          </div>
                        )}
                        {ev.resolution && ev.resolutionLabel && (
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              padding: '3px 10px',
                              borderRadius: 99,
                              display: 'inline-block',
                              color: ev.resolution === 'REJECT' ? '#c0392b' : '#1c7c3c',
                              background: ev.resolution === 'REJECT' ? 'rgba(224,93,93,0.15)' : 'rgba(46,160,67,0.15)',
                              marginTop: 6,
                            }}
                          >
                            {ev.resolutionLabel}
                            {ev.resolution === 'CONFIRM' ? ' ✓' : ev.resolution === 'REJECT' ? ' ✗' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
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
              const translated = translationOf(m);
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
                      style={{
                        fontSize: 12,
                        display: 'block',
                        textAlign: own ? 'right' : 'left',
                        color: own ? undefined : roleHex[m.role || ''] || '#999',
                      }}
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
                    {translated && (
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
                        {translated}
                      </div>
                    )}
                    {!own && m.content && m.id != null && (
                      <div>
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0, height: 'auto', fontSize: 12 }}
                          onClick={() => void toggleTranslate(m)}
                        >
                          {translated ? '显示原文' : '翻译'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ padding: 12, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8, flexShrink: 0 }}>
          <Popover
            content={<EmojiPickerContent onPick={(emo) => { insertEmoji(emo); setEmojiOpen(false); }} />}
            trigger="click"
            open={emojiOpen}
            onOpenChange={setEmojiOpen}
            placement="topLeft"
          >
            <Button icon={<SmileOutlined />} disabled={currentId == null} aria-label="表情" />
          </Popover>
          <Input
            ref={inputRef}
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

      <ChatDesignSubmitModal
        open={designModalOpen}
        orderId={currentOrderId}
        designerUserId={user?.id}
        onClose={() => setDesignModalOpen(false)}
        onSubmitted={() => void onDesignSubmitted()}
      />

      <Modal open={!!detail} onCancel={() => setDetail(null)} footer={null} width={480} title={null}>
        {detail && (() => {
          const ev = detail.event as OrderEventCard | undefined;
          if (!ev) return null;
          const style = eventStyleOf(ev.eventType);
          const senderRole = ev.actorRole || detail.role || 'SYSTEM';
          const senderName = ev.actorName || detail.displayName || senderRole || '?';
          return (
            <div>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: 12,
                  color: '#fff',
                  padding: '2px 10px',
                  borderRadius: 99,
                  background: style.color,
                  marginBottom: 10,
                }}
              >
                {style.label}
              </span>
              <div style={{ fontWeight: 600, fontSize: 16, color: '#2C2C2C', marginBottom: 6 }}>
                {ev.title || style.label}
              </div>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 14 }}>
                {senderName} · {detail.createdAt ? new Date(detail.createdAt).toLocaleString() : ''}
              </div>
              {(ev.images || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                  {ev.images!.map((img, i) => (
                    <img key={i} src={img} alt="" style={{ width: '100%', borderRadius: 10, border: '1px solid #eee' }} />
                  ))}
                </div>
              )}
              {ev.content && (
                <div style={{ fontSize: 14, lineHeight: 1.6, color: '#3a3a3a', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {ev.content}
                </div>
              )}
              {ev.reason && (
                <div
                  style={{
                    fontSize: 13,
                    color: '#d9534f',
                    marginTop: 12,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'rgba(224,93,93,0.08)',
                    borderLeft: '3px solid #e05d5d',
                  }}
                >
                  驳回原因：{ev.reason}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default ChatPage;
