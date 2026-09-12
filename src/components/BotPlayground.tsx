import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  RefreshCw, 
  User, 
  Clock, 
  Globe 
} from 'lucide-react';
import { BotUser, ChatMessage } from '../types';

interface BotPlaygroundProps {
  simUser: BotUser;
  onChangeSimUser: (updated: Partial<BotUser>) => void;
  chatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onSendCallback: (callbackData: string, buttonText: string) => void;
  isBotTyping: boolean;
  onResetChat: () => void;
  isBotStopped: boolean;
}

export default function BotPlayground({
  simUser,
  onChangeSimUser,
  chatMessages,
  onSendMessage,
  onSendCallback,
  isBotTyping,
  onResetChat,
  isBotStopped
}: BotPlaygroundProps) {
  const [input, setInput] = useState('');
  const [showFlaskPickerModal, setShowFlaskPickerModal] = useState(false);
  const [flaskPickerUrl, setFlaskPickerUrl] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Convert "HH:MM:AM/PM" to "HH:MM" (24h)
  const to24h = (triggerTime: string): string => {
    if (!triggerTime || triggerTime === 'none') return '07:00';
    const parts = triggerTime.split(':');
    if (parts.length >= 3) {
      let h = parseInt(parts[0], 10) || 7;
      const m = parts[1] || '00';
      const ap = (parts[2] || 'AM').toUpperCase();
      if (ap === 'PM' && h < 12) h += 12;
      if (ap === 'AM' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${m}`;
    }
    return '07:00';
  };

  // Convert "HH:MM" (24h) to "HH:MM:AM/PM"
  const to12h = (time24: string): string => {
    if (!time24) return 'none';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, '0')}:${m}:${ap}`;
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isBotTyping]);

  // Listen for real-time postMessage events from the Visual Time Picker iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'TIME_PICKER_SAVED') {
        const { chatId, triggerTime } = e.data;
        if (chatId === simUser.chatId) {
          onChangeSimUser({ ...simUser, triggerTime });
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [simUser, onChangeSimUser]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="bot_playground">
      
      {/* LEFT COLUMN: SIMULATED USER CONFIGURATION (4 Columns) */}
      <section className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between gap-6">
        <div className="space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <User size={14} className="text-indigo-600" /> Simulated Persona Setup
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Customize your simulated profile characteristics</p>
          </div>

          <div className="space-y-4">
            {/* User ID (chatId) */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Simulated Chat ID</span>
              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-3 py-2 rounded-xl border border-slate-150 block">
                {simUser.chatId}
              </span>
            </div>

            {/* Persona First Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">First Name</label>
              <input
                type="text"
                value={simUser.firstName || ''}
                onChange={(e) => onChangeSimUser({ firstName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition-all text-slate-800"
              />
            </div>

            {/* Persona Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Telegram Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">@</span>
                <input
                  type="text"
                  value={simUser.username || ''}
                  onChange={(e) => onChangeSimUser({ username: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-6 pr-3 py-2 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition-all text-slate-800"
                />
              </div>
            </div>

            {/* Language Preference */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Preferred Script Language</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['tamil', 'english', 'both'] as const).map(lang => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => onChangeSimUser({ language: lang })}
                    className={`px-2 py-2 text-[10px] font-bold rounded-xl border transition-all capitalize cursor-pointer ${
                      simUser.language === lang 
                        ? 'bg-slate-950 text-white border-slate-950 shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Reminder timing (Customized Time Always) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Custom Reminder Schedule</label>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  simUser.triggerTime === 'none' 
                    ? 'bg-slate-100 text-slate-500' 
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}>
                  {simUser.triggerTime === 'none' ? 'OFF' : simUser.triggerTime.replace(':', ' ').replace(':', ' ')}
                </span>
              </div>

              {/* Native custom time input */}
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  disabled={simUser.triggerTime === 'none'}
                  value={to24h(simUser.triggerTime)}
                  onChange={(e) => {
                    const new12 = to12h(e.target.value);
                    onChangeSimUser({ triggerTime: new12 });
                  }}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-slate-900 disabled:opacity-50"
                />

                <button
                  type="button"
                  onClick={() => {
                    if (simUser.triggerTime === 'none') {
                      onChangeSimUser({ triggerTime: '07:00:AM' });
                    } else {
                      onChangeSimUser({ triggerTime: 'none' });
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    simUser.triggerTime === 'none'
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {simUser.triggerTime === 'none' ? 'Enable' : 'Disable'}
                </button>
              </div>

              {/* Direct Link to Flask UI Time Picker */}
              <button
                type="button"
                onClick={() => {
                  setFlaskPickerUrl(`/time-picker?chatId=${simUser.chatId}&time=${encodeURIComponent(simUser.triggerTime || '07:00:AM')}`);
                  setShowFlaskPickerModal(true);
                }}
                className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs py-2 px-3 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <span>📱</span>
                <span>Open Visual Flask UI Picker</span>
              </button>
            </div>
          </div>
        </div>

        {/* HELP GUIDE BOX */}
        <div className="bg-slate-50 p-4 border border-slate-100 rounded-2xl">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            ✏️ Changing attributes here live updates this simulator's backend record. Type commands inside the chat box such as <code>/start</code>, <code>/kural</code>, or click inline buttons below.
          </p>
        </div>
      </section>

      {/* RIGHT COLUMN: INTERACTIVE TELEGRAM CLIENT SIMULATOR (8 Columns) */}
      <section className="lg:col-span-8 flex flex-col">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl flex flex-col h-[520px] shadow-lg relative overflow-hidden">
          
          {/* Header */}
          <div className="bg-slate-950/80 border-b border-slate-800 px-4 py-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center font-bold text-sm shadow-sm">
                🪔
              </div>
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  Thirukkural Companion Bot <Bot size={13} className="text-amber-400" />
                </h3>
                <p className="text-[10px] text-slate-400">
                  online • development simulated client
                </p>
              </div>
            </div>
            <button 
              onClick={onResetChat}
              className="text-[10px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-2.5 py-1 font-bold transition-all cursor-pointer"
            >
              Reset Chat
            </button>
          </div>

          {/* Persona Header bar */}
          <div className="bg-slate-950 px-4 py-1.5 flex items-center justify-between border-b border-slate-800/40 shrink-0">
            <span className="text-[10px] font-mono text-slate-400">
              Active Session: <b>{simUser.firstName}</b> ({simUser.chatId})
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded uppercase">
                Lang: {simUser.language}
              </span>
              <span className="text-[9px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded">
                ⏰ {simUser.triggerTime === 'none' ? 'OFF' : simUser.triggerTime}
              </span>
            </div>
          </div>

          {/* CHAT BUBBLES SCROLLER */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/30">
            {chatMessages.map(msg => (
              <div 
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
              >
                {/* Text body */}
                <div 
                  className={`p-3 rounded-2xl text-xs leading-relaxed break-words ${
                    msg.sender === 'user' 
                      ? 'bg-slate-800 text-slate-100 rounded-tr-none border border-slate-700' 
                      : 'bg-slate-900 text-slate-100 rounded-tl-none border border-slate-800'
                  }`}
                  dangerouslySetInnerHTML={{ __html: msg.text }}
                />
                
                {/* Meta details */}
                <span className="text-[9px] text-slate-500 mt-1 font-mono">{msg.timestamp}</span>

                {/* Inline callback keyboards */}
                {msg.sender === 'bot' && msg.replyMarkup?.inline_keyboard && (
                  <div className="grid grid-cols-1 gap-1.5 mt-2.5 w-full">
                    {msg.replyMarkup.inline_keyboard.map((row, rIdx) => (
                      <div key={rIdx} className="flex gap-1.5 flex-wrap">
                        {row.map((btn, bIdx) => {
                          const isWebAppOrUrl = !!(btn.web_app?.url || btn.url);
                          const isFlaskTrigger = btn.callback_data?.startsWith('open_flask_ui_') || 
                                                 btn.text.toLowerCase().includes('time picker') || 
                                                 btn.text.toLowerCase().includes('flask ui');

                          return (
                            <button
                              key={bIdx}
                              onClick={() => {
                                if (isFlaskTrigger || isWebAppOrUrl) {
                                  const pickerUrl = `/time-picker?chatId=${simUser.chatId}&time=${encodeURIComponent(simUser.triggerTime || '07:00:AM')}`;
                                  setFlaskPickerUrl(pickerUrl);
                                  setShowFlaskPickerModal(true);
                                } else if (btn.callback_data) {
                                  onSendCallback(btn.callback_data, btn.text);
                                }
                              }}
                              className={`text-[10px] font-semibold border rounded-xl px-3 py-2 transition-all cursor-pointer ${
                                isWebAppOrUrl || isFlaskTrigger
                                  ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40 font-bold shadow-xs'
                                  : 'bg-slate-800 hover:bg-slate-750 text-sky-400 border-slate-700/80'
                              }`}
                            >
                              {btn.text}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Typing status bubble */}
            {isBotTyping && (
              <div className="mr-auto items-start max-w-[85%] flex flex-col gap-1.5">
                <div className="p-3 bg-slate-900 text-slate-400 rounded-2xl rounded-tl-none border border-slate-800 text-xs flex items-center gap-1.5 font-mono">
                  <span className="h-1.5 w-1.5 bg-slate-500 rounded-full animate-bounce"></span>
                  <span className="h-1.5 w-1.5 bg-slate-500 rounded-full animate-bounce delay-150"></span>
                  <span className="h-1.5 w-1.5 bg-slate-500 rounded-full animate-bounce delay-300"></span>
                  Thirukkural Bot is reading...
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* INPUT FORM PANE */}
          <form onSubmit={handleSubmit} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isBotStopped ? 'Bot service is stopped' : 'Type a command (e.g., /start, /time 7:30 AM, /kural, /random)...'}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-slate-700 transition-all font-medium"
              disabled={isBotStopped}
            />
            <button
              type="submit"
              disabled={isBotStopped || !input.trim()}
              className={`font-bold px-4 py-2.5 rounded-xl text-xs transition-all flex items-center justify-center cursor-pointer ${
                isBotStopped || !input.trim()
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
                  : 'bg-amber-500 text-slate-950 hover:bg-amber-400 font-extrabold shadow-md'
              }`}
            >
              <Send size={13} />
            </button>
          </form>
        </div>
      </section>

      {/* MODAL: EMBEDDED FLASK TIME PICKER WEB APP */}
      {showFlaskPickerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md h-[680px] max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800/90 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-base">🌸</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">Telegram WebApp • Visual Time Picker</h4>
                  <p className="text-[10px] text-slate-400 font-mono">Chat ID #{simUser.chatId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={flaskPickerUrl || `/time-picker?chatId=${simUser.chatId}&time=${encodeURIComponent(simUser.triggerTime || '07:00:AM')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors font-medium flex items-center gap-1"
                  title="Open standalone page in new browser tab"
                >
                  <span>Open in Tab</span>
                  <span>↗</span>
                </a>
                <button
                  onClick={() => {
                    setShowFlaskPickerModal(false);
                    // Refresh active user to reflect changes made in the Flask UI
                    fetch('/api/users')
                      .then(r => r.json())
                      .then((users: BotUser[]) => {
                        const u = users.find(x => x.chatId === simUser.chatId);
                        if (u) onChangeSimUser(u);
                      })
                      .catch(() => {});
                  }}
                  className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors font-bold"
                >
                  Close ✕
                </button>
              </div>
            </div>
            <iframe
              src={flaskPickerUrl || `/time-picker?chatId=${simUser.chatId}&time=${encodeURIComponent(simUser.triggerTime || '07:00:AM')}`}
              className="w-full flex-1 border-none bg-[#0b0f19]"
              title="Flask UI Time Picker"
            />
          </div>
        </div>
      )}
    </div>
  );
}
