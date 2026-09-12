import React, { useState } from 'react';
import { 
  Terminal, 
  Trash2, 
  RefreshCw, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Cpu, 
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { ActivityLog } from '../types';

interface ActivityLogsProps {
  logs: ActivityLog[];
  loading: boolean;
  onRefresh: () => void;
  onClear: () => void;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
}

export default function ActivityLogs({ 
  logs, 
  loading, 
  onRefresh, 
  onClear, 
  autoRefresh, 
  onToggleAutoRefresh 
}: ActivityLogsProps) {
  const [filterType, setFilterType] = useState<'all' | 'incoming' | 'outgoing' | 'system'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error' | 'info'>('all');
  const [searchWord, setSearchWord] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Filter logs list
  const filteredLogs = logs.filter(l => {
    const matchesType = filterType === 'all' || l.type === filterType;
    const matchesStatus = filterStatus === 'all' || l.status === filterStatus;
    const matchesSearch = !searchWord.trim() || 
      (l.text || '').toLowerCase().includes(searchWord.toLowerCase()) ||
      (l.username || '').toLowerCase().includes(searchWord.toLowerCase()) ||
      l.chatId.toString().includes(searchWord);
    
    return matchesType && matchesStatus && matchesSearch;
  });

  const getLogIcon = (type: string, status: string) => {
    if (type === 'incoming') return <ArrowDownLeft className="text-emerald-500 shrink-0" size={15} />;
    if (type === 'outgoing') return <ArrowUpRight className="text-indigo-500 shrink-0" size={15} />;
    
    // System
    if (status === 'success') return <CheckCircle className="text-emerald-500 shrink-0" size={15} />;
    if (status === 'error') return <XCircle className="text-rose-500 shrink-0" size={15} />;
    return <Cpu className="text-slate-500 shrink-0" size={15} />;
  };

  const getLogBadge = (type: string, status: string) => {
    if (type === 'incoming') {
      return <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase">Incoming</span>;
    }
    if (type === 'outgoing') {
      return <span className="bg-indigo-50 text-indigo-800 border border-indigo-100 text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase">Outgoing</span>;
    }
    
    // System status
    if (status === 'success') {
      return <span className="bg-emerald-100 text-emerald-900 border border-emerald-200 text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase">Sys Success</span>;
    }
    if (status === 'error') {
      return <span className="bg-rose-100 text-rose-900 border border-rose-200 text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase">Sys Error</span>;
    }
    return <span className="bg-slate-100 text-slate-800 border border-slate-200 text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase">Sys Event</span>;
  };

  return (
    <div className="bg-slate-900 text-slate-100 border border-slate-850 rounded-3xl p-6 shadow-xl flex flex-col gap-6" id="activity_logs_panel">
      
      {/* HEADER CONTROLS */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-800 text-slate-300 rounded-xl">
            <Terminal size={18} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              Live Gateway Transactions Log
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Inspecting webhook triggers, scheduled dispatches, and subscriber text flows
            </p>
          </div>
        </div>

        {/* CONTROLS BAR */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Auto Refresh toggle */}
          <button
            onClick={onToggleAutoRefresh}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              autoRefresh 
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' 
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`}></span>
            {autoRefresh ? 'Auto-Refreshed' : 'Manual Refresh'}
          </button>

          {/* Force reload */}
          <button
            onClick={onRefresh}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            title="Fetch latest cached transaction entries"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Pull Logs
          </button>

          {/* Clear database */}
          <button
            onClick={onClear}
            className="bg-rose-950/40 hover:bg-rose-900 border border-rose-800/50 text-rose-300 font-semibold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            title="Empty trace database cache file"
          >
            <Trash2 size={13} /> Clear Log
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
        {/* Search */}
        <div className="md:col-span-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <input
            type="text"
            value={searchWord}
            onChange={(e) => setSearchWord(e.target.value)}
            placeholder="Search logs by ID, message text..."
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-hidden focus:ring-1 focus:ring-slate-700 focus:border-slate-700 transition-all placeholder:text-slate-600"
          />
        </div>

        {/* Type selector */}
        <div className="md:col-span-4 flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800/80">
          <span className="text-[10px] text-slate-500 uppercase font-bold font-mono pl-2">Type:</span>
          <div className="flex items-center gap-1 w-full justify-end">
            {(['all', 'incoming', 'outgoing', 'system'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all capitalize cursor-pointer ${
                  filterType === t 
                    ? 'bg-slate-850 text-white shadow-xs border border-slate-750' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Status selector */}
        <div className="md:col-span-4 flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800/80">
          <span className="text-[10px] text-slate-500 uppercase font-bold font-mono pl-2">Status:</span>
          <div className="flex items-center gap-1 w-full justify-end">
            {(['all', 'success', 'error', 'info'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all capitalize cursor-pointer ${
                  filterStatus === s 
                    ? 'bg-slate-850 text-white shadow-xs border border-slate-750' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* LOG ENTRIES SHELL */}
      <div className="flex flex-col gap-2 max-h-[460px] overflow-y-auto pr-1" id="logs_console">
        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3 bg-slate-950/20 border border-slate-850 rounded-2xl">
            <Info size={28} className="text-slate-600" />
            <p className="text-xs font-semibold font-mono">No transaction logs captured yet.</p>
            <p className="text-[10px] text-slate-600">Simulate chats or connect real Telegram updates to fill cache</p>
          </div>
        ) : (
          filteredLogs.map(log => {
            const isExpanded = expandedLogId === log.id;
            const timeStr = new Date(log.timestamp).toLocaleTimeString([], { 
              hour12: false, 
              hour: '2-digit', 
              minute: '2-digit', 
              second: '2-digit' 
            });

            return (
              <div 
                key={log.id} 
                className={`bg-slate-950 border border-slate-850/80 hover:border-slate-750 transition-all rounded-xl p-3.5 flex flex-col gap-2.5 cursor-pointer ${
                  isExpanded ? 'ring-1 ring-slate-700 border-slate-700' : ''
                }`}
                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
              >
                {/* Main line summary */}
                <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-3 min-w-0">
                    {getLogIcon(log.type, log.status)}
                    <span className="text-[10px] text-slate-500 font-mono font-bold shrink-0">{timeStr}</span>
                    
                    {log.chatId > 0 ? (
                      <span className="text-[11px] font-bold text-slate-300 font-mono shrink-0">
                        ID: {log.chatId} {log.username ? `(@${log.username})` : ''}
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-500 font-mono shrink-0">SYSTEM</span>
                    )}

                    <span className="text-slate-400 text-xs font-medium truncate">
                      {log.text.replace(/<[^>]*>/g, '')}
                    </span>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {getLogBadge(log.type, log.status)}
                  </div>
                </div>

                {/* Collapsible raw details segment */}
                {isExpanded && (
                  <div className="mt-1 border-t border-slate-850 pt-3 flex flex-col gap-2.5 animate-fadeIn">
                    <div className="grid grid-cols-2 text-[10px] font-mono text-slate-400 gap-2">
                      <div>
                        <span className="text-slate-600 block">Record UUID</span>
                        <span className="text-slate-300">{log.id}</span>
                      </div>
                      <div>
                        <span className="text-slate-600 block">Timestamp</span>
                        <span className="text-slate-300">{new Date(log.timestamp).toString()}</span>
                      </div>
                    </div>
                    <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-850 text-[11px] font-mono leading-relaxed text-slate-300 whitespace-pre-wrap">
                      <span className="text-slate-600 block text-[10px] font-semibold mb-1 uppercase tracking-wider font-mono">Payload message content:</span>
                      <div dangerouslySetInnerHTML={{ __html: log.text }}></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Terminal status line */}
      <div className="text-[10px] font-mono text-slate-500 flex justify-between items-center border-t border-slate-800/80 pt-4 mt-2">
        <span>Active Cache Trace: <b>{filteredLogs.length} matching rows</b></span>
        <span>Polling rate: <b>3s refresh loop</b></span>
      </div>
    </div>
  );
}
