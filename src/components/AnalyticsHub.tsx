import React from 'react';
import { 
  Users, 
  Globe, 
  Clock, 
  Activity, 
  TrendingUp, 
  CheckCircle2, 
  HelpCircle,
  BookOpen,
  RefreshCw
} from 'lucide-react';
import { AdminStats } from '../types';

interface AnalyticsHubProps {
  stats: AdminStats | null;
  loading: boolean;
  onRefresh: () => void;
}

export default function AnalyticsHub({ stats, loading, onRefresh }: AnalyticsHubProps) {
  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white border border-slate-200 rounded-3xl">
        <div className="h-10 w-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-500 font-mono">Compiling real-time statistics...</p>
      </div>
    );
  }

  const defaultStats: AdminStats = stats || {
    totalUsers: 0,
    languages: { tamil: 0, english: 0, both: 0 },
    reminders: {},
    activity: { incoming: 0, outgoing: 0, system: 0, total: 0 }
  };

  const s = defaultStats;
  const totalLang = Math.max(1, s.languages.tamil + s.languages.english + s.languages.both);
  
  // Percentages for languages
  const pctTamil = s.totalUsers > 0 ? Math.round((s.languages.tamil / totalLang) * 100) : 0;
  const pctEnglish = s.totalUsers > 0 ? Math.round((s.languages.english / totalLang) * 100) : 0;
  const pctBoth = s.totalUsers > 0 ? Math.round((s.languages.both / totalLang) * 100) : 0;

  // Reminders max calculation for scaling charts
  const reminderValues = Object.values(s.reminders);
  const maxReminderVal = Math.max(1, ...reminderValues);
  const offCount = s.reminders['Off / None'] ?? s.reminders['Disabled / Off'] ?? s.reminders['None'] ?? 0;
  const activeSchedulers = Math.max(0, s.totalUsers - offCount);
  const hasReminders = Object.keys(s.reminders).length > 0;

  return (
    <div className="flex flex-col gap-6" id="analytics_hub">
      {/* SECTION 1: POLISHED TELEMETRY OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Total Subscribers Card */}
        <div className="bg-white border border-slate-200 hover:border-slate-300 transition-all rounded-2xl p-5 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-slate-50 rounded-bl-full flex items-center justify-center border-l border-b border-slate-100 group-hover:bg-slate-100/75 transition-colors">
            <Users size={18} className="text-slate-500" />
          </div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Subscribers</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">{s.totalUsers}</span>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <TrendingUp size={10} /> +100%
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Unique Chat IDs registered in system</p>
        </div>

        {/* Messages Transacted Card */}
        <div className="bg-white border border-slate-200 hover:border-slate-300 transition-all rounded-2xl p-5 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-slate-50 rounded-bl-full flex items-center justify-center border-l border-b border-slate-100 group-hover:bg-slate-100/75 transition-colors">
            <Activity size={18} className="text-slate-500" />
          </div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Activity Volume</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">{s.activity.total}</span>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
              Logs cached
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Total tracked incoming & outgoing updates</p>
        </div>

        {/* Automated Dispatch Schedule Card */}
        <div className="bg-white border border-slate-200 hover:border-slate-300 transition-all rounded-2xl p-5 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-slate-50 rounded-bl-full flex items-center justify-center border-l border-b border-slate-100 group-hover:bg-slate-100/75 transition-colors">
            <Clock size={18} className="text-slate-500" />
          </div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Schedulers</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              {activeSchedulers}
            </span>
            <span className="text-xs text-slate-400">/ {s.totalUsers} users</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Users scheduled for daily couplest delivery</p>
        </div>

        {/* Core Bot Engine Status Card */}
        <div className="bg-white border border-slate-200 hover:border-slate-300 transition-all rounded-2xl p-5 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-slate-50 rounded-bl-full flex items-center justify-center border-l border-b border-slate-100 group-hover:bg-slate-100/75 transition-colors">
            <CheckCircle2 size={18} className="text-emerald-500" />
          </div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Engine Health</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-lg font-bold text-emerald-800">100% OPERATIONAL</span>
          </div>
          <p className="text-xs text-slate-500 mt-3.5">Server container active and responding</p>
        </div>
      </div>

      {/* SECTION 2: CHARTS AND VISUAL ANALYSIS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT CHART: Language Distribution Analysis (5 Columns) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col gap-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Globe size={16} className="text-indigo-600" /> Language Preferences
            </h3>
            <p className="text-xs text-slate-500 mt-1">Breakdown of preferred script delivery formats</p>
          </div>

          <div className="flex flex-col gap-5 mt-2">
            {/* Tamil Only */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span> தமிழ் மட்டும் (Tamil Only)
                </span>
                <span className="font-mono font-bold text-slate-900">{s.languages.tamil} ({pctTamil}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                  style={{ width: `${pctTamil}%` }}
                ></div>
              </div>
            </div>

            {/* English Only */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-500"></span> English Only
                </span>
                <span className="font-mono font-bold text-slate-900">{s.languages.english} ({pctEnglish}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-sky-500 rounded-full transition-all duration-500" 
                  style={{ width: `${pctEnglish}%` }}
                ></div>
              </div>
            </div>

            {/* Both Languages */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span> Bilingual (Both / இரண்டும்)
                </span>
                <span className="font-mono font-bold text-slate-900">{s.languages.both} ({pctBoth}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                  style={{ width: `${pctBoth}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Quick takeaway block */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-start gap-3 mt-4">
            <span className="text-base text-slate-500">💡</span>
            <p className="text-xs text-slate-600 leading-relaxed">
              <b>{pctBoth >= pctTamil && pctBoth >= pctEnglish ? "Bilingual" : pctTamil >= pctEnglish ? "Tamil Only" : "English Only"}</b> delivery is currently the most popular choice among subscribers. Keep content bilingual in admin announcements for optimal reach.
            </p>
          </div>
        </div>

        {/* RIGHT CHART: Daily Delivery Windows Solely Based on Subscriber Choices */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between gap-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Clock size={16} className="text-sky-600" /> Daily Delivery Windows
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Subscriber delivery schedule (X-axis derived solely from subscriber choices • Time Zone: IST)
            </p>
          </div>

          {/* Dynamic Column Chart based solely on subscriber choices */}
          {!hasReminders ? (
            <div className="flex flex-col items-center justify-center h-48 border-b border-slate-100 mt-4 text-center px-4">
              <Clock size={28} className="text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">No Subscriber Reminders Scheduled Yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Delivery times will appear on this axis automatically as subscribers choose their delivery schedule.
              </p>
            </div>
          ) : (
            <div className="flex items-end justify-around h-48 px-2 sm:px-4 border-b border-slate-100 mt-4 gap-2 overflow-x-auto">
              {Object.entries(s.reminders).map(([timeLabel, count]) => {
                const relativeHeight = Math.max(14, (count / maxReminderVal) * 100);
                const isOff = timeLabel.includes('Off') || timeLabel.includes('Disabled') || timeLabel.includes('None');
                return (
                  <div key={timeLabel} className="flex flex-col items-center gap-2 min-w-[70px] flex-1 max-w-[120px] group relative">
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded-md -translate-y-1 absolute shadow-sm pointer-events-none mb-14 whitespace-nowrap z-10">
                      {count} Subscriber{count !== 1 ? 's' : ''} ({Math.round((count / Math.max(1, s.totalUsers)) * 100)}%)
                    </div>
                    
                    {/* Vertical bar */}
                    <div 
                      className={`w-full max-w-[48px] rounded-t-xl transition-all duration-500 flex items-end justify-center pb-2 ${
                        isOff
                          ? 'bg-slate-200 text-slate-600 font-mono text-[10px] font-bold'
                          : count > 0 
                            ? 'bg-gradient-to-t from-sky-600 to-sky-500 text-white font-mono text-[10px] font-extrabold shadow-sm' 
                            : 'bg-slate-100 border border-slate-200 text-slate-400'
                      }`}
                      style={{ height: `${relativeHeight}%` }}
                    >
                      {count > 0 ? count : ''}
                    </div>

                    {/* Horizontal X-Axis Label based solely on subscriber choice */}
                    <span className="text-[11px] font-bold text-slate-700 text-center truncate w-full px-1" title={timeLabel}>
                      {timeLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-500 font-mono">
              Peak window: <b>{maxReminderVal} subscriber{maxReminderVal !== 1 ? 's' : ''}</b>
            </span>
            <button 
              onClick={onRefresh}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Force Reload Statistics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
