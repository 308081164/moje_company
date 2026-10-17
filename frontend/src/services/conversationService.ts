import api from './api';
import { Conversation, ConversationMember, ConversationMessage } from '@/types/conversation';

export const conversationService = {
  async listConversations(): Promise<Conversation[]> {
    return api.get<Conversation[]>('/conversations');
  },

  async ensureByOrder(orderId: number): Promise<Conversation> {
    return api.post<Conversation>(`/conversations/by-order/${orderId}`);
  },

  async getMessages(conversationId: number, includeAll: boolean = false): Promise<ConversationMessage[]> {
    return api.get<ConversationMessage[]>(
      `/conversations/${conversationId}/messages?includeAll=${includeAll}`
    );
  },

  async getMembers(conversationId: number): Promise<ConversationMember[]> {
    return api.get<ConversationMember[]>(`/conversations/${conversationId}/members`);
  },

  async sendMessage(conversationId: number, content: string): Promise<ConversationMessage> {
    return api.post<ConversationMessage>(`/conversations/${conversationId}/messages`, {
      content,
      msgType: 'text',
    });
  },

  async markRead(conversationId: number): Promise<void> {
    return api.post<void>(`/conversations/${conversationId}/read`, {});
  },

  async translateMessage(messageId: number, targetLang: string): Promise<ConversationMessage> {
    return api.post<ConversationMessage>(`/conversations/messages/${messageId}/translate`, { targetLang });
  },
};
