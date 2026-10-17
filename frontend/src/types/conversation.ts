export interface Conversation {
  id: number;
  orderId: number;
  orderNumber?: string;
  title?: string;
  orderStatus?: string;
  orderStatusLabel?: string;
  serviceType?: string;
  serviceTypeLabel?: string;
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
  event?: OrderEventCard;
  createdAt?: string;
}

export interface OrderEventCard {
  id: number;
  orderId: number;
  eventType: string;
  actorType?: string;
  actorId?: number;
  actorRole?: string;
  actorName?: string;
  title?: string;
  content?: string;
  reason?: string;
  fileIds?: number[];
  images?: string[];
  actionable?: boolean;
  resolution?: string;
  resolutionLabel?: string;
  createdAt?: string;
}
