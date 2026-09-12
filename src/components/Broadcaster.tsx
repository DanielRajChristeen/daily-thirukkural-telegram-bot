import React, { useState } from 'react';
import { 
  Megaphone, 
  Send, 
  Eye, 
  HelpCircle, 
  AlertCircle,
  Loader2,
  CheckCircle2
} from 'lucide-react';

interface BroadcasterProps {
  onSendBroadcast: (text: string) => Promise<{ success: boolean; details?: { total: number; success: number; failed: number } }>;
}

export default function Broadcaster({ onSendBroadcast }: BroadcasterProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ total: number; success: number; failed: number } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;

    if (confirm(`Are you sure you want to broadcast this message to ALL subscribers? This action cannot be undone.`)) {
      setSending(true);
      setResult(null);
      try {
        const res = await onSendBroadcast(draft);
        if (res.success && res.details) {
          setResult(res.details);
          setDraft('');
        }
      } catch (e) {
        console.error('Failed to dispatch broadcast:', e);
      } finally {
        setSending(false);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="broadcaster_room">
      
      {/* LEFT PANEL: COMPOSER (7 Columns) */}
      <form onSubmit={handleSubmit} className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
              <Megaphone size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Administrator Broadcaster Room
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Draft announcements, festival verses, or special bulletins to all users
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Write your announcement below. The bot will dispatch this message to all subscribed users in the database using the official Telegram Bot API (or simulate the deliveries for test profiles).
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Announcement Draft Body</label>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write your broadcast text here... HTML formatting is supported (e.g., <b>bold</b>, <i>italic</i>, <code>code</code>)"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition-all text-slate-800 placeholder:text-slate-400 min-h-48"
              required
            />
          </div>

          {/* HTML HELP SHEETS */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-[10px] font-mono text-slate-500 flex justify-between gap-4">
            <span><b>&lt;b&gt;bold text&lt;/b&gt;</b></span>
            <span><i>&lt;i&gt;italic text&lt;/i&gt;</i></span>
            <span><code>&lt;code&gt;fixed-width&lt;/code&gt;</code></span>
            <span><a href="#" className="underline">&lt;a href="..."&gt;hyperlink&lt;/a&gt;</a></span>
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <div className="border-t border-slate-100 pt-5 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">Character length: <b>{draft.length} chars</b></span>
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className={`font-bold px-5 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm ${
              sending || !draft.trim()
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : 'bg-slate-950 hover:bg-slate-800 text-white'
            }`}
          >
            {sending ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Transmitting Broadcast...
              </>
            ) : (
              <>
                <Send size={13} /> Dispatch Global Broadcast
              </>
            )}
          </button>
        </div>
      </form>

      {/* RIGHT PANEL: LIVE TELEGRAM PREVIEW & RESULTS (5 Columns) */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        
        {/* PREVIEW CONTAINER */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex-1 flex flex-col gap-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
            <Eye size={14} className="text-slate-500" /> Telegram Message Live Preview
          </h3>

          <div className="flex-1 bg-slate-100/50 rounded-2xl border border-slate-150 p-4 relative overflow-hidden flex flex-col justify-end min-h-48">
            <div className="absolute top-0 right-0 p-3">
              <span className="text-[9px] bg-slate-200 text-slate-500 font-bold px-2 py-0.5 rounded-full">MOBILE ASPECT</span>
            </div>
            
            {/* Telegram simulated chat bubble */}
            <div className="bg-white border border-slate-150/60 p-3.5 rounded-2xl rounded-bl-none text-xs text-slate-800 shadow-xs max-w-[85%] self-start leading-relaxed relative">
              <div className="font-bold text-sky-600 text-[11px] mb-1">📢 ADMIN BROADCAST / அறிவிப்பு</div>
              {draft.trim() ? (
                <div 
                  className="whitespace-pre-wrap break-words" 
                  dangerouslySetInnerHTML={{ __html: draft }}
                />
              ) : (
                <span className="text-slate-400 italic">Start typing in the composition pane to see a real-time render...</span>
              )}
              <span className="text-[9px] text-slate-400 font-mono text-right block mt-2">12:00 PM</span>
            </div>
          </div>
        </div>

        {/* DISPATCH PROGRESS DETAILS CARD */}
        {result && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-emerald-600 shrink-0" size={18} />
              <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">Transmission Summary</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white border border-emerald-100/40 rounded-xl p-3">
                <span className="text-[9px] text-slate-400 font-mono font-bold uppercase block">Dispatched</span>
                <span className="text-lg font-extrabold text-slate-800 font-mono">{result.total}</span>
              </div>
              <div className="bg-white border border-emerald-100/40 rounded-xl p-3">
                <span className="text-[9px] text-emerald-600 font-mono font-bold uppercase block">Delivered</span>
                <span className="text-lg font-extrabold text-emerald-700 font-mono">{result.success}</span>
              </div>
              <div className="bg-white border border-emerald-100/40 rounded-xl p-3">
                <span className="text-[9px] text-rose-500 font-mono font-bold uppercase block">Failed</span>
                <span className="text-lg font-extrabold text-rose-700 font-mono">{result.failed}</span>
              </div>
            </div>

            <p className="text-[10px] text-emerald-800 leading-relaxed font-semibold">
              The broadcast has finished processing successfully! Test/Simulated subscriber records were immediately pushed to the simulated log panel.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
