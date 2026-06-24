/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, X, Sparkles, AlertCircle, MessageSquare, Eye, Edit3, Volume2, Calendar } from 'lucide-react';
import { Session } from '../types';

interface SessionLoggerProps {
  selectedDate: string;
  onAddSession: (session: Omit<Session, 'id'>) => void;
  onClose: () => void;
}

export default function SessionLogger({ selectedDate, onAddSession, onClose }: SessionLoggerProps) {
  const [date, setDate] = useState<string>(selectedDate);
  const [category, setCategory] = useState<'Speaking' | 'Reading' | 'Writing' | 'Listening'>('Speaking');
  const [hours, setHours] = useState<number>(1);
  const [minutes, setMinutes] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const totalMinutes = (hours * 60) + minutes;
    if (totalMinutes <= 0) {
      setError('Duration must be greater than 0 minutes.');
      return;
    }
    if (!date) {
      setError('Please select a valid date.');
      return;
    }

    // Call the callback to store the session
    onAddSession({
      date,
      category,
      durationMinutes: totalMinutes,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div 
        id="session-logger-modal"
        className="w-full max-w-md bg-[#0e1630] border border-[#1e2942] rounded-2xl overflow-hidden shadow-2xl relative"
      >
        <div className="px-6 py-4 border-b border-[#1e2942] flex items-center justify-between">
          <div>
            <h3 className="text-base font-display font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" /> Log Study Session
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Manually log your learning progress</p>
          </div>
          <button 
            id="close-logger"
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          {/* Date & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-blue-400" /> Select Date
              </label>
              <input
                id="logger-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-[#1e2942] rounded-xl text-slate-200 text-sm focus:outline-none focus:border-blue-500 font-mono transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Category</label>
              <select
                id="logger-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-[#1e2942] rounded-xl text-slate-200 text-sm focus:outline-none focus:border-blue-500 font-medium transition-colors"
              >
                <option value="Speaking">Speaking 🗣️</option>
                <option value="Reading">Reading 📖</option>
                <option value="Writing">Writing ✍️</option>
                <option value="Listening">Listening 🎧</option>
              </select>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Duration</label>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 border border-slate-800 rounded-xl">
                <input
                  id="logger-hours"
                  type="number"
                  min="0"
                  max="12"
                  value={hours}
                  onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-transparent text-slate-100 text-center font-mono text-lg focus:outline-none"
                />
                <span className="text-xs text-slate-500 font-medium">Hrs</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 border border-slate-800 rounded-xl">
                <input
                  id="logger-minutes"
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className="w-full bg-transparent text-slate-100 text-center font-mono text-lg focus:outline-none"
                />
                <span className="text-xs text-slate-500 font-medium">Mins</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex gap-3">
            <button
              id="btn-cancel-logger"
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition-all"
            >
              Cancel
            </button>
            <button
              id="btn-submit-logger"
              type="submit"
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-slate-50 font-semibold rounded-xl text-sm transition-all shadow-lg active:scale-[0.98]"
            >
              Save Session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
