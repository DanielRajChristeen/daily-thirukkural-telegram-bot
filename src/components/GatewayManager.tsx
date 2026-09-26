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
  Bot,
  Zap,
  Activity,
  ShieldCheck,
  Clock,
  Play,
  Server,
  CloudLightning,
  ChevronRight
} from 'lucide-react';
import { WebhookStatus } from '../types';

interface GatewayManagerProps {
  status: WebhookStatus | null;
  loading: boolean;
  onRefresh: () => void;
  onSetupWebhook: (customUrl?: string, secretToken?: string) => Promise<void>;
  onDeleteWebhook: () => Promise<void>;
  isBotStopped: boolean;
  onToggleBot: () => void;
}

const PRODUCTION_CLOUD_RUN_URL = 'https://ais-pre-mdmgkwte27m3mohqxzknen-325948981974.asia-east1.run.app';

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
  const [secretToken, setSecretToken] = useState('');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectResult, setReconnectResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestingScheduler, setIsTestingScheduler] = useState(false);
  const [schedulerTestResult, setSchedulerTestResult] = useState<{ 
    success: boolean; 
    message: string;
    details?: any;
  } | null>(null);

  useEffect(() => {
    onRefresh();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSetupWebhook(customUrl.trim() || undefined, secretToken.trim() || undefined);
    setCustomUrl('');
    setSecretToken('');
  };

  const handleManualReconnect = async () => {
    setIsReconnecting(true);
    setReconnectResult(null);
    try {
      const res = await fetch('/api/bot/reconnect', { method: 'POST' });
      const data = await res.json();
      setReconnectResult({
        success: data.success,
        message: data.message || (data.success ? 'Reconnected successfully!' : 'Reconnection failed.')
      });
      onRefresh();
    } catch (err: any) {
      setReconnectResult({
        success: false,
        message: err?.message || 'Network error executing reconnect.'
      });
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleTriggerSchedulerTick = async () => {
    setIsTestingScheduler(true);
    setSchedulerTestResult(null);
    try {
      const res = await fetch('/api/scheduler/tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSchedulerTestResult({
          success: true,
          message: `Scheduler tick executed successfully. Evaluated ${data.processedCount ?? 0} user(s), delivered ${data.deliveredCount ?? 0} reminder(s), skipped ${data.skippedCount ?? 0}.`,
          details: data
        });
      } else {
        setSchedulerTestResult({
          success: false,
          message: data.error || 'Scheduler tick execution returned error.',
          details: data
        });
      }
      onRefresh();
    } catch (err: any) {
      setSchedulerTestResult({
        success: false,
        message: err?.message || 'Failed to reach scheduler endpoint.'
      });
    } finally {
      setIsTestingScheduler(false);
    }
  };

  const defaultStatus: WebhookStatus = status || {
    hasToken: false,
    webhookActive: false,
    url: '',
    pendingUpdateCount: 0
  };

  const ws = defaultStatus;
  const botState = ws.botState;
  const schedulerTelemetry = ws.schedulerStatus;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="gateway_manager_panel">
      
      {/* LEFT PANEL: MAIN CONTROLS & STATUS (7 Columns) */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* TELEGRAM GATEWAY CONTROLLER CARD */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6" id="card_telegram_gateway">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Radio size={16} className="text-sky-500 animate-pulse" /> Telegram Gateway Controller
              </h2>
              <div className="flex items-center gap-2">
                <button 
                  id="btn_test_reconnect"
                  onClick={handleManualReconnect}
                  disabled={isReconnecting || loading}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  title="Test Telegram API connectivity"
                >
                  <Zap size={12} className={isReconnecting ? 'animate-bounce text-amber-500' : 'text-emerald-600'} />
                  {isReconnecting ? 'Testing...' : 'Test & Reconnect'}
                </button>
                <button 
                  id="btn_refresh_gateway"
                  onClick={onRefresh}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
            </div>

            {reconnectResult && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                reconnectResult.success 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {reconnectResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{reconnectResult.message}</span>
              </div>
            )}

            <p className="text-xs text-slate-500">
              Cloud Run operates with scale-to-zero CPU throttling. Production Webhooks wake the container instantly when users send Telegram messages.
            </p>

            {/* DYNAMIC METRIC STATUS BOX */}
            <div className={`p-5 rounded-2xl border ${
              ws.webhookActive 
                ? 'bg-emerald-50/50 border-emerald-100 text-slate-800' 
                : 'bg-amber-50/50 border-amber-100 text-slate-800'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block">Connection Mode:</span>
                  <span className="text-sm font-extrabold flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${ws.webhookActive ? 'bg-emerald-500 animate-pulse' : (botState?.isConnected ? 'bg-emerald-500' : 'bg-amber-400')}`}></span>
                    {ws.webhookActive 
                      ? 'INDEPENDENT PRODUCTION WEBHOOK' 
                      : (botState?.isConnected ? 'FALLBACK LONG-POLLING ENGINE' : 'OFFLINE / STOPPED')}
                  </span>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1">
                    {ws.webhookActive 
                      ? `Registered and alive. Telegram pushes updates straight to this Cloud container 24/7 without needing the dashboard open.`
                      : (botState?.isConnected
                        ? `Operating in fallback long-polling mode (@${botState.botInfo?.username || 'bot'}). For 24/7 background uptime, register the production Cloud Run webhook below.`
                        : `Bot engine is idle. Ensure TELEGRAM_BOT_TOKEN is configured in secrets.`)}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex flex-col gap-1 col-span-2 sm:col-span-1">
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Bot Identity</span>
                <span className="text-xs font-bold text-slate-800 truncate">
                  {botState?.botInfo?.username ? `@${botState.botInfo.username}` : '@daily_thirukkural_bot'}
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
                  <p className="text-[11px] text-slate-400">Temporarily pause or resume bot processing</p>
                </div>
                <button
                  id="btn_toggle_bot"
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
                <span className="text-xs text-slate-400">Revert back to fallback polling only during maintenance</span>
                <button
                  id="btn_delete_webhook"
                  onClick={onDeleteWebhook}
                  className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 hover:text-rose-900 font-bold px-4 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 size={14} /> Remove Webhook Registration
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3" id="form_register_webhook">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Production Webhook Endpoint URL</label>
                    <button
                      type="button"
                      onClick={() => setCustomUrl(PRODUCTION_CLOUD_RUN_URL)}
                      className="text-[11px] text-sky-600 hover:text-sky-700 font-semibold cursor-pointer underline"
                    >
                      Use Cloud Run Production URL
                    </button>
                  </div>
                  <input
                    id="input_webhook_url"
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder={PRODUCTION_CLOUD_RUN_URL}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition-all text-slate-800 placeholder:text-slate-400"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">Telegram Secret Token (Optional)</label>
                  <div className="flex gap-2">
                    <input
                      id="input_webhook_secret"
                      type="text"
                      value={secretToken}
                      onChange={(e) => setSecretToken(e.target.value)}
                      placeholder="X-Telegram-Bot-Api-Secret-Token (1-256 characters: A-Z, a-z, 0-9, _, -)"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition-all text-slate-800 placeholder:text-slate-400"
                    />
                    <button
                      id="btn_submit_webhook"
                      type="submit"
                      className="bg-slate-950 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Link size={14} /> Register Webhook
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  Note: The webhook must point to the public Cloud Run HTTPS URL. Telegram rejects URLs protected by browser cookie sessions.
                </p>
              </form>
            )}
          </div>
        </div>

        {/* CLOUD SCHEDULER HEALTH & TICK MONITOR CARD */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5" id="card_cloud_scheduler">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Clock size={16} className="text-emerald-600" /> Free Scheduler Telemetry & Ingress Triggers
            </h2>
            <button
              id="btn_trigger_scheduler_tick"
              onClick={handleTriggerSchedulerTick}
              disabled={isTestingScheduler}
              className="text-xs bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shadow-2xs"
            >
              <Play size={12} className={isTestingScheduler ? 'animate-spin' : ''} />
              {isTestingScheduler ? 'Dispatching...' : 'Test Scheduler Tick Now'}
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Accepts external HTTP pings (e.g. from any free web cron or uptime monitor) at <code>/api/scheduler/tick</code> or <code>/api/scheduler/daily-init</code> to wake Cloud Run and evaluate due reminder windows with atomic Firestore idempotency. Also runs opportunistically on Telegram webhook traffic and via local interval while active.
          </p>

          {schedulerTestResult && (
            <div className={`p-3.5 rounded-2xl text-xs space-y-1.5 ${
              schedulerTestResult.success 
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
                : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}>
              <div className="flex items-center gap-2 font-bold">
                {schedulerTestResult.success ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <AlertCircle size={16} className="text-rose-600 shrink-0" />}
                <span>{schedulerTestResult.message}</span>
              </div>
              {schedulerTestResult.details?.targetTime && (
                <p className="text-[11px] font-mono text-slate-600 pl-6">
                  Evaluated Time Slot: {schedulerTestResult.details.targetTime} (Asia/Kolkata)
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 font-bold uppercase block">Scheduler Status</span>
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                ACTIVE & LISTENING
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 font-bold uppercase block">Last Tick Processed</span>
              <span className="text-xs font-bold text-slate-800">
                {schedulerTelemetry?.lastTickTimestamp 
                  ? new Date(schedulerTelemetry.lastTickTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : 'Awaiting first tick'}
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 font-bold uppercase block">Trigger Origin</span>
              <span className="text-xs font-mono font-bold text-slate-700 truncate block">
                {schedulerTelemetry?.lastSource || 'local_interval'}
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 font-bold uppercase block">Server Uptime</span>
              <span className="text-xs font-bold text-slate-800">
                {schedulerTelemetry?.processUptimeSeconds !== undefined
                  ? `${Math.floor(schedulerTelemetry.processUptimeSeconds / 60)}m ${schedulerTelemetry.processUptimeSeconds % 60}s`
                  : 'Unknown'}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">Target Ingress Endpoint:</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                schedulerTelemetry?.isSecretConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {schedulerTelemetry?.isSecretConfigured ? '🛡️ X-Scheduler-Secret Configured' : 'Public Ingress'}
              </span>
            </div>
            <code className="text-[11px] text-slate-700 block font-mono break-all bg-white p-2 rounded-lg border border-slate-200">
              {schedulerTelemetry?.endpointUrl || `${PRODUCTION_CLOUD_RUN_URL}/api/scheduler/tick`}
            </code>
          </div>
        </div>

      </div>

      {/* RIGHT PANEL: ARCHITECTURE & DEPLOYMENT GUIDE (5 Columns) */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5" id="card_architecture_guide">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Server size={14} className="text-slate-500" /> Decoupled Architecture Guide
            </h3>
          </div>

          <div className="space-y-4 text-xs leading-relaxed text-slate-600">
            <div>
              <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <CloudLightning size={14} className="text-amber-500" /> Why the Bot Was Stopping
              </h4>
              <p>
                Google Cloud Run is serverless and throttles CPU to 0% when no HTTP requests are being processed. Traditional <code>setInterval</code> loops pause when no browser is visiting the dashboard.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" /> The Decoupled Production Fix
              </h4>
              <ul className="list-disc pl-4 space-y-1.5 mt-1 text-slate-600">
                <li>
                  <b>Telegram Webhooks:</b> Incoming user messages hit <code>/api/telegram-webhook</code>, instantly waking the container to respond.
                </li>
                <li>
                  <b>Cloud Scheduler:</b> Ticks <code>/api/scheduler/tick</code> every minute, waking the container to send due reminders.
                </li>
                <li>
                  <b>Atomic Firestore Idempotency:</b> Claims delivery leases in Firestore (<code>reminder_deliveries</code>) before sending to Telegram, preventing duplicate messages even with concurrent ticks.
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 mb-1 flex items-center justify-between">
                <span>Authoritative Firestore Persistence</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  ws.dbHealth?.firestoreConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {ws.dbHealth?.firestoreConnected ? 'Cloud Firestore Active' : 'Preserved Local State'}
                </span>
              </h4>
              <p>
                Subscribers, reminder preferences, activity logs, and delivery idempotency ledgers persist durably in Cloud Firestore.
              </p>
              {ws.dbHealth?.databaseId && (
                <p className="mt-1 text-[10px] font-mono text-slate-500">
                  Database ID: {ws.dbHealth.databaseId}
                </p>
              )}
            </div>
          </div>

          {/* Cloud Scheduler CLI Configuration Instructions */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2 text-xs">
            <span className="font-bold text-slate-800 text-[11px] block">Google Cloud Scheduler Setup Command:</span>
            <pre className="text-[10px] font-mono bg-slate-900 text-emerald-400 p-3 rounded-xl overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`gcloud scheduler jobs create http thirukkural-tick \\
  --schedule="* * * * *" \\
  --uri="${PRODUCTION_CLOUD_RUN_URL}/api/scheduler/tick" \\
  --http-method=POST \\
  --time-zone="Asia/Kolkata"`}
            </pre>
          </div>

          {/* Telegram Documentation Link */}
          <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📚</span>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-slate-800">Official Telegram API</span>
                <span className="text-[9px] text-slate-400">Webhooks & delivery reference</span>
              </div>
            </div>
            <a 
              href="https://core.telegram.org/bots/api#webhooks" 
              target="_blank" 
              referrerPolicy="no-referrer"
              className="text-[10px] bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-xs"
            >
              Read Docs <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
