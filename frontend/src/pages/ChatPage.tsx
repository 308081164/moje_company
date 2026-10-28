import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { List, Input, Button, Avatar, Tag, Empty, Space, Typography, Spin, message, Modal, Popover, Segmented } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined, SendOutlined, FileTextOutlined, FormOutlined, SmileOutlined } from '@ant-design/icons';
import ChatDesignSubmitModal from '@/components/ChatDesignSubmitModal';
import type { InputRef } from 'antd/es/input';
import { conversationService } from '@/services/conversationService';
import { Conversation, ConversationMember, ConversationMessage, OrderEventCard } from '@/types/conversation';
import { useAuthStore, useIsAdmin } from '@/stores/authStore';
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
  AI_ASSISTANT: 'cyan',
};

function escapeRichHtml(text: string): string {
  return String(text || '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
}

function linkifyRich(text: string): string {
  return text.replace(/(https?:\/\/[^\s<]+|order-brief\.html\?orderId=\d+)/g, (match) =>
    `<a class="msg__link" href="${match}" target="_blank" rel="noopener noreferrer">${match}</a>`);
}

function renderRichLine(text: string): string {
  let html = escapeRichHtml(text);
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  return linkifyRich(html);
}

function renderRichText(text: string): React.ReactNode {
  const lines = String(text || '').split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  let key = 0;
  const flush = () => {
    if (list.length) {
      nodes.push(
        <ul key={`list-${key++}`} style={{ margin: '6px 0 0', paddingLeft: 20 }}>
          {list}
        </ul>,
      );
      list = [];
    }
  };
  for (const line of lines) {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
    const numbered = trimmed.match(/^\d+[.、)]\s*(.*)$/);
    if (bullet || numbered) {
      list.push(
        <li
          key={key++}
          style={{ margin: '2px 0' }}
          dangerouslySetInnerHTML={{ __html: renderRichLine(bullet ? bullet[1] : numbered![1]) }}
        />,
      );
      continue;
    }
    flush();
    if (!trimmed) {
      nodes.push(<div key={key++} style={{ height: 6 }} />);
      continue;
    }
    nodes.push(
      <div key={key++} style={{ margin: '0 0 6px' }} dangerouslySetInnerHTML={{ __html: renderRichLine(trimmed) }} />,
    );
  }
  flush();
  return <>{nodes}</>;
}

const roleHex: Record<string, string> = {
  CUSTOMER: '#2ea043',
  DESIGNER: '#c9a96e',
  MODELER: '#4a6fff',
  SALES_MID: '#8b5cf6',
  SALES_PRE: '#f59e0b',
  FOLLOW_UP: '#22a5f7',
  SUPER_SERVICE: '#c026d3',
  AI_ASSISTANT: '#0d9488',
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
  SHIPPING_ADDRESS_REQUEST: { color: '#22a5f7', label: '收货信息' },
  SHIPPING_ADDRESS_FILLED: { color: '#2ea043', label: '已填收货信息' },
  DELIVERED: { color: '#2ea043', label: '已签收' },
  STATUS_CHANGE: { color: '#6b7280', label: '状态' },
  DELIVERY_CONFIRM: { color: '#2ea043', label: '交付' },
  BALANCE_PAYMENT: { color: '#d97706', label: '支付尾款' },
  BALANCE_PAID: { color: '#2ea043', label: '已支付' },
};

const eventStyleOf = (eventType?: string) =>
  EVENT_STYLE[eventType || ''] || { color: '#6b7280', label: '事件' };

const isCraftReviewEvent = (eventType?: string) =>
  eventType === 'REVIEW_PASS' || eventType === 'REVIEW_REJECT';

const eventPreviewImages = (images?: string[], eventType?: string) => {
  if (isCraftReviewEvent(eventType)) return [];
  return (images || []).filter((src) => !String(src).startsWith('data:image/svg'));
};

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

type ChatTier = 'phone' | 'tablet' | 'desktop';

function readChatTier(): ChatTier {
  if (typeof window === 'undefined') return 'desktop';
  if (window.innerWidth < 768) return 'phone';
  if (window.innerWidth < 1200) return 'tablet';
  return 'desktop';
}

const EmojiPickerContent: React.FC<{ onPick: (emoji: string) => void }> = ({ onPick }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2, width: 'min(300px, 70vw)' }}>
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

function mergeThread(
  prev: ConversationMessage[],
  incoming: ConversationMessage[],
  conversationId: number
): ConversationMessage[] {
  const prevSame = prev.length > 0 && prev[0].conversationId === conversationId;
  const map = new Map<number, ConversationMessage>();
  if (prevSame) {
    for (const message of prev) map.set(message.id, message);
  }
  for (const message of incoming) {
    const old = map.get(message.id);
    map.set(
      message.id,
      old
        ? { ...old, ...message, translatedContent: message.translatedContent || old.translatedContent }
        : message
    );
  }
  return Array.from(map.values()).sort((a, b) => a.id - b.id);
}

