/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Check, Sparkles, Brain, BookOpen, RotateCw, Volume2, MessageSquare, Edit3, Eye } from 'lucide-react';
import { formatLocalDate } from '../utils';

interface TimerProps {
  onTimerComplete: (category: 'Speaking' | 'Reading' | 'Writing' | 'Listening', durationMinutes: number) => void;
  selectedDate: string;
  readOnly?: boolean;
}

type TimerCategory = 'Speaking' | 'Reading' | 'Writing' | 'Listening';

export default function Timer({ onTimerComplete, selectedDate, readOnly = false }: TimerProps) {
  const [category, setCategory] = useState<TimerCategory>(() => {
    try {
      const saved = localStorage.getItem('timer_active_category');
      return (saved as TimerCategory) || 'Speaking';
    } catch (e) {
      return 'Speaking';
    }
  });

  const [duration, setDuration] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('timer_custom_duration');
      return saved ? Math.max(1, Math.min(720, parseInt(saved, 10))) : 20;
    } catch (e) {
      return 20;
    }
  }); // in minutes

  const [timeLeft, setTimeLeft] = useState<number>(() => {
    try {
      const savedDuration = localStorage.getItem('timer_custom_duration');
      const defaultSeconds = (savedDuration ? Math.max(1, Math.min(720, parseInt(savedDuration, 10))) : 20) * 60;
      
      const savedIsRunning = localStorage.getItem('timer_is_running') === 'true';
      const savedSecondsLeft = localStorage.getItem('timer_seconds_left');
      const savedStartedAt = localStorage.getItem('timer_started_at');

      if (savedSecondsLeft) {
        const parsedSecondsLeft = parseInt(savedSecondsLeft, 10);
        if (savedIsRunning && savedStartedAt) {
          const elapsedSeconds = Math.floor((Date.now() - parseInt(savedStartedAt, 10)) / 1000);
          const remaining = parsedSecondsLeft - elapsedSeconds;
          return Math.max(0, remaining);
        }
        return Math.max(0, parsedSecondsLeft);
      }
      return defaultSeconds;
    } catch (e) {
      return 20 * 60;
    }
  }); // in seconds

  const [isRunning, setIsRunning] = useState<boolean>(() => {
    try {
      const savedIsRunning = localStorage.getItem('timer_is_running') === 'true';
      if (!savedIsRunning) return false;

      const savedSecondsLeft = localStorage.getItem('timer_seconds_left');
      const savedStartedAt = localStorage.getItem('timer_started_at');
      if (savedSecondsLeft && savedStartedAt) {
        const elapsedSeconds = Math.floor((Date.now() - parseInt(savedStartedAt, 10)) / 1000);
        const remaining = parseInt(savedSecondsLeft, 10) - elapsedSeconds;
        return remaining > 0;
      }
      return false;
    } catch (e) {
      return false;
    }
  });

  const [isCompleted, setIsCompleted] = useState<boolean>(() => {
    try {
      const savedIsRunning = localStorage.getItem('timer_is_running') === 'true';
      if (savedIsRunning) {
        const savedSecondsLeft = localStorage.getItem('timer_seconds_left');
        const savedStartedAt = localStorage.getItem('timer_started_at');
        if (savedSecondsLeft && savedStartedAt) {
          const elapsedSeconds = Math.floor((Date.now() - parseInt(savedStartedAt, 10)) / 1000);
          const remaining = parseInt(savedSecondsLeft, 10) - elapsedSeconds;
          return remaining <= 0;
        }
      }
      return localStorage.getItem('timer_is_completed') === 'true';
    } catch (e) {
      return false;
    }
  });
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastResumeTimeRef = useRef<number>(0);
  const secondsAtLastResumeRef = useRef<number>(0);

  // Save custom duration to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('timer_custom_duration', duration.toString());
    } catch (e) {
      console.error('Failed to save custom duration to localStorage:', e);
    }
  }, [duration]);

  // Save category to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('timer_active_category', category);
    } catch (e) {
      console.error(e);
    }
  }, [category]);

  // Initialize refs on mount if timer is running
  useEffect(() => {
    try {
      const savedIsRunning = localStorage.getItem('timer_is_running') === 'true';
      const savedSecondsLeft = localStorage.getItem('timer_seconds_left');
      const savedStartedAt = localStorage.getItem('timer_started_at');
      
      if (savedIsRunning && savedSecondsLeft && savedStartedAt) {
        lastResumeTimeRef.current = parseInt(savedStartedAt, 10);
        secondsAtLastResumeRef.current = parseInt(savedSecondsLeft, 10);
      }
    } catch (e) {}
  }, []);

  // Sync state if duration presets change
  const setPreset = (cat: TimerCategory, mins: number) => {
    setCategory(cat);
    setDuration(mins);
    setTimeLeft(mins * 60);
    setIsRunning(false);
    setIsCompleted(false);

    lastResumeTimeRef.current = 0;
    secondsAtLastResumeRef.current = 0;

    try {
      localStorage.setItem('timer_is_running', 'false');
      localStorage.setItem('timer_is_completed', 'false');
      localStorage.setItem('timer_seconds_left', (mins * 60).toString());
      localStorage.removeItem('timer_started_at');
    } catch (e) {}
  };

  useEffect(() => {
    if (isRunning) {
      if (lastResumeTimeRef.current === 0) {
        lastResumeTimeRef.current = Date.now();
        secondsAtLastResumeRef.current = timeLeft;
      }

      timerRef.current = setInterval(() => {
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - lastResumeTimeRef.current) / 1000);
        const remaining = secondsAtLastResumeRef.current - elapsedSeconds;
        
        if (remaining <= 0) {
          setTimeLeft(0);
          setIsRunning(false);
          setIsCompleted(true);
          playNotificationSound();
          
          try {
            localStorage.setItem('timer_is_running', 'false');
            localStorage.setItem('timer_is_completed', 'true');
            localStorage.setItem('timer_seconds_left', '0');
            localStorage.removeItem('timer_started_at');
          } catch (e) {}
          
          if (timerRef.current) clearInterval(timerRef.current);
        } else {
          setTimeLeft(remaining);
          try {
            localStorage.setItem('timer_seconds_left', remaining.toString());
          } catch (e) {}
        }
      }, 500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const playNotificationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const playTone = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gainNode.gain.setValueAtTime(0.15, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      // Elegant, sparkling four-note chime (C5 -> E5 -> G5 -> C6)
      playTone(523.25, now, 0.5); // C5
      playTone(659.25, now + 0.1, 0.5); // E5
      playTone(783.99, now + 0.2, 0.6); // G5
      playTone(1046.50, now + 0.3, 0.8); // C6
    } catch (e) {
      console.error('Failed to play notification sound:', e);
    }
  };

  const handleToggle = () => {
    const nextIsRunning = !isRunning;
    setIsRunning(nextIsRunning);
    
    try {
      localStorage.setItem('timer_is_running', nextIsRunning ? 'true' : 'false');
      localStorage.setItem('timer_is_completed', 'false');
      if (nextIsRunning) {
        const now = Date.now();
        lastResumeTimeRef.current = now;
        secondsAtLastResumeRef.current = timeLeft;
        
        localStorage.setItem('timer_started_at', now.toString());
        localStorage.setItem('timer_seconds_left', timeLeft.toString());
      } else {
        localStorage.setItem('timer_seconds_left', timeLeft.toString());
        localStorage.removeItem('timer_started_at');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(duration * 60);
    setIsCompleted(false);

    lastResumeTimeRef.current = 0;
    secondsAtLastResumeRef.current = 0;

    try {
      localStorage.setItem('timer_is_running', 'false');
      localStorage.setItem('timer_is_completed', 'false');
      localStorage.setItem('timer_seconds_left', (duration * 60).toString());
      localStorage.removeItem('timer_started_at');
    } catch (e) {}
  };

  const handleSaveSession = () => {
    onTimerComplete(category, duration);
    setIsCompleted(false);
    const initialSeconds = duration * 60;
    setTimeLeft(initialSeconds);

    lastResumeTimeRef.current = 0;
    secondsAtLastResumeRef.current = 0;

    try {
      localStorage.setItem('timer_is_running', 'false');
      localStorage.setItem('timer_is_completed', 'false');
      localStorage.setItem('timer_seconds_left', initialSeconds.toString());
      localStorage.removeItem('timer_started_at');
    } catch (e) {}
  };

  // UI calculations for circular progress SVG
  const totalSeconds = duration * 60;
  const progressRatio = timeLeft / totalSeconds;
  const strokeDashoffset = 283 * (1 - progressRatio); // Circumference = 2 * pi * r (r=45) => ~283

  const getCategoryColor = (cat: TimerCategory) => {
    switch (cat) {
      case 'Speaking':
        return 'stroke-blue-500';
      case 'Reading':
        return 'stroke-emerald-500';
      case 'Writing':
        return 'stroke-amber-500';
      case 'Listening':
        return 'stroke-purple-500';
    }
  };

  const getCategoryIcon = (cat: TimerCategory) => {
    switch (cat) {
      case 'Speaking':
        return <MessageSquare className="w-4 h-4 text-blue-400" />;
      case 'Reading':
        return <Eye className="w-4 h-4 text-emerald-400" />;
      case 'Writing':
        return <Edit3 className="w-4 h-4 text-amber-400" />;
      case 'Listening':
        return <Volume2 className="w-4 h-4 text-purple-400" />;
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatMinutesToHoursMins = (totalMins: number) => {
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins > 0 ? `${mins}m` : ''}`;
    }
    return `${totalMins} Mins`;
  };

  return (
    <div id="focus-timer-container" className="bg-[#0e1630] border border-[#1e2942] rounded-2xl p-6 flex flex-col items-center">
      <div className="w-full flex flex-col mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 id="timer-title" className="text-sm font-display font-semibold text-slate-200 tracking-wide uppercase">
              Session Timer
            </h3>
            <button
              onClick={playNotificationSound}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center"
              title="Test completion chime"
            >
              <Volume2 className="w-3.5 h-3.5 text-blue-400" />
            </button>
          </div>
          <p className="text-xs text-slate-400">Track {formatLocalDate(selectedDate, { month: 'short', day: 'numeric' })}</p>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mt-3 w-full">
          <button
            id="preset-sprechen"
            disabled={readOnly}
            onClick={() => setPreset('Speaking', 15)}
            className={`px-2 py-1 text-xs rounded-lg border font-semibold transition-all flex items-center justify-center gap-1 ${
              category === 'Speaking' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : 'bg-transparent text-slate-400 border-slate-800 hover:border-slate-700'
            } ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <MessageSquare className="w-3 h-3" /> Speaking
          </button>
          <button
            id="preset-lesen"
            disabled={readOnly}
            onClick={() => setPreset('Reading', 20)}
            className={`px-2 py-1 text-xs rounded-lg border font-semibold transition-all flex items-center justify-center gap-1 ${
              category === 'Reading' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-transparent text-slate-400 border-slate-800 hover:border-slate-700'
            } ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Eye className="w-3 h-3" /> Reading
          </button>
          <button
            id="preset-schreiben"
            disabled={readOnly}
            onClick={() => setPreset('Writing', 25)}
            className={`px-2 py-1 text-xs rounded-lg border font-semibold transition-all flex items-center justify-center gap-1 ${
              category === 'Writing' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-transparent text-slate-400 border-slate-800 hover:border-slate-700'
            } ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Edit3 className="w-3 h-3" /> Writing
          </button>
          <button
            id="preset-hoeren"
            disabled={readOnly}
            onClick={() => setPreset('Listening', 10)}
            className={`px-2 py-1 text-xs rounded-lg border font-semibold transition-all flex items-center justify-center gap-1 ${
              category === 'Listening' ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' : 'bg-transparent text-slate-400 border-slate-800 hover:border-slate-700'
            } ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Volume2 className="w-3 h-3" /> Listening
          </button>
        </div>
      </div>

      <div className="relative w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center mb-6">
        {/* SVG Circular Progress */}
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            className="stroke-slate-800/60"
            strokeWidth="5"
            fill="transparent"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            className={`transition-all duration-300 ${getCategoryColor(category)}`}
            strokeWidth="5"
            fill="transparent"
            strokeDasharray="283"
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        <div className="absolute flex flex-col items-center justify-center">
          {isCompleted ? (
            <div className="flex flex-col items-center text-center px-4 animate-bounce">
              <Sparkles className="w-6 h-6 text-yellow-400 mb-1" />
              <span className="text-xs font-semibold text-emerald-400">Completed!</span>
            </div>
          ) : (
            <>
              <span 
                id="timer-countdown" 
                className={`font-mono font-bold text-slate-100 tracking-tight transition-all ${
                  timeLeft >= 3600 ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'
                }`}
              >
                {formatTime(timeLeft)}
              </span>
              <span className="text-[10px] text-slate-400 mt-1.5 uppercase tracking-wider font-bold flex items-center gap-1">
                {getCategoryIcon(category)} {category}
              </span>
            </>
          )}
        </div>
      </div>

       {isCompleted ? (
        <button
          id="btn-save-completed-session"
          disabled={readOnly}
          onClick={handleSaveSession}
          className={`w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-900 font-semibold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
            readOnly ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-110 active:scale-[0.98]'
          }`}
        >
          <Check className="w-4 h-4" /> Save {formatMinutesToHoursMins(duration)} Session
        </button>
      ) : (
        <div className="w-full flex gap-3">
          <button
            id="btn-toggle-timer"
            disabled={readOnly}
            onClick={handleToggle}
            className={`flex-1 py-2.5 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
              isRunning
                ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/15'
                : 'bg-[oklch(0.35_0.11_264.71)] text-slate-50'
            } ${readOnly ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-110 active:scale-[0.98]'}`}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4 fill-current" /> Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> Start
              </>
            )}
          </button>
          <button
            id="btn-reset-timer"
            disabled={readOnly}
            onClick={handleReset}
            className={`p-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl transition-all ${
              readOnly ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700'
            }`}
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Manual Duration Changer */}
      <div className="w-full mt-5 pt-4 border-t border-slate-800/80 flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Custom Duration:</span>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1 bg-[#070c1e] px-2 py-1 rounded border border-[#1e2942] ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                id="input-timer-hours"
                type="number"
                min="0"
                max="12"
                disabled={readOnly}
                value={Math.floor(duration / 60)}
                onChange={(e) => {
                  const hrs = Math.max(0, Math.min(12, parseInt(e.target.value) || 0));
                  const mins = duration % 60;
                  const newDuration = Math.max(1, (hrs * 60) + mins);
                  setDuration(newDuration);
                  setTimeLeft(newDuration * 60);
                  setIsRunning(false);
                  setIsCompleted(false);

                  lastResumeTimeRef.current = 0;
                  secondsAtLastResumeRef.current = 0;

                  try {
                    localStorage.setItem('timer_is_running', 'false');
                    localStorage.setItem('timer_is_completed', 'false');
                    localStorage.setItem('timer_seconds_left', (newDuration * 60).toString());
                    localStorage.removeItem('timer_started_at');
                  } catch (err) {}
                }}
                className={`w-8 bg-transparent text-slate-100 text-center focus:outline-none font-mono text-xs font-bold ${readOnly ? 'cursor-not-allowed' : ''}`}
              />
              <span className="text-[10px] text-slate-500 uppercase font-mono font-bold">h</span>
            </div>
            
            <div className={`flex items-center gap-1 bg-[#070c1e] px-2 py-1 rounded border border-[#1e2942] ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                id="input-timer-minutes"
                type="number"
                min="0"
                max="59"
                disabled={readOnly}
                value={duration % 60}
                onChange={(e) => {
                  const mins = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                  const hrs = Math.floor(duration / 60);
                  const newDuration = Math.max(1, (hrs * 60) + mins);
                  setDuration(newDuration);
                  setTimeLeft(newDuration * 60);
                  setIsRunning(false);
                  setIsCompleted(false);

                  lastResumeTimeRef.current = 0;
                  secondsAtLastResumeRef.current = 0;

                  try {
                    localStorage.setItem('timer_is_running', 'false');
                    localStorage.setItem('timer_is_completed', 'false');
                    localStorage.setItem('timer_seconds_left', (newDuration * 60).toString());
                    localStorage.removeItem('timer_started_at');
                  } catch (err) {}
                }}
                className={`w-8 bg-transparent text-slate-100 text-center focus:outline-none font-mono text-xs font-bold ${readOnly ? 'cursor-not-allowed' : ''}`}
              />
              <span className="text-[10px] text-slate-500 uppercase font-mono font-bold">m</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
