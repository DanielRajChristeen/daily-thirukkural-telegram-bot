import React, { useState, useEffect } from 'react';
import { 
  BookMarked,
  BarChart3, 
  Users, 
  Terminal, 
  Radio, 
  Megaphone, 
  Play, 
  BookOpen, 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  ExternalLink,
  LogOut,
  ShieldCheck,
  KeyRound,
  User
} from 'lucide-react';

// Sub-components
import AnalyticsHub from './components/AnalyticsHub';
import UserManager from './components/UserManager';
import ActivityLogs from './components/ActivityLogs';
import GatewayManager from './components/GatewayManager';
import Broadcaster from './components/Broadcaster';
import KuralExplorer from './components/KuralExplorer';
import BotPlayground from './components/BotPlayground';
import AdminAuthGate from './components/AdminAuthGate';
import ChangePasswordModal from './components/ChangePasswordModal';

// Shared Types
import { BotUser, ChatMessage, ActivityLog, WebhookStatus, AdminStats, AdminAuthUser } from './types';

export default function App() {
  // --- ADMIN AUTHENTICATION STATE (Username & Password) ---
  const [currentUser, setCurrentUser] = useState<AdminAuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('admin_auth_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.username === 'Admin') {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error restoring admin session:', e);
    }
    return null;
  });

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const handleSignOut = () => {
    localStorage.removeItem('admin_auth_user');
    setCurrentUser(null);
  };

  // --- TELEMETRY AND VIEW STATE ---
  const [activeTab, setActiveTab] = useState<'analytics' | 'users' | 'logs' | 'gateway' | 'broadcast' | 'playground' | 'explorer'>('analytics');
  
  const [isBotStopped, setIsBotStopped] = useState(false);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [subscribers, setSubscribers] = useState<BotUser[]>([]);
  
  const [logsAutoRefresh, setLogsAutoRefresh] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingWebhook, setLoadingWebhook] = useState(false);
  
  const [systemAlert, setSystemAlert] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const [dismissedAlerts, setDismissedAlerts] = useState<boolean>(false);

  // --- BOT SIMULATOR STATE ---
  const [simUser, setSimUser] = useState<BotUser>({
    chatId: 5164666817,
    username: 'Daniel_Raj_7',
    firstName: 'Daniel',
    language: 'both',
    triggerTime: '11:00:PM',
    lastActive: Date.now()
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isBotTyping, setIsBotTyping] = useState(false);

  // --- ALERT TRIGGER helper ---
  const triggerAlert = (message: string, type: 'success' | 'info' | 'error') => {
    setSystemAlert({ message, type });
    setTimeout(() => setSystemAlert(null), 5000);
  };

  // --- DATA ACQUISITION & SYNCHRONIZATION ---
  const fetchBotServiceStatus = async () => {
    try {
      const res = await fetch('/api/bot-status');
      if (res.ok) {
        const data = await res.json();
        setIsBotStopped(data.stopped);
      }
    } catch (err) {
      console.error('Failed to query bot status:', err);
    }
  };

  const fetchAdminStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('/api/admin-stats');
      if (res.ok) {
        const data = await res.json();
        setAdminStats(data);
      }
    } catch (err) {
      console.error('Failed to pull admin statistics:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchSubscribers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data: BotUser[] = await res.json();
        setSubscribers(data);
        
        // Sync our local simulator state representation with db record if it exists
        const currentSimRecord = data.find(u => u.chatId === simUser.chatId);
        if (currentSimRecord) {
          setSimUser(currentSimRecord);
        }
      }
    } catch (err) {
      console.error('Failed to pull subscribers directory:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchWebhookStatus = async () => {
    setLoadingWebhook(true);
    try {
      const res = await fetch('/api/webhook-status');
      if (res.ok) {
        const data = await res.json();
        setWebhookStatus(data);
      }
    } catch (err) {
      console.error('Failed to query Telegram API webhook status:', err);
    } finally {
      setLoadingWebhook(false);
    }
  };

  const fetchActivityLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/activity-logs');
      if (res.ok) {
        const data: ActivityLog[] = await res.json();
        
        // Dynamic detection of any new error logs
        setActivityLogs(prev => {
          const prevIds = new Set(prev.map(l => l.id));
          const newErrors = data.filter(l => l.status === 'error' && !prevIds.has(l.id));
          if (newErrors.length > 0) {
            setDismissedAlerts(false); // Make sure warning box shows up again
            const latestError = newErrors[0];
            triggerAlert(`⚠️ Error recorded: ${latestError.text}`, 'error');
          }
          return data;
        });
      }
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // --- CHRON POLLERS ---
  // Core startup fetch
  useEffect(() => {
    fetchBotServiceStatus();
    fetchAdminStats();
    fetchSubscribers();
    fetchWebhookStatus();
    fetchActivityLogs();
    initSimulatedChat();
  }, []);

  // Live polling for logs and stats
  useEffect(() => {
    if (!logsAutoRefresh) return;
    
    const interval = setInterval(() => {
      fetchActivityLogs();
      fetchAdminStats();
    }, 3000);

    return () => clearInterval(interval);
  }, [logsAutoRefresh]);

  // --- CONTROLLER DELEGATE ACTIONS ---
  
  // Toggle Bot service
  const handleToggleBotService = async () => {
    try {
      const res = await fetch('/api/bot-status/toggle', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setIsBotStopped(data.stopped);
        triggerAlert(
          data.stopped 
            ? '🛑 Bot service stopped successfully. Listeners paused.' 
            : '▶️ Bot service resumed successfully. Connection active.',
          data.stopped ? 'info' : 'success'
        );
        fetchAdminStats();
      }
    } catch (e) {
      triggerAlert('Failed to alter bot listener status', 'error');
    }
  };

  // Save/Update user profile preferences (called by UserManager)
  const handleUpdateSubscriber = async (chatId: number, updatedFields: Partial<BotUser>) => {
    try {
      const res = await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, ...updatedFields })
      });
      if (res.ok) {
        triggerAlert('Subscriber preferences updated successfully', 'success');
        fetchSubscribers();
        fetchAdminStats();
      } else {
        triggerAlert('Failed to save subscriber settings', 'error');
      }
    } catch (e) {
      triggerAlert('Network error saving subscriber settings', 'error');
    }
  };

  // Delete subscriber subscription (called by UserManager / simulator)
  const handleDeleteSubscriber = async (chatId: number) => {
    if (confirm(`Are you sure you want to unsubscribe and delete subscriber ID: ${chatId}?`)) {
      try {
        const res = await fetch(`/api/users/delete/${chatId}`, { method: 'POST' });
        if (res.ok) {
          triggerAlert('Subscriber removed successfully from registry', 'success');
          fetchSubscribers();
          fetchAdminStats();
          if (chatId === simUser.chatId) {
            initSimulatedChat();
          }
        } else {
          triggerAlert('Failed to delete subscriber record', 'error');
        }
      } catch (e) {
        triggerAlert('Network error executing user deletion', 'error');
      }
    }
  };

  // Setup Webhook URL (called by GatewayManager)
  const handleSetupWebhook = async (customUrl?: string) => {
    try {
      const res = await fetch('/api/webhook-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: customUrl })
      });
      const data = await res.json();
      if (res.ok) {
        triggerAlert(`🔗 Webhook successfully registered: ${data.url}`, 'success');
        fetchWebhookStatus();
        fetchActivityLogs();
      } else {
        triggerAlert(data.error || 'Failed to register webhook with Telegram', 'error');
      }
    } catch (e) {
      triggerAlert('Network error during webhook registration', 'error');
    }
  };

  // Clear/delete Webhook (revert to polling)
  const handleDeleteWebhook = async () => {
    try {
      const res = await fetch('/api/webhook-delete', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        triggerAlert('🧹 Webhook unregistered. Long-polling model restored.', 'success');
        fetchWebhookStatus();
        fetchActivityLogs();
      } else {
        triggerAlert(data.error || 'Failed to clear webhook registration', 'error');
      }
    } catch (e) {
      triggerAlert('Network error during webhook deletion', 'error');
    }
  };

  // Broadcast messages (called by Broadcaster)
  const handleSendBroadcast = async (text: string) => {
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (res.ok) {
        triggerAlert('📢 Announcement broadcast finished transmitting', 'success');
        fetchActivityLogs();
        fetchAdminStats();
        return { success: true, details: data.details };
      } else {
        triggerAlert(data.error || 'Broadcast execution failed', 'error');
        return { success: false };
      }
    } catch (e) {
      triggerAlert('Network error dispatching broadcast', 'error');
      return { success: false };
    }
  };

  // Clear transacted logs (called by ActivityLogs)
  const handleClearLogs = async () => {
    try {
      const res = await fetch('/api/activity-logs/clear', { method: 'POST' });
      if (res.ok) {
        triggerAlert('📝 Logs cache cleared successfully', 'success');
        fetchActivityLogs();
        fetchAdminStats();
      }
    } catch (e) {
      triggerAlert('Failed to clear activity logs', 'error');
    }
  };

  // --- BOT PLAYGROUND SIMULATION LOGIC ---
  const initSimulatedChat = () => {
    const formatTime = (date: Date): string => {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    
    setChatMessages([
      {
        id: 'init-1',
        sender: 'user',
        text: '/start',
        timestamp: formatTime(new Date(Date.now() - 30000))
      },
      {
        id: 'init-2',
        sender: 'bot',
        text: `வணக்கம்! Welcome to Daily Thirukkural Bot 🌸\n\nI will fetch and display a Thirukkural couplet with its explanation in Tamil, English, or both daily.\n\n<b>Your Current Settings:</b>\n🌐 Language: <b>BOTH</b>\n⏰ Daily Reminder: <b>06:00:AM</b>\n\nUse the buttons below to interact with me!`,
        timestamp: formatTime(new Date()),
        replyMarkup: {
          inline_keyboard: [
            [
              { text: "Daily Kural 📅", callback_data: "btn_daily" },
              { text: "Random Kural 🎲", callback_data: "btn_random" }
            ],
            [
              { text: "Search Kural 🔍", callback_data: "btn_search" }
            ],
            [
              { text: "Set Language 🌐", callback_data: "btn_lang_menu" },
              { text: "Set Reminder ⏰", callback_data: "btn_time_menu" }
            ]
          ]
        }
      }
    ]);
  };

  // Update simulator settings in DB on changes
  const handleUpdateSimUser = async (updatedFields: Partial<BotUser>) => {
    const nextSimUser = { ...simUser, ...updatedFields };
    setSimUser(nextSimUser);
    
    // Save updated simulator user immediately to database so they show up in subscriber list
    try {
      await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: simUser.chatId,
          username: nextSimUser.username,
          firstName: nextSimUser.firstName,
          language: nextSimUser.language,
          triggerTime: nextSimUser.triggerTime
        })
      });
      fetchSubscribers();
      fetchAdminStats();
    } catch (e) {
      console.error('Failed to sync simulator user:', e);
    }
  };

  const triggerSimulation = async (text?: string, callbackData?: string) => {
    if (isBotStopped) {
      triggerAlert('⚠️ Bot service is paused. Enable the service in the gateway tab or header first!', 'error');
      return;
    }

    setIsBotTyping(true);
    await new Promise(r => setTimeout(r, 600)); // typing delay

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: simUser.chatId,
          username: simUser.username,
          firstName: simUser.firstName,
          text,
          callbackData
        })
      });

      if (res.status === 503) {
        triggerAlert('⚠️ Bot service is paused. Enable the service first!', 'error');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        const botResponse = data.response;

        const formatTime = (date: Date): string => {
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };

        const newMsg: ChatMessage = {
          id: Math.random().toString(),
          sender: 'bot',
          text: botResponse.text,
          timestamp: formatTime(new Date()),
          replyMarkup: botResponse.replyMarkup
        };

        setChatMessages(prev => [...prev, newMsg]);
        fetchSubscribers();
        fetchActivityLogs();
        fetchAdminStats();
      }
    } catch (err) {
      console.error('Simulator network failure:', err);
    } finally {
      setIsBotTyping(false);
    }
  };

  const handleSimSendMessage = (text: string) => {
    const formatTime = (date: Date): string => {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: 'user',
      text,
      timestamp: formatTime(new Date())
    };

    setChatMessages(prev => [...prev, userMsg]);
    triggerSimulation(text);
  };

  const handleSimSendCallback = (callbackData: string, buttonText: string) => {
    const formatTime = (date: Date): string => {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: 'user',
      text: `[Clicked Button: ${buttonText}]`,
      timestamp: formatTime(new Date())
    };

    setChatMessages(prev => [...prev, userMsg]);
    triggerSimulation(undefined, callbackData);
  };

  // If unauthenticated, gate the entire admin dashboard behind Google Sign-In
  if (!currentUser) {
    return (
      <AdminAuthGate 
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          triggerAlert(`Admin access granted. Welcome, ${user.username}!`, 'success');
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased" id="dashboard_root">
      
      {/* SYSTEM DYNAMIC ALERTS */}
      {systemAlert && (
        <div className={`fixed top-5 right-5 z-50 p-4 rounded-2xl shadow-xl flex items-center gap-3 max-w-sm transition-all duration-300 animate-slideIn ${
          systemAlert.type === 'success' ? 'bg-slate-900 text-white border border-slate-800' : 
          systemAlert.type === 'error' ? 'bg-rose-950 text-rose-200 border border-rose-800' : 
          'bg-indigo-950 text-indigo-200 border border-indigo-800'
        }`} id="system_alert_banner">
          <AlertCircle size={18} className={systemAlert.type === 'success' ? 'text-emerald-400' : 'text-amber-400'} />
          <p className="font-semibold text-xs leading-relaxed">{systemAlert.message}</p>
        </div>
      )}

      {/* DASHBOARD MASTER HEADER */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-45 px-4 lg:px-8 py-3.5 shadow-xs" id="dashboard_top_bar">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-950 text-white rounded-xl shadow-xs">
              <BookMarked size={22} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-slate-900 flex items-center gap-2 uppercase">
                Thirukkural admin dashboard
              </h1>
              <p className="text-[10px] text-indigo-600 font-mono tracking-wider uppercase font-bold">
                Daily Couplets Telegram Bot Command Hub
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Authenticated Administrator Profile Badge & Controls */}
            <div className="flex items-center gap-2 bg-slate-900 text-white pl-3 pr-2 py-1.5 rounded-xl shadow-xs border border-slate-800" id="header_admin_badge">
              <div className="w-6 h-6 rounded-full bg-sky-500 flex items-center justify-center text-[11px] font-black text-white uppercase shadow-inner">
                A
              </div>
              <div className="hidden sm:flex flex-col text-left mr-1">
                <span className="text-[10px] font-bold leading-tight flex items-center gap-1 text-sky-400">
                  <ShieldCheck size={11} className="text-sky-400" />
                  <span>Admin</span>
                </span>
                <span className="text-[10px] font-mono text-slate-300 leading-none">
                  {currentUser.username}
                </span>
              </div>

              {/* Change Password Button */}
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(true)}
                title="Change Admin Password"
                className="flex items-center gap-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer border border-slate-700"
                id="header_change_password_btn"
              >
                <KeyRound size={12} className="text-sky-400" />
                <span className="hidden md:inline">Change Password</span>
              </button>

              {/* Sign Out Button */}
              <button
                type="button"
                onClick={handleSignOut}
                title="Sign out of Admin Dashboard"
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                id="admin_signout_btn"
              >
                <LogOut size={14} />
              </button>
            </div>

            {/* Real-time status badge */}
            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-150 rounded-xl px-3 py-1.5" id="header_status_badge">
              <span className={`h-2 w-2 rounded-full ${isBotStopped ? 'bg-rose-500' : (webhookStatus?.webhookActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400')}`}></span>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                {isBotStopped ? 'SERVICE STOPPED' : (webhookStatus?.webhookActive ? 'WEBHOOK ONLINE' : 'LONG-POLLING')}
              </span>
            </div>

            {/* Quick stop toggle button */}
            <button
              onClick={handleToggleBotService}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                isBotStopped 
                  ? 'bg-rose-50 border-rose-100 text-rose-700 hover:bg-rose-100' 
                  : 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
              }`}
              id="header_toggle_btn"
            >
              {isBotStopped ? '▶️ Restart Service' : '🛑 Stop Bot'}
            </button>

            <a 
              href="https://t.me/daily_thirukkural_bot" 
              target="_blank" 
              referrerPolicy="no-referrer"
              className="flex items-center gap-1.5 text-[11px] bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-colors px-3 py-1.5 rounded-lg font-bold cursor-pointer"
            >
              Telegram <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </header>

      {/* DUAL MODE PRIMARY NAVIGATION TAB BAR */}
      <div className="bg-white border-b border-slate-200 sticky top-[65px] z-40" id="tabs_navigation">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <nav className="flex gap-2 py-2 overflow-x-auto scrollbar-none" aria-label="Tabs">
            {[
              { id: 'analytics', label: '📊 Analytics Hub' },
              { id: 'users', label: '👥 Subscribers Directory' },
              { id: 'logs', label: '📝 Gateway Logs' },
              { id: 'gateway', label: '🔗 Webhook Settings' },
              { id: 'broadcast', label: '📢 Broadcaster Room' },
              { id: 'playground', label: '🛋️ Dev Playground' },
              { id: 'explorer', label: '📖 Kural Library' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id === 'logs') fetchActivityLogs();
                  if (tab.id === 'users') fetchSubscribers();
                  if (tab.id === 'gateway') fetchWebhookStatus();
                  if (tab.id === 'analytics') fetchAdminStats();
                }}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id 
                    ? 'bg-slate-950 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* DASHBOARD LAYOUT SPACE */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-8" id="dashboard_body_frame">
        
        {/* PERSISTENT SYSTEM ERROR NOTIFICATION BOX */}
        {activityLogs.filter(log => log.status === 'error').length > 0 && !dismissedAlerts && (
          <div className="mb-6 bg-rose-50 border border-rose-200 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row items-start justify-between gap-4 animate-slideIn" id="dashboard_system_errors_notification">
            <div className="flex gap-3">
              <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl shrink-0">
                <AlertCircle size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-rose-950 flex items-center gap-2">
                  System Warnings & Conflict Alerts ({activityLogs.filter(log => log.status === 'error').length})
                </h3>
                <p className="text-xs text-rose-800 font-semibold">
                  We detected {activityLogs.filter(log => log.status === 'error').length} recent system issue(s) in the log registry. This may indicate an API key error, database problem, AI retrieval issue, or a webhook conflict (409) with another bot instance:
                </p>
                <div className="mt-2.5 space-y-1.5 max-h-40 overflow-y-auto pr-2">
                  {activityLogs.filter(log => log.status === 'error').slice(0, 3).map((log) => (
                    <div key={log.id} className="text-[11px] font-mono text-rose-900 bg-white/65 px-3 py-1.5 rounded-lg border border-rose-100/60 flex items-start gap-2 leading-relaxed">
                      <span className="text-[9px] bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded shrink-0 font-bold">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="break-all">{log.text}</span>
                    </div>
                  ))}
                  {activityLogs.filter(log => log.status === 'error').length > 3 && (
                    <p className="text-[10px] text-rose-600 font-bold italic pl-1">
                      + {activityLogs.filter(log => log.status === 'error').length - 3} more errors.
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex md:flex-col gap-2 shrink-0 w-full md:w-auto">
              <button
                onClick={() => {
                  setActiveTab('logs');
                  fetchActivityLogs();
                }}
                className="flex-1 md:flex-none text-center bg-rose-950 hover:bg-rose-900 text-white font-bold text-[11px] px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                Inspect Full Logs
              </button>
              <button
                onClick={() => setDismissedAlerts(true)}
                className="flex-1 md:flex-none text-center bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[11px] px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                Dismiss Alert
              </button>
            </div>
          </div>
        )}
        {activeTab === 'analytics' && (
          <AnalyticsHub 
            stats={adminStats} 
            loading={loadingStats} 
            onRefresh={fetchAdminStats} 
          />
        )}

        {activeTab === 'users' && (
          <UserManager 
            users={subscribers} 
            onDeleteUser={handleDeleteSubscriber} 
            onUpdateUser={handleUpdateSubscriber}
            onRefresh={fetchSubscribers}
            loading={loadingUsers} 
          />
        )}

        {activeTab === 'logs' && (
          <ActivityLogs 
            logs={activityLogs} 
            loading={loadingLogs} 
            onRefresh={fetchActivityLogs} 
            onClear={handleClearLogs} 
            autoRefresh={logsAutoRefresh}
            onToggleAutoRefresh={() => setLogsAutoRefresh(!logsAutoRefresh)}
          />
        )}

        {activeTab === 'gateway' && (
          <GatewayManager 
            status={webhookStatus} 
            loading={loadingWebhook} 
            onRefresh={fetchWebhookStatus} 
            onSetupWebhook={handleSetupWebhook} 
            onDeleteWebhook={handleDeleteWebhook}
            isBotStopped={isBotStopped}
            onToggleBot={handleToggleBotService}
          />
        )}

        {activeTab === 'broadcast' && (
          <Broadcaster 
            onSendBroadcast={handleSendBroadcast} 
          />
        )}

        {activeTab === 'playground' && (
          <BotPlayground 
            simUser={simUser} 
            onChangeSimUser={handleUpdateSimUser}
            chatMessages={chatMessages} 
            onSendMessage={handleSimSendMessage} 
            onSendCallback={handleSimSendCallback}
            isBotTyping={isBotTyping} 
            onResetChat={initSimulatedChat}
            isBotStopped={isBotStopped}
          />
        )}

        {activeTab === 'explorer' && (
          <KuralExplorer />
        )}

      </main>

      {/* VISUAL HUSBANDRY PAGE FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 shrink-0">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p className="font-medium">
            Daily Thirukkural Companion Dashboard • Built with React & Express
          </p>
          <div className="flex items-center gap-3">
            <span className="font-mono bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 rounded-lg">
              UTC: {new Date().toISOString().substring(11, 19)}
            </span>
            <span className="font-bold text-slate-500">
              Aram, Porul, Inbam 🌸
            </span>
          </div>
        </div>
      </footer>

      {/* CHANGE PASSWORD MODAL */}
      <ChangePasswordModal 
        isOpen={isChangePasswordOpen} 
        onClose={() => setIsChangePasswordOpen(false)} 
      />

    </div>
  );
}
