export interface Conversation {
  id: number;
  orderId: number;
  orderNumber?: string;
  title?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  createdAt?: string;
}

export interface ConversationMember {
  id: number;
  accountType: string;
  accountId: number;
  role?: string;
  displayName?: string;
  lastReadMessageId?: number;
  joinedAt?: string;
}

export interface ConversationMessage {
  id: number;
  conversationId: number;
  senderType: string;
  senderId: number;
  role?: string;
  displayName?: string;
  msgType: string;
  content?: string;
  translatedContent?: string;
  translatedLang?: string;
  fileIds?: number[];
  eventId?: number;
  createdAt?: string;
}
