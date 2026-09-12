export interface BotUser {
  chatId: number;
  username?: string;
  firstName?: string;
  language: 'tamil' | 'english' | 'both';
  triggerTime: string; // '08:00', '12:00', '18:00', '21:00', 'none', or custom e.g. '04:30:PM'
  lastActive: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  replyMarkup?: {
    inline_keyboard?: Array<Array<{ 
      text: string; 
      callback_data?: string; 
      url?: string; 
      web_app?: { url: string };
    }>>;
  };
}

export interface ActivityLog {
  id: string;
  timestamp: number;
  chatId: number;
  username?: string;
  type: 'incoming' | 'outgoing' | 'system';
  text: string;
  status: 'success' | 'error' | 'info';
}

export interface WebhookStatus {
  hasToken: boolean;
  webhookActive: boolean;
  url: string;
  pendingUpdateCount: number;
  lastErrorDate?: number;
  lastErrorMessage?: string;
}

export interface AdminStats {
  totalUsers: number;
  languages: {
    tamil: number;
    english: number;
    both: number;
  };
  reminders: Record<string, number>;
  activity: {
    incoming: number;
    outgoing: number;
    system: number;
    total: number;
  };
}

export interface AdminAuthUser {
  username: string;
  signedInAt: number;
}
