/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, BarChart3, Flame, Trophy, Plus, Trash2, RefreshCw, MessageSquare, Eye, Edit3, Volume2, HelpCircle, User, Share2, Link } from 'lucide-react';
import { Session } from '../types';
import { INITIAL_SESSIONS } from '../data';
import { getTodayString, formatLocalDate } from '../utils';
import ProgressChart from './ProgressChart';
import Timer from './Timer';
import SessionLogger from './SessionLogger';
import YearlyReport from './YearlyReport';

export default function Dashboard() {
  // --- STATE ---
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [authSubmitting, setAuthSubmitting] = useState<boolean>(false);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [showLogger, setShowLogger] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'console' | 'report'>('console');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [shareUserId, setShareUserId] = useState<string | null>(null);
  const [sharedUsername, setSharedUsername] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // --- API INITIALIZATION & FETCH ---
  useEffect(() => {
    const initializeAuthAndSessions = async () => {
      setIsLoading(true);

      // Check query parameter for shared profile
      const params = new URLSearchParams(window.location.search);
      const viewId = params.get('view') || params.get('share');
      if (viewId) {
        setShareUserId(viewId);
        try {
          const res = await fetch(`/api/sessions/shared/${viewId}`);
          if (res.ok) {
            const data = await res.json();
            setSessions(data.sessions);
            setSharedUsername(data.user.username);
            setIsLoading(false);
            return;
          }
        } catch (err) {
          console.error('Failed to load shared sessions:', err);
        }
      }

      const token = localStorage.getItem('deep_focus_token');
      if (token) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
            
            // Fetch sessions
            const sessionsRes = await fetch('/api/sessions', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (sessionsRes.ok) {
              const data = await sessionsRes.json();
              setSessions(data);
              localStorage.setItem('deep_focus_sessions', JSON.stringify(data));
            }
          } else {
            // Token invalid or expired
            localStorage.removeItem('deep_focus_token');
            localStorage.removeItem('deep_focus_sessions');
            setUser(null);
          }
        } catch (err) {
          console.warn('⚠️ API server unreachable, falling back to local cache:', err);
          const savedSessions = localStorage.getItem('deep_focus_sessions');
          if (savedSessions) {
            setSessions(JSON.parse(savedSessions));
          }
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    };
    
    initializeAuthAndSessions();
  }, []);

  // --- ACTIONS ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUsername.trim() || !authPassword.trim()) {
      setAuthError('Please fill in all fields.');
      return;
    }
    setAuthError('');
    setAuthSubmitting(true);
    
    const url = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authUsername.trim(),
          password: authPassword.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('deep_focus_token', data.token);
        setUser(data.user);
        
        // Fetch user sessions
        const sessionsRes = await fetch('/api/sessions', {
          headers: { 'Authorization': `Bearer ${data.token}` }
        });
        if (sessionsRes.ok) {
          const sessionsData = await sessionsRes.json();
          setSessions(sessionsData);
          localStorage.setItem('deep_focus_sessions', JSON.stringify(sessionsData));
        }
        
        // Clear input state
        setAuthUsername('');
        setAuthPassword('');
      } else {
        setAuthError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setAuthError('Failed to connect to authentication server. Please try again.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('deep_focus_token');
    localStorage.removeItem('deep_focus_sessions');
    setUser(null);
    setSessions([]);
  };

  const handleCopyShareLink = () => {
    if (!user) return;
    const shareUrl = `${window.location.origin}?share=${user.id}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch((err) => {
        console.error('Could not copy text: ', err);
      });
  };

  const handleAddSession = async (newSessionData: Omit<Session, 'id'>) => {
    const newSession: Session = {
      ...newSessionData,
      id: `s-${Date.now()}`,
    };

    // Optimistically update frontend state
    const updatedSessions = [...sessions, newSession];
    setSessions(updatedSessions);
    localStorage.setItem('deep_focus_sessions', JSON.stringify(updatedSessions));

    // Persist to backend MongoDB
    try {
      const token = localStorage.getItem('deep_focus_token');
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newSession),
      });
      if (!res.ok) {
        throw new Error('Failed to save to backend');
      }
    } catch (err) {
      console.error('Failed to sync added session with MongoDB backend:', err);
    }
  };

  const handleDeleteSession = async (idOrIds: string | string[]) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    
    // Optimistically update frontend state
    const updated = sessions.filter((s) => !ids.includes(s.id));
    setSessions(updated);
    localStorage.setItem('deep_focus_sessions', JSON.stringify(updated));

    // Persist deletes to backend MongoDB
    try {
      const token = localStorage.getItem('deep_focus_token');
      await Promise.all(
        ids.map(id => 
          fetch(`/api/sessions/${id}`, { 
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          })
        )
      );
    } catch (err) {
      console.error('Failed to sync deleted sessions with MongoDB backend:', err);
    }
  };

  const handleResetChallenge = async () => {
    // Optimistically reset local state
    setSessions(INITIAL_SESSIONS);
    localStorage.setItem('deep_focus_sessions', JSON.stringify(INITIAL_SESSIONS));
    setSelectedDate(getTodayString());
    setShowResetConfirm(false);

    // Sync reset to backend MongoDB
    try {
      const token = localStorage.getItem('deep_focus_token');
      const res = await fetch('/api/sessions/reset', { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Failed to reset backend');
      }
    } catch (err) {
      console.error('Failed to sync reset with MongoDB backend:', err);
    }
  };

  // --- STATS CALCULATIONS FOR SELECTED DATE ---
  const selectedDateSessions = sessions.filter((s) => s.date === selectedDate);
  
  const totalMinutes = selectedDateSessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalMinsLeft = totalMinutes % 60;

  const sprechenMinutes = selectedDateSessions
    .filter((s) => s.category === 'Speaking')
    .reduce((acc, s) => acc + s.durationMinutes, 0);

  const lesenMinutes = selectedDateSessions
    .filter((s) => s.category === 'Reading')
    .reduce((acc, s) => acc + s.durationMinutes, 0);

  const schreibenMinutes = selectedDateSessions
    .filter((s) => s.category === 'Writing')
    .reduce((acc, s) => acc + s.durationMinutes, 0);

  const hoerenMinutes = selectedDateSessions
    .filter((s) => s.category === 'Listening')
    .reduce((acc, s) => acc + s.durationMinutes, 0);

  // Active study calendar dates count
  const activeDatesCount = new Set(sessions.map((s) => s.date)).size;

  // Trend analysis text
  const getTrendTextAndIcon = () => {
    if (activeDatesCount >= 10) {
      return { text: '🔥 Absolute Legendary Streak', color: 'text-orange-400' };
    }
    if (activeDatesCount >= 6) {
      return { text: '⭐ Outstanding Consistency!', color: 'text-yellow-400' };
    }
    if (activeDatesCount >= 3) {
      return { text: '🚀 Keep Building Momentum', color: 'text-blue-400' };
    }
    return { text: '🌱 Beginning Your Focus Journey', color: 'text-emerald-400' };
  };

  const trend = getTrendTextAndIcon();

  return (
    <div id="study-tracker-dashboard" className="min-h-screen bg-[#040815] text-slate-100 flex flex-col font-sans selection:bg-blue-600/30 selection:text-blue-200">
      
      {/* HEADER SECTION */}
      <header className="max-w-6xl w-full mx-auto px-4 md:px-6 pt-6 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#111a36]/60">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 id="app-logo" className="text-2xl sm:text-3xl font-display font-black tracking-wider select-none uppercase">
              STUDY <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400">TRACKER</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 mt-1.5 pl-0.5 text-slate-400">
            <div className="w-1.5 h-3.5 bg-gradient-to-b from-blue-500 to-emerald-500 rounded-full" />
            <span className="text-xs font-medium tracking-wide">Every focused study session brings you one step closer to your dream in Deutschland. 🇩🇪</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center sm:justify-end gap-4 self-stretch sm:self-auto">
          {user && (
            <div className="flex items-center gap-3 bg-[#0e1630]/90 border border-[#1e2942] px-4 py-2 rounded-xl shadow-lg backdrop-blur-sm">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <User className="w-4 h-4" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[9px] font-mono text-slate-500 uppercase font-black tracking-widest">Active User</span>
                <span className="text-xs font-black text-blue-400 capitalize font-mono leading-tight">{user.username}</span>
              </div>
              <button
                onClick={handleCopyShareLink}
                className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase font-mono tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                  copied
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 animate-pulse'
                    : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300'
                }`}
                title="Copy read-only dashboard link for friends"
              >
                <Share2 className="w-3.5 h-3.5" />
                {copied ? 'Copied!' : 'Share Link'}
              </button>
              <button
                onClick={handleLogout}
                className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 font-bold text-[10px] uppercase font-mono tracking-wider transition-all cursor-pointer"
                title="Sign out from this device"
              >
                Logout
              </button>
            </div>
          )}
          <div className="flex flex-col items-start sm:items-end">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Selected Date</span>
            <div className="flex items-center gap-2 mt-1">
              <div id="header-day-display" className="text-sm font-mono font-black text-slate-100 flex items-center gap-2 bg-[#0e1630]/90 border border-[#1e2942] px-4 py-2 rounded-xl shadow-lg backdrop-blur-sm">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>{formatLocalDate(selectedDate)}</span>
              </div>
              <button
                onClick={() => setSelectedDate(getTodayString())}
                className="px-3.5 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                title="Jump to Today"
              >
                Today
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* READ-ONLY FRIEND VIEW BANNER */}
      {shareUserId && (
        <div className="max-w-6xl w-full mx-auto px-4 md:px-6 mt-4">
          <div className="bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-500/30 text-blue-200 px-5 py-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
              </span>
              <p className="text-xs sm:text-sm font-medium">
                Viewing <span className="font-bold text-slate-100 capitalize">{sharedUsername || 'User'}'s</span> Study Tracker (Read-Only Mode)
              </p>
            </div>
            <button
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete('view');
                url.searchParams.delete('share');
                window.location.href = url.origin + url.pathname;
              }}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-slate-50 rounded-xl text-xs font-semibold tracking-wide transition-all shadow-md cursor-pointer hover:shadow-blue-500/20"
            >
              Back to My Space
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-24 animate-pulse">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-xs font-mono text-slate-400 mt-4 tracking-widest uppercase">Syncing Portals...</span>
        </div>
      ) : (!user && !shareUserId) ? (
        <div className="flex-1 flex items-center justify-center py-12 px-4">
          <div className="w-full max-w-md bg-[#0e1630] border border-[#1e2942] rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden group">
            {/* Decorative radial gradients */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/15 transition-all duration-700" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/15 transition-all duration-700" />
            
            <div className="relative z-10">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-4 shadow-inner">
                  <Trophy className="w-6 h-6 animate-bounce" />
                </div>
                <h2 className="text-2xl font-display font-black text-slate-100 tracking-tight">
                  {authMode === 'login' ? 'Welcome Back' : 'Create New Account'}
                </h2>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  {authMode === 'login' 
                    ? 'Sign in to access and sync your study and learning progress from any device.' 
                    : 'Create an account to start syncing your studies securely with MongoDB.'}
                </p>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {authError && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold leading-relaxed font-mono">
                    ⚠️ {authError}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. johndoe"
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    className="w-full bg-[#070c1e] border border-[#1e2942] focus:border-blue-500 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full bg-[#070c1e] border border-[#1e2942] focus:border-blue-500 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-all font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-slate-100 font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 hover:scale-[1.01] transition-all cursor-pointer disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                >
                  {authSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : authMode === 'login' ? (
                    'Sign In'
                  ) : (
                    'Create Account'
                  )}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-[#111a36]/60 text-center">
                <span className="text-xs text-slate-400">
                  {authMode === 'login' ? "Don't have an account yet?" : "Already have an account?"}
                </span>
                <button
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'register' : 'login');
                    setAuthError('');
                  }}
                  className="text-xs font-bold text-blue-400 hover:text-blue-300 ml-1.5 underline cursor-pointer font-mono"
                >
                  {authMode === 'login' ? 'Create Account' : 'Sign In Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* TABS SELECTOR BAR */}
          <div className="max-w-6xl w-full mx-auto px-4 md:px-6 pt-5 pb-1 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 bg-[#0e1630] border border-[#1e2942] p-1 rounded-xl">
              <button
                id="tab-study-console"
                onClick={() => setViewMode('console')}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
                  viewMode === 'console'
                    ? 'bg-blue-600/20 text-blue-400 font-extrabold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" /> Study Console
              </button>
              <button
                id="tab-yearly-report"
                onClick={() => setViewMode('report')}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
                  viewMode === 'report'
                    ? 'bg-emerald-600/20 text-emerald-400 font-extrabold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> Report
              </button>
            </div>
            
            {/* Streak/active dates indicator on the right */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#0e1630] border border-[#1e2942] rounded-xl text-[11px] font-mono text-slate-400">
              <Flame className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
              <span>Active Dates: <span className="text-orange-400 font-bold">{activeDatesCount} Dates</span></span>
            </div>
          </div>

          {/* MAIN LAYOUT CONTAINER */}
          <main className="max-w-6xl w-full mx-auto px-4 md:px-6 py-6 flex-1 flex flex-col gap-6">
            
            {viewMode === 'report' ? (
              <YearlyReport
                sessions={sessions}
                onBackToDashboard={() => setViewMode('console')}
                onDeleteSession={handleDeleteSession}
                readOnly={!!shareUserId}
              />
            ) : (
              <>
                {/* GERMAN FOCUSED POMODORO TIMER WIDGET (SOBBAR OPORE) */}
            <div className="w-full max-w-2xl mx-auto">
              <Timer
                selectedDate={selectedDate}
                onTimerComplete={(category, mins) => {
                  handleAddSession({
                    date: selectedDate,
                    category,
                    durationMinutes: mins,
                    notes: `Successfully completed a ${mins}-minute study session in category: ${category}.`,
                  });
                }}
                readOnly={!!shareUserId}
              />
            </div>

        {/* TWO-COLUMN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          {/* LEFT COLUMN: PRIMARY DASHBOARD DISPLAY (Lg: 8 cols) */}
          <div className="lg:col-span-8 space-y-6 flex flex-col justify-between">
          
          {/* THE 4 GERMAN COMPETENCIES BENTO ROW */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
              <h3 className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                The 4 Core Study Competencies
              </h3>
              <div className="flex items-center gap-2">
                <div className="text-[10px] text-slate-400 bg-[#0e1630] border border-[#1e2942] px-2.5 py-0.5 rounded-md font-medium">
                  Goal: 6h, 30m
                </div>
                <div className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-md font-semibold font-mono">
                  Today: {totalHours}h {totalMinsLeft.toString().padStart(2, '0')}m ({selectedDateSessions.length} Sess.)
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:gap-6">
              {/* SPRECHEN */}
              <div className="bg-[#0e1630] border border-[#1e2942] rounded-2xl p-5 sm:p-6 md:p-7 flex flex-col justify-between hover:border-blue-500/30 transition-all shadow-sm relative overflow-hidden group min-h-[140px] sm:min-h-[170px] md:min-h-[190px]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all" />
                <div className="flex items-center justify-between z-10">
                  <span className="text-[10px] sm:text-xs font-bold text-blue-400 font-mono tracking-wider">🗣️ SPEAKING</span>
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-blue-500" />
                </div>
                <div className="mt-4 md:mt-6 z-10">
                  <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-black text-slate-100 font-mono">
                    {Math.floor(sprechenMinutes / 60) > 0 ? `${Math.floor(sprechenMinutes / 60)}h ` : ''}{sprechenMinutes % 60}m
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-500 mt-2 flex justify-between">
                    <span>Progress</span>
                    <span>{Math.round((sprechenMinutes / 30) * 100)}%</span>
                  </div>
                </div>
                <div className="w-full h-1.5 sm:h-2 bg-[#060b1e] rounded-full overflow-hidden mt-4 z-10">
                  <div className="h-full bg-blue-500 transition-all duration-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" style={{ width: `${Math.min(100, (sprechenMinutes / 30) * 100)}%` }} />
                </div>
              </div>

              {/* LESEN */}
              <div className="bg-[#0e1630] border border-[#1e2942] rounded-2xl p-5 sm:p-6 md:p-7 flex flex-col justify-between hover:border-emerald-500/30 transition-all shadow-sm relative overflow-hidden group min-h-[140px] sm:min-h-[170px] md:min-h-[190px]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />
                <div className="flex items-center justify-between z-10">
                  <span className="text-[10px] sm:text-xs font-bold text-emerald-400 font-mono tracking-wider">📖 READING</span>
                  <Eye className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-emerald-500" />
                </div>
                <div className="mt-4 md:mt-6 z-10">
                  <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-black text-slate-100 font-mono">
                    {Math.floor(lesenMinutes / 60) > 0 ? `${Math.floor(lesenMinutes / 60)}h ` : ''}{lesenMinutes % 60}m
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-500 mt-2 flex justify-between">
                    <span>Progress</span>
                    <span>{Math.round((lesenMinutes / 30) * 100)}%</span>
                  </div>
                </div>
                <div className="w-full h-1.5 sm:h-2 bg-[#060b1e] rounded-full overflow-hidden mt-4 z-10">
                  <div className="h-full bg-emerald-500 transition-all duration-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" style={{ width: `${Math.min(100, (lesenMinutes / 30) * 100)}%` }} />
                </div>
              </div>

              {/* SCHREIBEN */}
              <div className="bg-[#0e1630] border border-[#1e2942] rounded-2xl p-5 sm:p-6 md:p-7 flex flex-col justify-between hover:border-amber-500/30 transition-all shadow-sm relative overflow-hidden group min-h-[140px] sm:min-h-[170px] md:min-h-[190px]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all" />
                <div className="flex items-center justify-between z-10">
                  <span className="text-[10px] sm:text-xs font-bold text-amber-400 font-mono tracking-wider">✍️ WRITING</span>
                  <Edit3 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-amber-500" />
                </div>
                <div className="mt-4 md:mt-6 z-10">
                  <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-black text-slate-100 font-mono">
                    {Math.floor(schreibenMinutes / 60) > 0 ? `${Math.floor(schreibenMinutes / 60)}h ` : ''}{schreibenMinutes % 60}m
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-500 mt-2 flex justify-between">
                    <span>Progress</span>
                    <span>{Math.round((schreibenMinutes / 30) * 100)}%</span>
                  </div>
                </div>
                <div className="w-full h-1.5 sm:h-2 bg-[#060b1e] rounded-full overflow-hidden mt-4 z-10">
                  <div className="h-full bg-amber-500 transition-all duration-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" style={{ width: `${Math.min(100, (schreibenMinutes / 30) * 100)}%` }} />
                </div>
              </div>

              {/* HÖREN */}
              <div className="bg-[#0e1630] border border-[#1e2942] rounded-2xl p-5 sm:p-6 md:p-7 flex flex-col justify-between hover:border-purple-500/30 transition-all shadow-sm relative overflow-hidden group min-h-[140px] sm:min-h-[170px] md:min-h-[190px]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all" />
                <div className="flex items-center justify-between z-10">
                  <span className="text-[10px] sm:text-xs font-bold text-purple-400 font-mono tracking-wider">🎧 LISTENING</span>
                  <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-purple-500" />
                </div>
                <div className="mt-4 md:mt-6 z-10">
                  <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-black text-slate-100 font-mono">
                    {Math.floor(hoerenMinutes / 60) > 0 ? `${Math.floor(hoerenMinutes / 60)}h ` : ''}{hoerenMinutes % 60}m
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-500 mt-2 flex justify-between">
                    <span>Progress</span>
                    <span>{Math.round((hoerenMinutes / 30) * 100)}%</span>
                  </div>
                </div>
                <div className="w-full h-1.5 sm:h-2 bg-[#060b1e] rounded-full overflow-hidden mt-4 z-10">
                  <div className="h-full bg-purple-500 transition-all duration-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" style={{ width: `${Math.min(100, (hoerenMinutes / 30) * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* WEEKLY CALENDAR TIMELINE CHART */}
          <div id="progress-trend-card" className="bg-[#0e1630] border border-[#1e2942] rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                  Weekly Study Progress
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Your study progress mapped across the dates timeline</p>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-[10px] font-semibold uppercase tracking-wider font-mono">
                Total Active: {activeDatesCount} Dates
              </div>
            </div>
            <div className="h-[180px] sm:h-[220px]">
              <ProgressChart
                sessions={sessions}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: CALENDAR SELECTOR, SESSIONS LOG (Lg: 4 cols) */}
        <div className="lg:col-span-4 space-y-6 flex flex-col">
          
          {/* DATE PICKER & ACTIVE DATE NAVIGATION */}
          <div className="bg-[#0e1630] border border-[#1e2942] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-display font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-400" /> Date Navigator
                </h3>
                <p className="text-xs text-slate-400">Select any date to view and track</p>
              </div>
            </div>
            
            {/* Styled input date selector */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-3 bg-slate-950/60 p-3 rounded-xl border border-[#1e2942] hover:border-slate-700 transition-colors">
                <span className="text-xs text-slate-400 font-mono">Date Picker:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-slate-200 font-mono focus:outline-none cursor-pointer scheme-dark"
                />
              </div>
              <button
                onClick={() => setSelectedDate(getTodayString())}
                className="px-3.5 py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer font-mono"
                title="Jump to Today"
              >
                Today
              </button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">Recently Active Dates</span>
              <div className="flex flex-wrap gap-1.5 max-h-[105px] overflow-y-auto pr-1">
                {(() => {
                  // Find unique dates, sort descending
                  const uniqueDates = (Array.from(new Set(sessions.map(s => s.date))) as string[]).sort().reverse();
                  if (uniqueDates.length === 0) {
                    return <span className="text-xs text-slate-500">No dates recorded yet</span>;
                  }
                  return uniqueDates.slice(0, 10).map(date => {
                    const isSelected = date === selectedDate;
                    const lbl = formatLocalDate(date, { month: 'short', day: 'numeric' });
                    return (
                      <button
                        key={date}
                        onClick={() => setSelectedDate(date)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border ${
                          isSelected
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                            : 'bg-slate-950/40 text-slate-400 border-[#1e2942] hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {lbl}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* SESSIONS DETAILED LOGS FOR SELECTED DATE */}
          <div id="sessions-log-container" className="bg-[#0e1630] border border-[#1e2942] rounded-2xl p-5 flex flex-col flex-1 min-h-[300px]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-display font-semibold text-slate-200 uppercase tracking-wider">
                  {formatLocalDate(selectedDate, { month: 'short', day: 'numeric', year: 'numeric' })} Sessions
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Activity logs for the selected date</p>
              </div>
              {!shareUserId && (
                <button
                  id="btn-open-session-logger"
                  onClick={() => setShowLogger(true)}
                  className="py-1 px-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 hover:bg-blue-500/15 transition-all text-xs font-semibold flex items-center gap-1"
                  title="Log manual session"
                >
                  <Plus className="w-3.5 h-3.5" /> Log Session
                </button>
              )}
            </div>

            {selectedDateSessions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                <HelpCircle className="w-8 h-8 text-slate-600 mb-2" />
                <span className="text-xs font-semibold text-slate-400">No entries found</span>
                <p className="text-[10px] text-slate-500 max-w-[180px] mt-1">
                  Start the timer or log a session manually to begin.
                </p>
              </div>
            ) : (
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[320px] pr-1" id="sessions-scrollable-list">
                {selectedDateSessions.map((session) => (
                  <div
                    key={session.id}
                    className="group relative p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-xl hover:border-slate-700 transition-all flex flex-col"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md flex items-center gap-1 ${
                        session.category === 'Speaking'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : session.category === 'Reading'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : session.category === 'Writing'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      }`}>
                        {session.category === 'Speaking' && <MessageSquare className="w-3 h-3" />}
                        {session.category === 'Reading' && <Eye className="w-3 h-3" />}
                        {session.category === 'Writing' && <Edit3 className="w-3 h-3" />}
                        {session.category === 'Listening' && <Volume2 className="w-3 h-3" />}
                        {session.category}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-semibold text-slate-400">
                          {Math.floor(session.durationMinutes / 60) > 0 ? `${Math.floor(session.durationMinutes / 60)}h ` : ''}
                          {session.durationMinutes % 60}m
                        </span>
                        {!shareUserId && (
                          <button
                            onClick={() => handleDeleteSession(session.id)}
                            className="p-1 rounded bg-slate-900 border border-slate-800 hover:border-red-500/40 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Delete session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DANGER CONTROL PANEL (RESET TRACKER) */}
          {!shareUserId && (
            <div className="mt-2 text-right">
              {showResetConfirm ? (
                <div className="bg-red-950/25 border border-red-950/80 p-3 rounded-xl flex items-center justify-between text-xs text-slate-300 text-left">
                  <span>Are you sure you want to reset all tracking data? This cannot be undone.</span>
                  <div className="flex gap-2 ml-2 shrink-0">
                    <button
                      onClick={handleResetChallenge}
                      className="px-2 py-1 bg-red-600 text-slate-100 rounded hover:bg-red-500 font-semibold"
                    >
                      Yes, clear
                    </button>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="px-2 py-1 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  id="btn-trigger-reset"
                  onClick={() => setShowResetConfirm(true)}
                  className="text-[10px] font-mono font-semibold text-slate-600 hover:text-red-400/80 transition-all uppercase tracking-widest flex items-center gap-1 ml-auto"
                >
                  <RefreshCw className="w-3 h-3" /> Reset Tracker
                </button>
              )}
            </div>
          )}

        </div>

      </div>
      
      </>
      )}

      </main>
      </>
      )}

      {/* FOOTER */}
      <footer className="max-w-6xl w-full mx-auto px-4 md:px-6 py-6 mt-8 border-t border-[#111a36]/60 text-center text-slate-500 text-xs flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
        <span>© 2026 Study Tracker. Build consistent learning habits.</span>
        <span className="font-mono text-[10px]">Sleek, Minimalist Study Tracking Console</span>
      </footer>

      {/* DIALOG POPUP: MANUAL SESSION LOGGER */}
      {showLogger && (
        <SessionLogger
          selectedDate={selectedDate}
          onAddSession={handleAddSession}
          onClose={() => setShowLogger(false)}
        />
      )}

    </div>
  );
}