type AdminChatPersona = 'SUPER_SERVICE' | 'DESIGNER' | 'MODELER';

function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => {
    const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
    const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
    if (tb !== ta) return tb - ta;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}

const ChatPage: React.FC = () => {
  const { user } = useAuthStore();
  const isAdmin = useIsAdmin();
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
  const [detailIndex, setDetailIndex] = useState(0);
  const [filter, setFilter] = useState<'all' | 'designing' | 'done'>('all');
  const [includeAll, setIncludeAll] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  // 同步追踪当前会话 id，避免 markRead 回调里的闭包读到过期值导致无限循环
  const currentIdRef = useRef<number | null>(null);
  const threadRef = useRef<{ id: number | null; messages: ConversationMessage[] }>({ id: null, messages: [] });
  const includeAllRef = useRef(false);
  const [chatPersona, setChatPersona] = useState<AdminChatPersona>('SUPER_SERVICE');
  const [tier, setTier] = useState<ChatTier>(readChatTier);
  const [threadOpen, setThreadOpen] = useState(false);
  const tierRef = useRef(tier);
  tierRef.current = tier;
  const chatSearchRef = useRef(location.search);

  // 受限角色（设计师/跟单员）需要「获取全部记录」入口
  const isRestrictedRole = user?.role === 'DESIGNER' || user?.role === 'TRACKER';

  const loadConversations = async () => {
    try {
      const list = sortConversations(await conversationService.listConversations());
      setConversations(list);
      if (list.length && currentIdRef.current == null) {
        const pending = (location.state as { conversationId?: number } | null)?.conversationId;
        const target = pending != null ? list.find((c) => c.id === pending) : undefined;
        if (target) {
          void selectConversation(target);
        } else if (tierRef.current !== 'phone') {
          void selectConversation(list[0]);
        }
      }
    } catch (e) {
      console.error('获取会话列表失败', e);
    }
  };

  const publishThread = (conversationId: number, incoming: ConversationMessage[]) => {
    const switched = threadRef.current.id !== conversationId;
    const prev = switched ? [] : threadRef.current.messages;
    const merged = mergeThread(prev, incoming, conversationId);
    const same =
      prev.length === merged.length &&
      prev.every(
        (message, index) =>
          message.id === merged[index]?.id &&
          message.content === merged[index]?.content &&
          message.translatedContent === merged[index]?.translatedContent
      );
    threadRef.current = { id: conversationId, messages: merged };
    conversationSocket.noteSnapshot(conversationId, merged);
    if ((switched || !same) && currentIdRef.current === conversationId) setMessages(merged);
    return merged;
  };

  const selectConversation = async (conv: Conversation, opts?: { skipHistory?: boolean }) => {
    const phone = window.innerWidth < 768;
    if (phone) {
      setThreadOpen(true);
      if (!opts?.skipHistory) {
        const params = new URLSearchParams(location.search);
        if (params.get('c') !== String(conv.id)) {
          // 手机从列表进入会话时压入历史，系统返回先回到列表
          navigate({ pathname: '/chat', search: `?c=${conv.id}` });
        }
      }
      const shell = (window.__mojeShellBackState ||= {});
      shell.chatThreadOpen = true;
      shell.chatHistoryPushed = new URLSearchParams(window.location.hash.split('?')[1] || '').get('c') != null;
      shell.closeChatThread = () => {
        setThreadOpen(false);
        if (new URLSearchParams(window.location.hash.split('?')[1] || '').get('c')) {
          navigate({ pathname: '/chat', search: '' }, { replace: true });
        }
      };
    }
    const id = conv.id;
    currentIdRef.current = id;
    setActiveConversationId(id);
    setCurrentId(id);
    setCurrentConv(conv);
    setLoading(true);
    try {
      const [msgs, mems] = await Promise.all([
        conversationService.getMessages(id, includeAllRef.current),
        conversationService.getMembers(id),
      ]);
      if (currentIdRef.current !== id) return;
      publishThread(id, msgs);
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
        if (currentIdRef.current === currentId) publishThread(currentId, msgs);
      } catch (e) {
        console.error('获取全部记录失败', e);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const onResize = () => {
      const next = readChatTier();
      tierRef.current = next;
      setTier(next);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
    const state = location.state as { conversationId?: number; chatAsRole?: AdminChatPersona } | null;
    const pending = state?.conversationId;
    if (pending == null || pending === currentIdRef.current) return;
    const conv = conversations.find((c) => c.id === pending);
    if (conv) void selectConversation(conv);
    if (state?.chatAsRole && isAdmin) {
      setChatPersona(state.chatAsRole);
    }
  }, [conversations, location.state, isAdmin]);

  // 手机返回栈：#/chat?c=id 被弹出时回到会话列表
  useEffect(() => {
    const prev = chatSearchRef.current;
    chatSearchRef.current = location.search;
    if (tier !== 'phone') return;
    const prevC = new URLSearchParams(prev).get('c');
    const nextC = new URLSearchParams(location.search).get('c');
    if (prevC && !nextC) {
      setThreadOpen(false);
      return;
    }
    if (!nextC) return;
    setThreadOpen(true);
    const id = Number(nextC);
    if (!Number.isFinite(id) || currentIdRef.current === id) return;
    const conv = conversations.find((item) => item.id === id);
    if (conv) void selectConversation(conv, { skipHistory: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, location.search, conversations]);

  useEffect(() => {
    const phoneThread = tier === 'phone' && threadOpen;
    const pushed = phoneThread && new URLSearchParams(location.search).get('c') != null;
    const state = (window.__mojeShellBackState ||= {});
    state.chatThreadOpen = phoneThread;
    state.chatHistoryPushed = pushed;
    state.chatDetailOpen = detail != null;
    state.chatDesignOpen = designModalOpen;
    state.closeChatDetail = () => setDetail(null);
    state.closeChatDesign = () => setDesignModalOpen(false);
    state.closeChatThread = () => {
      setThreadOpen(false);
      if (new URLSearchParams(window.location.hash.split('?')[1] || '').get('c')) {
        navigate({ pathname: '/chat', search: '' }, { replace: true });
      }
    };
  }, [tier, threadOpen, location.search, detail, designModalOpen]);

  useEffect(() => {
    return () => {
      const state = window.__mojeShellBackState;
      if (!state) return;
      state.chatThreadOpen = false;
      state.chatHistoryPushed = false;
      state.chatDetailOpen = false;
      state.chatDesignOpen = false;
      state.closeChatDetail = undefined;
      state.closeChatDesign = undefined;
      state.closeChatThread = undefined;
    };
  }, []);

  useEffect(() => {
    conversationSocket.setIncludeAll(includeAllRef.current);
    const unsubscribe = conversationSocket.subscribe((payload) => {
      if (payload?.type === 'MESSAGE_TRANSLATED' && payload.data) {
        const messageId = Number(payload.data.messageId);
        const translatedContent = String(payload.data.translatedContent || '');
        if (!messageId || !translatedContent) return;
        const conversationId = currentIdRef.current;
        if (conversationId != null && threadRef.current.id === conversationId) {
          publishThread(
            conversationId,
            threadRef.current.messages.map((item) =>
              item.id === messageId ? { ...item, translatedContent } : item
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((item) => (item.id === messageId ? { ...item, translatedContent } : item))
          );
        }
        return;
      }
      if (payload?.type !== 'MESSAGE' || !payload.data) return;
      const incoming = payload.data as ConversationMessage;
      if (!incoming?.id || incoming.conversationId == null) return;
      if (incoming.conversationId === currentIdRef.current) {
        publishThread(incoming.conversationId, [incoming]);
        conversationService.markRead(incoming.conversationId).catch(() => {});
      }
      void loadConversations();
    });
    const unsubscribeList = conversationSocket.onConversationList((list) => {
      setConversations((prev) => {
        if (
          prev.length === list.length &&
          prev.every(
            (item, index) =>
              item.id === list[index]?.id &&
              item.lastMessage === list[index]?.lastMessage &&
              item.unreadCount === list[index]?.unreadCount &&
              item.orderStatus === list[index]?.orderStatus
          )
        ) {
          return prev;
        }
        return list;
      });
    });
    const unsubscribeSync = conversationSocket.onMessagesSynced((conversationId, msgs) => {
      if (conversationId !== currentIdRef.current) return;
      publishThread(conversationId, msgs);
    });
    return () => {
      unsubscribe();
      unsubscribeList();
      unsubscribeSync();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    conversationSocket.setIncludeAll(includeAll);
  }, [includeAll]);

  useEffect(() => {
    setDetailIndex(0);
  }, [detail?.id]);

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
      const msg = await conversationService.sendMessage(
        currentId,
        text,
        isAdmin ? { chatAsRole: chatPersona } : undefined
      );
      publishThread(currentId, [msg]);
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
  const orderDesignerUserId = members.find((m) => m.role === 'DESIGNER')?.accountId;
  const canSubmitDesignFromChat =
    currentOrderId != null && (user?.role === 'DESIGNER' || (isAdmin && chatPersona === 'DESIGNER'));

  const goOrderTask = () => {
    if (currentOrderId != null) navigate(`/orders/${currentOrderId}`);
  };

  const openDesignModal = () => {
    setDesignModalOpen(true);
  };

  const onDesignSubmitted = async () => {
    if (currentIdRef.current != null) {
      const msgs = await conversationService.getMessages(currentIdRef.current, includeAllRef.current);
      publishThread(currentIdRef.current, msgs);
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

  const showList = tier !== 'phone' || !threadOpen;
  const showThread = tier !== 'phone' || threadOpen;

  const closePhoneThread = () => {
    if (new URLSearchParams(location.search).get('c')) {
      navigate(-1);
      return;
    }
    setThreadOpen(false);
  };

  return (
    <div
      className={`chat-page chat-page--${tier}`}
      style={{
        display: 'flex',
        flex: 1,
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        width: '100%',
        background: '#fff',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid #f0f0f0',
      }}
    >
      <div
        className="chat-list"
        style={{
          width: tier === 'phone' ? '100%' : tier === 'tablet' ? 248 : 280,
          borderRight: showThread ? '1px solid #f0f0f0' : 'none',
          display: showList ? 'flex' : 'none',
          flexDirection: 'column',
          flexShrink: 0,
          height: '100%',
          minHeight: 0,
          minWidth: 0,
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
        <div className="chat-filters" style={{ display: 'flex', gap: 6, padding: '8px 12px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
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
        className="chat-thread"
        style={{
          flex: 1,
          display: showThread ? 'flex' : 'none',
          flexDirection: 'column',
          minWidth: 0,
          width: tier === 'phone' ? '100%' : undefined,
          height: '100%',
          minHeight: 0,
        }}
      >
        <div
          className="chat-thread__head"
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #f0f0f0',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            background: 'linear-gradient(180deg, #fff 0%, #fafafa 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '1 1 160px' }}>
            {tier === 'phone' && (
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={closePhoneThread}>
                会话
              </Button>
            )}
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
          <Space wrap className="chat-thread__actions" style={{ flex: tier === 'phone' ? '1 1 100%' : '1 1 auto', minWidth: 0, justifyContent: 'flex-end' }}>
            {currentOrderId != null && (
              <Button size="small" icon={<FileTextOutlined />} onClick={goOrderTask}>
                我的任务
              </Button>
            )}
            {canSubmitDesignFromChat && (
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
                        {isCraftReviewEvent(ev.eventType) && (
                          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8 }}>
                            {ev.eventType === 'REVIEW_REJECT'
                              ? '跟单工艺验证未通过，需按说明修改'
                              : '跟单工艺验证已通过'}
                          </div>
                        )}
                        {eventPreviewImages(ev.images, ev.eventType).length > 0 && (
                          <div style={{ position: 'relative', marginBottom: 8 }}>
                            <img
                              src={eventPreviewImages(ev.images, ev.eventType)[0]}
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
                            {eventPreviewImages(ev.images, ev.eventType).length > 1 && (
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
                                +{eventPreviewImages(ev.images, ev.eventType).length - 1}
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
                      {m.role === 'AI_ASSISTANT' ? renderRichText(m.content || '') : m.content}
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

        {isAdmin && currentId != null && (
          <div
            className="chat-persona"
            style={{
              padding: '8px 12px 0',
              borderTop: '1px solid #f0f0f0',
              flexShrink: 0,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
              发送身份
            </Text>
            <Segmented
              size="small"
              value={chatPersona}
              onChange={(v) => setChatPersona(v as AdminChatPersona)}
              options={[
                { label: '超级客服', value: 'SUPER_SERVICE' },
                { label: '设计师', value: 'DESIGNER' },
                { label: '建模师', value: 'MODELER' },
              ]}
            />
          </div>
        )}

        <div className="chat-composer" style={{ padding: 12, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
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
            style={{ flex: '1 1 140px', minWidth: 0 }}
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
        designerUserId={user?.role === 'DESIGNER' ? user?.id : orderDesignerUserId}
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
              {eventPreviewImages(ev.images, ev.eventType).length > 0 && (() => {
                const imgs = eventPreviewImages(ev.images, ev.eventType);
                const index = Math.min(detailIndex, imgs.length - 1);
                return (
                  <div style={{ position: 'relative', marginBottom: 14, background: '#f6f6f6', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={imgs[index]} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </div>
                    {imgs.length > 1 && (
                      <>
                        <Button
                          shape="circle"
                          style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }}
                          onClick={() => setDetailIndex((index - 1 + imgs.length) % imgs.length)}
                        >
                          ‹
                        </Button>
                        <Button
                          shape="circle"
                          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
                          onClick={() => setDetailIndex((index + 1) % imgs.length)}
                        >
                          ›
                        </Button>
                        <span style={{ position: 'absolute', right: 10, bottom: 8, background: 'rgba(0,0,0,.55)', color: '#fff', borderRadius: 99, fontSize: 12, padding: '2px 8px' }}>
                          {index + 1} / {imgs.length}
                        </span>
                      </>
                    )}
                  </div>
                );
              })()}
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
