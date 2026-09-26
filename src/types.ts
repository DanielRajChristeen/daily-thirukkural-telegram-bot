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

export interface TelegramBotState {
  isConnected: boolean;
  botInfo: { id: number; username: string; firstName: string } | null;
  mode: 'polling' | 'webhook' | 'stopped' | 'uninitialized';
  lastPollTimestamp: number;
  lastSuccessfulUpdateId: number;
  consecutiveErrors: number;
  lastErrorMessage: string | null;
  initAttempts: number;
}

export interface DbHealthStatus {
  isLoaded: boolean;
  provider: string;
  firestoreConnected: boolean;
  databaseId?: string;
  projectId?: string;
  subscriberCount: number;
  lastSaved: number;
  lastSuccessfulOp?: number;
  recentDbError?: string | null;
  dbFilePath: string;
  hasBackup: boolean;
}

export interface ReminderDeliveryRecord {
  id: string;
  date: string; // YYYY-MM-DD
  chatId: number;
  triggerTime: string;
  status: 'CLAIMED' | 'DELIVERED' | 'FAILED';
  claimedAt: number;
  deliveredAt?: number;
  lastAttemptAt: number;
  attempts: number;
  kuralNumber?: number;
  lastError?: string | null;
  telegramMessageId?: number;
}

export interface SchedulerStatus {
  lastTickTimestamp: number;
  lastTickTimeString: string;
  lastDeliveryTimestamp: number;
  todayDeliveriesCount: number;
  todayAttemptedCount: number;
  lastError: string | null;
  schedulerEndpoint: string;
  endpointUrl?: string;
  isSecretConfigured: boolean;
  lastSource?: string;
  lastEvaluatedCount?: number;
  lastNormalMatchesCount?: number;
  lastCatchUpMatchesCount?: number;
  lastClaimedCount?: number;
  lastSkippedCount?: number;
  serverBootTimestamp?: number;
  processUptimeSeconds?: number;
  lastHeartbeatTimestamp?: number;
  schedulerInitializedTimestamp?: number;
  isSchedulerActive?: boolean;
}

export interface WebhookStatus {
  hasToken: boolean;
  webhookActive: boolean;
  url: string;
  pendingUpdateCount: number;
  lastErrorDate?: number;
  lastErrorMessage?: string;
  botState?: TelegramBotState;
  dbHealth?: DbHealthStatus;
  schedulerStatus?: SchedulerStatus;
  isWebhookSecretConfigured?: boolean;
  productionServiceUrl?: string;
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
