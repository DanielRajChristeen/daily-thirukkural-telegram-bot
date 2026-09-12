import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Trash2, 
  Check, 
  X,
  Globe, 
  Clock, 
  UserPlus, 
  ShieldAlert,
  UserCheck
} from 'lucide-react';
import { BotUser } from '../types';

interface UserManagerProps {
  users: BotUser[];
  onDeleteUser: (chatId: number) => void;
  onUpdateUser: (chatId: number, updatedFields: Partial<BotUser>) => Promise<void>;
  onRefresh?: () => void;
  loading: boolean;
}

export default function UserManager({ users, onDeleteUser, onUpdateUser, onRefresh, loading }: UserManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [flaskModalUser, setFlaskModalUser] = useState<BotUser | null>(null);
  
  // Edit Form states
  const [editLang, setEditLang] = useState<'tamil' | 'english' | 'both'>('both');
  const [editTime, setEditTime] = useState<string>('07:00:AM');

  // Listen for real-time updates from the Visual Time Picker iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'TIME_PICKER_SAVED') {
        if (onRefresh) onRefresh();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onRefresh]);

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

  const handleStartEdit = (user: BotUser) => {
    setEditingUserId(user.chatId);
    setEditLang(user.language);
    setEditTime(user.triggerTime);
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
  };

  const handleSaveEdit = async (chatId: number) => {
    await onUpdateUser(chatId, {
      language: editLang,
      triggerTime: editTime
    });
    setEditingUserId(null);
  };

  // Filter subscribers list
  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase();
    return (
      u.chatId.toString().includes(term) ||
      (u.username || '').toLowerCase().includes(term) ||
      (u.firstName || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col gap-6" id="user_manager">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Users size={16} className="text-amber-500" /> Subscriber Registry Database
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Administrate and edit preferences for real & simulated Telegram bot subscribers
          </p>
        </div>

        {/* Search Subscribers input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by ID, Username, Name..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-slate-950/10 focus:border-slate-400 transition-all text-slate-800 font-medium"
          />
        </div>
      </div>

      {/* REGISTRY GRID TABLE */}
      {loading && users.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 border-4 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-2xl py-12 flex flex-col items-center justify-center gap-3 bg-slate-50/50">
          <ShieldAlert size={36} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">No subscribers found matching query</p>
          <p className="text-xs text-slate-400">Try cleaning your search filters</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase font-mono tracking-wider border-b border-slate-100">
                <th className="px-5 py-4 font-semibold">Subscriber ID / Username</th>
                <th className="px-5 py-4 font-semibold">First Name</th>
                <th className="px-5 py-4 font-semibold">Language Prefer</th>
                <th className="px-5 py-4 font-semibold">Trigger Time</th>
                <th className="px-5 py-4 font-semibold">Last Interaction</th>
                <th className="px-5 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredUsers.map(user => {
                const isEditing = editingUserId === user.chatId;
                const isSimulated = user.chatId < 10000000;

                return (
                  <tr key={user.chatId} className="hover:bg-slate-50/70 transition-colors">
                    
                    {/* ID / Username */}
                    <td className="px-5 py-4 font-mono">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          {user.chatId}
                          {isSimulated && (
                            <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-sans font-bold uppercase">
                              Simulated
                            </span>
                          )}
                        </span>
                        <span className="text-slate-400 font-normal">
                          {user.username ? `@${user.username}` : 'No username'}
                        </span>
                      </div>
                    </td>

                    {/* Name */}
                    <td className="px-5 py-4">
                      <span className="font-semibold text-slate-800">{user.firstName || 'Unknown'}</span>
                    </td>

                    {/* Language Preference */}
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <select
                          value={editLang}
                          onChange={(e) => setEditLang(e.target.value as any)}
                          className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                        >
                          <option value="tamil">Tamil Only (தமிழ்)</option>
                          <option value="english">English Only</option>
                          <option value="both">Both (இருமொழியும்)</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                          user.language === 'tamil' ? 'bg-amber-50 text-amber-800 border-amber-100' :
                          user.language === 'english' ? 'bg-sky-50 text-sky-800 border-sky-100' :
                          'bg-emerald-50 text-emerald-800 border-emerald-100'
                        }`}>
                          <Globe size={10} /> {user.language}
                        </span>
                      )}
                    </td>

                    {/* Trigger Time (Customized Always) */}
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="time"
                            disabled={editTime === 'none'}
                            value={to24h(editTime)}
                            onChange={(e) => setEditTime(to12h(e.target.value))}
                            className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-slate-900 disabled:opacity-50"
                          />
                          <button
                            type="button"
                            onClick={() => setEditTime(editTime === 'none' ? '07:00:AM' : 'none')}
                            className="text-[10px] font-bold px-1.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                          >
                            {editTime === 'none' ? 'Enable' : 'Off'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            user.triggerTime === 'none' ? 'text-slate-400 italic' : 'text-slate-700 font-mono'
                          }`}>
                            <Clock size={11} className="text-slate-400" />
                            {user.triggerTime === 'none' ? 'Disabled' : user.triggerTime.replace(':', ' ').replace(':', ' ')}
                          </span>
                          <button
                            type="button"
                            onClick={() => setFlaskModalUser(user)}
                            className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold transition-colors cursor-pointer"
                            title="Open Flask UI Time Picker for this subscriber"
                          >
                            📱 Flask UI
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Last Active */}
                    <td className="px-5 py-4 text-slate-400 font-mono text-[11px]">
                      {user.lastActive ? new Date(user.lastActive).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'Never'}
                    </td>

                    {/* Actions buttons */}
                    <td className="px-5 py-4 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleSaveEdit(user.chatId)}
                            className="bg-slate-900 hover:bg-slate-800 text-white p-1 rounded-lg transition-colors cursor-pointer"
                            title="Confirm modifications"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-500 p-1 rounded-lg transition-colors cursor-pointer"
                            title="Abort changes"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleStartEdit(user)}
                            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                          >
                            Edit Preference
                          </button>
                          <button
                            onClick={() => onDeleteUser(user.chatId)}
                            className="text-rose-500 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-100 rounded-lg p-1.5 transition-all cursor-pointer"
                            title="Remove subscription from database"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Info helper block */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-start gap-2.5">
        <span className="text-sm">📌</span>
        <p className="text-xs text-slate-500 leading-relaxed">
          <b>Subscriber IDs larger than 10000000</b> represent real Telegram clients connected to the live bot service. Modifying their preferences here takes immediate effect for their automatic daily couplet dispatches. Use deletions only when resetting system subscriptions.
        </p>
      </div>

      {/* MODAL: EMBEDDED FLASK TIME PICKER FOR SUBSCRIBER */}
      {flaskModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md h-[680px] max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800/90 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-base">🌸</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">Flask UI Visual Time Picker</h4>
                  <p className="text-[10px] text-slate-400 font-mono">Subscriber #{flaskModalUser.chatId} ({flaskModalUser.firstName})</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/time-picker?chatId=${flaskModalUser.chatId}&time=${encodeURIComponent(flaskModalUser.triggerTime || '07:00:AM')}`}
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
                    setFlaskModalUser(null);
                    if (onRefresh) onRefresh();
                  }}
                  className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors font-bold"
                >
                  Close ✕
                </button>
              </div>
            </div>
            <iframe
              src={`/time-picker?chatId=${flaskModalUser.chatId}&time=${encodeURIComponent(flaskModalUser.triggerTime || '07:00:AM')}`}
              className="w-full flex-1 border-none bg-[#0b0f19]"
              title="Flask UI Time Picker"
            />
          </div>
        </div>
      )}
    </div>
  );
}
