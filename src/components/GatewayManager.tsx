import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Settings, 
  HelpCircle, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Link, 
  Trash2,
  Lock,
  ExternalLink,
  Bot
} from 'lucide-react';
import { WebhookStatus } from '../types';

interface GatewayManagerProps {
  status: WebhookStatus | null;
  loading: boolean;
  onRefresh: () => void;
  onSetupWebhook: (customUrl?: string) => Promise<void>;
  onDeleteWebhook: () => Promise<void>;
  isBotStopped: boolean;
  onToggleBot: () => void;
}

export default function GatewayManager({
  status,
  loading,
  onRefresh,
  onSetupWebhook,
  onDeleteWebhook,
  isBotStopped,
  onToggleBot
}: GatewayManagerProps) {
  const [customUrl, setCustomUrl] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    onRefresh();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSetupWebhook(customUrl.trim() || undefined);
    setCustomUrl('');
  };

  const defaultStatus: WebhookStatus = status || {
    hasToken: false,
    webhookActive: false,
    url: '',
    pendingUpdateCount: 0
  };

  const ws = defaultStatus;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="gateway_manager_panel">
      
      {/* LEFT PANEL: MAIN CONTROLS & STATUS (7 Columns) */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Radio size={16} className="text-sky-500 animate-pulse" /> Telegram Gateway Controller
            </h2>
            <button 
              onClick={onRefresh}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Query Telegram API
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Configure the webhook connector. Webhooks stream Telegram updates in real-time to this server, enabling the bot to run independently of this browser window!
          </p>

          {/* DYNAMIC METRIC STATUS BOX */}
          <div className={`p-5 rounded-2xl border ${
            ws.webhookActive 
              ? 'bg-emerald-50/50 border-emerald-100 text-slate-800' 
              : 'bg-amber-50/50 border-amber-100 text-slate-800'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block">Status Connection Type:</span>
                <span className="text-sm font-extrabold flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${ws.webhookActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
                  {ws.webhookActive ? 'INDEPENDENT REAL-TIME WEBHOOK' : 'LONG-POLLING / LOCAL SIMULATION'}
                </span>
                <p className="text-xs text-slate-500 leading-relaxed mt-1">
                  {ws.webhookActive 
                    ? `Active and registered. Telegram pushes updates straight to this Cloud container.`
                    : `Polling is active. The system fetches messages sequentially, or runs in developer companion mode.`}
                </p>
              </div>
              <span className="text-2xl">{ws.webhookActive ? '⚡' : '🔄'}</span>
            </div>

            {ws.webhookActive && (
              <div className="mt-4 pt-4 border-t border-emerald-100/60 flex flex-col gap-1 text-xs">
                <span className="text-[10px] text-emerald-800 font-mono font-bold uppercase">Registered Endpoint URI:</span>
                <span className="font-mono text-slate-600 bg-white border border-emerald-100/40 p-2 rounded-lg truncate block text-[11px] font-semibold" title={ws.url}>
                  {ws.url}
                </span>
              </div>
            )}
          </div>

          {/* TELEGRAM API DETAILS GRID */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex flex-col gap-1">
              <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Pending updates queue</span>
              <span className="text-base font-extrabold text-slate-800 font-mono">{ws.pendingUpdateCount} msg</span>
            </div>
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex flex-col gap-1">
              <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">API Token Status</span>
              <span className={`text-xs font-bold ${ws.hasToken ? 'text-emerald-700' : 'text-rose-600'}`}>
                {ws.hasToken ? '🔑 CONFIGURED' : '❌ MISSING IN .env'}
              </span>
            </div>
          </div>

          {/* BOT COUPLER GOVERNING SWITCH */}
          <div className="border-t border-slate-100 pt-5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
              Service Master Control
            </h3>
            <div className="flex items-center justify-between bg-slate-50 p-4 border border-slate-150 rounded-2xl">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-800">Bot Listener Switch</span>
                <p className="text-[11px] text-slate-400">Temporarily block or activate polling loops & webhook processors</p>
              </div>
              <button
                onClick={onToggleBot}
                className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer ${
                  isBotStopped 
                    ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {isBotStopped ? '▶️ Resume Bot Service' : '🛑 Pause Bot Service'}
              </button>
            </div>
          </div>
        </div>

        {/* WEBHOOK REGISTER / DISREGARD FORM */}
        <div className="border-t border-slate-100 pt-5">
          {ws.webhookActive ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Revert back to long polling if needed</span>
              <button
                onClick={onDeleteWebhook}
                className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 hover:text-rose-900 font-bold px-4 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={14} /> Remove Webhook Registration
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">Set Webhook Connection Endpoint URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="Auto-detect deployment URL (Leave blank to generate)"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition-all text-slate-800 placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    className="bg-slate-950 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Link size={14} /> Register Webhook
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                Tip: Leaving this field blank is the safest choice! The server will automatically detect its current container ingress and compile the correct webhook path securely.
              </p>
            </form>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: WEBHOOK KNOWLEDGE BASE & TUTORIALS (5 Columns) */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <HelpCircle size={14} className="text-slate-500" /> Webhook Architectural Guide
            </h3>
          </div>

          <div className="space-y-4 text-xs leading-relaxed text-slate-600">
            <div>
              <h4 className="font-bold text-slate-800 mb-1">🤔 What does independent webhook mean?</h4>
              <p>
                By default, a Telegram Bot uses <b>Long Polling</b>. In Polling, the Express server asks Telegram every second if there are new messages. If this browser tab is closed, the container can sleep, or the polling loop could slow down.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 mb-1">🚀 Why is a Webhook better?</h4>
              <p>
                A Webhook reverses the flow. Instead of polling, Telegram immediately sends an HTTP POST request to this server's endpoint: <code>/api/telegram-webhook</code> the millisecond a user texts your bot! This makes dispatches <b>100% instant</b> and allows the bot to work flawlessly <b>forever</b> without needing you to open this page.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 mb-1">🔒 SSL / TLS Requirement</h4>
              <p>
                Telegram mandates that all webhook endpoints use an encrypted connection (<b>HTTPS</b>). Our Cloud Run ingress already manages HTTPS SSL configurations automatically, so your webhooks will bind securely without extra tools!
              </p>
            </div>
          </div>
        </div>

        {/* Telegram Official Documentation Link */}
        <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📚</span>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-800">Official Telegram API</span>
              <span className="text-[9px] text-slate-400">Webhooks & updates reference</span>
            </div>
          </div>
          <a 
            href="https://core.telegram.org/bots/api#webhooks" 
            target="_blank" 
            referrerPolicy="no-referrer"
            className="text-[10px] bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-xs"
          >
            Read Guide <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </div>
  );
}
