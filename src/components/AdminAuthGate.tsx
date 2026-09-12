import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, AlertCircle, ArrowRight, KeyRound } from 'lucide-react';
import { AdminAuthUser } from '../types';

interface AdminAuthGateProps {
  onLoginSuccess: (user: AdminAuthUser) => void;
}

export default function AdminAuthGate({ onLoginSuccess }: AdminAuthGateProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUser = username.trim();
    if (!trimmedUser) {
      setErrorMessage('Please enter your username.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUser, password })
      });

      const data = await res.json();

      if (res.ok && data.authorized) {
        const authUser: AdminAuthUser = {
          username: data.user?.username || trimmedUser,
          signedInAt: Date.now()
        };

        // Save session locally
        localStorage.setItem('admin_auth_user', JSON.stringify(authUser));
        onLoginSuccess(authUser);
      } else {
        setErrorMessage(data.error || 'Invalid credentials. Please check your username and password.');
      }
    } catch (err) {
      console.error('Login network error:', err);
      setErrorMessage('Network connection error while communicating with the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 sm:p-6" id="admin_auth_gate">
      {/* BACKGROUND ACCENTS */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        
        {/* BRAND IDENTITY */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-4 shadow-xs">
            <Lock size={13} className="text-sky-400" />
            <span>Administrator Access</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Thirukkural Admin
          </h1>
          <p className="text-slate-400 text-xs mt-1.5">
            Telegram Bot telemetry, subscriber management, and broadcast command suite
          </p>
        </div>

        {/* LOGIN CARD */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl flex flex-col gap-5">

          {/* ERROR ALERT */}
          {errorMessage && (
            <div className="bg-rose-950/80 border border-rose-800/80 rounded-2xl p-3.5 flex items-start gap-2.5 text-rose-200 animate-slideIn">
              <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {/* LOGIN FORM */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <User size={16} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                  autoFocus
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-3.5 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Password
                </label>
                <span className="text-[10px] text-slate-500">Case-sensitive</span>
              </div>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <KeyRound size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 active:scale-[0.99] text-slate-950 font-bold text-sm py-3.5 px-4 rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-60 mt-2"
              id="admin_login_submit_btn"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </div>
              ) : (
                <>
                  <span>Sign In as Admin</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* FOOTER NOTE */}
          <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>Password editable inside dashboard</span>
            <span className="font-mono text-[10px] text-slate-500">v2.4 secure auth</span>
          </div>
        </div>

        {/* BOTTOM BRANDING */}
        <p className="text-center text-xs text-slate-500 mt-6">
          Daily Thirukkural Telegram Bot Companion Suite
        </p>
      </div>
    </div>
  );
}
