/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  Flame, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Search, 
  BookOpen, 
  Trophy, 
  Sparkles,
  ArrowLeft,
  X,
  Volume2,
  Eye,
  Edit3,
  MessageSquare
} from 'lucide-react';
import { Session } from '../types';
import { formatLocalDate } from '../utils';

interface YearlyReportProps {
  sessions: Session[];
  onBackToDashboard: () => void;
  onDeleteSession?: (id: string | string[]) => void;
  readOnly?: boolean;
}

export default function YearlyReport({ sessions, onBackToDashboard, onDeleteSession, readOnly = false }: YearlyReportProps) {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [clickedDate, setClickedDate] = useState<string | null>(null);
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedYear, selectedCategory, searchQuery]);

  const detailsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (clickedDate && detailsRef.current) {
      setTimeout(() => {
        detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [clickedDate]);

  const months = [
    'January (Jan)', 'February (Feb)', 'March (Mar)', 'April (Apr)', 
    'May (May)', 'June (Jun)', 'July (Jul)', 'August (Aug)', 
    'September (Sep)', 'October (Oct)', 'November (Nov)', 'December (Dec)'
  ];

  const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Helper to check if a year is leap year
  const isLeapYear = (year: number) => {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  };

  // Get total days in a month
  const getDaysInMonth = (year: number, monthIndex: number) => {
    const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return days[monthIndex];
  };

  // Get weekday of the 1st of the month (0 = Sunday, 1 = Monday...)
  const getFirstDayOfMonth = (year: number, monthIndex: number) => {
    return new Date(year, monthIndex, 1).getDay();
  };

  // Filter sessions based on Year, Category, and Search Query
  const filteredSessions = sessions.filter(session => {
    // Extract year from YYYY-MM-DD
    const sessionYear = parseInt(session.date.split('-')[0]);
    if (sessionYear !== selectedYear) return false;

    // Category filter
    if (selectedCategory !== 'All' && session.category !== selectedCategory) return false;

    // Search query filter (search notes or category name)
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const notesMatch = session.notes?.toLowerCase().includes(query) || false;
      const categoryMatch = session.category.toLowerCase().includes(query);
      if (!notesMatch && !categoryMatch) return false;
    }

    return true;
  });

  // Calculate stats based on filtered sessions
  const totalMinutes = filteredSessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const totalHoursStr = (totalMinutes / 60).toFixed(1);

  // Group filtered sessions by date for quick lookup in grid
  const sessionsByDate: { [key: string]: Session[] } = {};
  filteredSessions.forEach(s => {
    if (!sessionsByDate[s.date]) {
      sessionsByDate[s.date] = [];
    }
    sessionsByDate[s.date].push(s);
  });

  // Calculate unique active days in this filtered set
  const activeDaysCount = Object.keys(sessionsByDate).length;

  // Calculate daily average (only counting active days)
  const dailyAverageMins = activeDaysCount > 0 ? Math.round(totalMinutes / activeDaysCount) : 0;

  // Max daily study time
  let peakStudyDay = 'None';
  let peakStudyMinutes = 0;
  Object.entries(sessionsByDate).forEach(([date, daySessions]) => {
    const dayMins = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    if (dayMins > peakStudyMinutes) {
      peakStudyMinutes = dayMins;
      peakStudyDay = date;
    }
  });

  // Get color scale class based on minutes
  const getCellColorClass = (minutes: number) => {
    if (minutes === 0) return 'bg-slate-900/40 border border-slate-950 hover:bg-slate-800/40';
    if (minutes < 30) return 'bg-blue-950/40 border border-blue-900/40 text-blue-400 hover:bg-blue-900/30 hover:border-blue-700/50';
    if (minutes < 90) return 'bg-blue-900/50 border border-blue-800/50 text-blue-300 hover:bg-blue-800/50 hover:border-blue-600/50';
    if (minutes < 180) return 'bg-blue-800/60 border border-blue-600/60 text-blue-200 hover:bg-blue-700/60 hover:border-blue-500/60';
    return 'bg-blue-600/80 border border-blue-400/80 text-white font-bold hover:bg-blue-500';
  };

  // Formatting utility
  const formatDateString = (year: number, monthIndex: number, dayNum: number) => {
    const m = String(monthIndex + 1).padStart(2, '0');
    const d = String(dayNum).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  // Get category icon
  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Speaking': return <Volume2 className="w-3.5 h-3.5 text-blue-400" />;
      case 'Reading': return <Eye className="w-3.5 h-3.5 text-emerald-400" />;
      case 'Writing': return <Edit3 className="w-3.5 h-3.5 text-amber-400" />;
      case 'Listening': return <MessageSquare className="w-3.5 h-3.5 text-purple-400" />;
      default: return <BookOpen className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  // Get sessions for clicked date (regardless of category filter, so we see all on that day)
  const clickedDateSessions = clickedDate 
    ? sessions.filter(s => s.date === clickedDate) 
    : [];

  const clickedDateTotalMins = clickedDateSessions.reduce((sum, s) => sum + s.durationMinutes, 0);

  // Skill breakdown for the clicked date
  const clickedDateSpeakingMins = clickedDateSessions
    .filter(s => s.category === 'Speaking')
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  const clickedDateReadingMins = clickedDateSessions
    .filter(s => s.category === 'Reading')
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  const clickedDateWritingMins = clickedDateSessions
    .filter(s => s.category === 'Writing')
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  const clickedDateListeningMins = clickedDateSessions
    .filter(s => s.category === 'Listening')
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  return (
    <div id="yearly-report-root" className="space-y-6 animate-fade-in">
      
      {/* HEADER CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0e1630] border border-[#1e2942] rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBackToDashboard}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl transition-all text-slate-300"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-lg font-display font-black text-slate-100 flex flex-wrap items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500 shrink-0" /> <span className="shrink-0">Yearly Study Report</span>
            </h2>
            <p className="text-xs text-slate-400">Track and analyze your study sessions throughout the year</p>
          </div>
        </div>

        {/* YEAR NAVIGATOR & FILTERS */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Year selector */}
          <div className="flex items-center bg-slate-950 border border-[#1e2942] rounded-xl overflow-hidden p-1">
            <button 
              onClick={() => setSelectedYear(prev => prev - 1)}
              className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-slate-200 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-mono font-bold text-blue-400">{selectedYear}</span>
            <button 
              onClick={() => setSelectedYear(prev => prev + 1)}
              className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-slate-200 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Search bar */}
          <div className="relative flex-1 min-w-[150px] md:flex-initial">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-[#1e2942] rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* CATEGORY SELECTOR CHIPS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
        {['All', 'Speaking', 'Reading', 'Writing', 'Listening'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border shrink-0 ${
              selectedCategory === cat
                ? 'bg-blue-600/20 border-blue-500 text-blue-400 font-bold'
                : 'bg-[#0e1630] border-[#1e2942] text-slate-400 hover:text-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* STATS BENTO ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total hours */}
        <div className="bg-[#0e1630] border border-[#1e2942] rounded-2xl p-4.5 flex items-center gap-4 hover:border-blue-500/20 transition-all shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">Total Time (Year)</div>
            <div className="text-xl font-display font-black text-slate-100 mt-0.5">{totalHoursStr} Hrs</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{totalMinutes} minutes logged</div>
          </div>
        </div>

        {/* Active Days count */}
        <div className="bg-[#0e1630] border border-[#1e2942] rounded-2xl p-4.5 flex items-center gap-4 hover:border-emerald-500/20 transition-all shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">Active Dates</div>
            <div className="text-xl font-display font-black text-slate-100 mt-0.5">{activeDaysCount} Dates</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{Math.round((activeDaysCount / (isLeapYear(selectedYear) ? 366 : 365)) * 100)}% Annual Rate</div>
          </div>
        </div>

        {/* Daily average */}
        <div className="bg-[#0e1630] border border-[#1e2942] rounded-2xl p-4.5 flex items-center gap-4 hover:border-amber-500/20 transition-all shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">Avg / Active Date</div>
            <div className="text-xl font-display font-black text-slate-100 mt-0.5">{dailyAverageMins} Mins</div>
            <div className="text-[10px] text-slate-400 mt-0.5">per active study date</div>
          </div>
        </div>

        {/* Peak day */}
        <div className="bg-[#0e1630] border border-[#1e2942] rounded-2xl p-4.5 flex items-center gap-4 hover:border-purple-500/20 transition-all shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Trophy className="w-5 h-5 text-yellow-500" />
          </div>
          <div>
            <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">Peak Date</div>
            <div className="text-xl font-display font-black text-slate-100 mt-0.5">
              {peakStudyMinutes > 0 ? `${peakStudyMinutes} Mins` : 'None'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
              {peakStudyDay !== 'None' ? formatLocalDate(peakStudyDay, { month: 'short', day: 'numeric' }) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* GRID LEGEND */}
      <div className="bg-slate-950/40 border border-[#1e2942]/60 rounded-xl px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <span className="font-medium text-slate-300">Habit Color Scale (Study Intensity):</span>
        <div className="flex items-center gap-2">
          <span>Less</span>
          <div className="w-3.5 h-3.5 rounded bg-slate-900/40 border border-slate-950" />
          <div className="w-3.5 h-3.5 rounded bg-blue-950/40 border border-blue-900/40" />
          <div className="w-3.5 h-3.5 rounded bg-blue-900/50 border border-blue-800/50" />
          <div className="w-3.5 h-3.5 rounded bg-blue-800/60 border border-blue-600/60" />
          <div className="w-3.5 h-3.5 rounded bg-blue-600/80 border border-blue-400/80" />
          <span>More</span>
        </div>
      </div>

      {/* 12-MONTHS BENTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {months.map((monthName, mIdx) => {
          const daysCount = getDaysInMonth(selectedYear, mIdx);
          const startDayOfWeek = getFirstDayOfMonth(selectedYear, mIdx);
          const blankCells = Array.from({ length: startDayOfWeek });
          const dayCells = Array.from({ length: daysCount });

          return (
            <div 
              key={monthName}
              className="bg-[#0e1630] border border-[#1e2942] rounded-2xl p-4 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              {/* Month Header */}
              <div className="flex items-center justify-between mb-3.5">
                <span className="text-xs font-bold font-display text-slate-200 tracking-wide">
                  {monthName}
                </span>
                {/* Total monthly duration calculation */}
                <span className="text-[10px] font-mono font-semibold text-slate-500">
                  {(() => {
                    let monthlyMins = 0;
                    for (let d = 1; d <= daysCount; d++) {
                      const dateStr = formatDateString(selectedYear, mIdx, d);
                      if (sessionsByDate[dateStr]) {
                        monthlyMins += sessionsByDate[dateStr].reduce((sum, s) => sum + s.durationMinutes, 0);
                      }
                    }
                    return monthlyMins > 0 ? `${(monthlyMins / 60).toFixed(1)} Hrs` : '0 Hrs';
                  })()}
                </span>
              </div>

              {/* Weekday indicators */}
              <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-mono font-semibold text-slate-500 mb-2">
                {weekdays.map((wd, idx) => (
                  <span key={idx}>{wd}</span>
                ))}
              </div>

              {/* Day grids */}
              <div className="grid grid-cols-7 gap-1">
                {/* Blank days spacing */}
                {blankCells.map((_, bIdx) => (
                  <div key={`blank-${bIdx}`} className="aspect-square opacity-0" />
                ))}

                {/* Day blocks */}
                {dayCells.map((_, dIdx) => {
                  const dayNum = dIdx + 1;
                  const dateStr = formatDateString(selectedYear, mIdx, dayNum);
                  const daySessions = sessionsByDate[dateStr] || [];
                  const dayMins = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
                  const isDateSelected = clickedDate === dateStr;

                  return (
                    <button
                      key={`day-${dayNum}`}
                      onClick={() => {
                        setClickedDate(isDateSelected ? null : dateStr);
                      }}
                      className={`aspect-square rounded transition-all flex items-center justify-center text-[10px] relative font-mono group ${getCellColorClass(dayMins)} ${
                        isDateSelected ? 'ring-2 ring-blue-400 scale-110 z-10' : ''
                      }`}
                      title={`${formatLocalDate(dateStr, { dateStyle: 'medium' } as any)}: ${dayMins} Mins`}
                    >
                      <span className="opacity-40 group-hover:opacity-100">{dayNum}</span>
                      
                      {/* Interactive indicator dot if sessions logged */}
                      {dayMins > 0 && (
                        <span className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-slate-100 animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* CLICKED DAY SESSIONS PANEL */}
      {clickedDate && (
        <div ref={detailsRef} className="bg-[#0b1226] border border-blue-500/30 rounded-2xl p-6 shadow-xl animate-slide-up space-y-6">
          {/* Panel Header Banner */}
          <div className="relative overflow-hidden bg-gradient-to-r from-blue-950/40 via-[#0e1630] to-indigo-950/40 border border-blue-500/20 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />

            <div className="flex items-start min-w-0 relative z-10">
              <div className="min-w-0">
                <span className="text-[10px] font-mono font-bold tracking-widest text-blue-400 uppercase bg-blue-500/10 px-2.5 py-0.5 rounded-full">
                  Daily Performance & Study Report
                </span>
                <h3 className="text-lg sm:text-xl font-black text-slate-100 font-display tracking-tight mt-1.5 leading-snug">
                  {formatLocalDate(clickedDate, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-3 text-slate-400 text-xs">
                  <span className="bg-[#111a36]/60 text-slate-300 px-3 py-1 rounded-lg border border-[#1e2942] font-medium">
                    Study report for this selected date
                  </span>
                  <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1 rounded-lg font-bold font-mono flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {Math.floor(clickedDateTotalMins / 60)}h {clickedDateTotalMins % 60}m
                  </span>
                  <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg font-bold font-mono">
                    {clickedDateSessions.length} {clickedDateSessions.length === 1 ? 'session' : 'sessions'}
                  </span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setClickedDate(null)}
              className="absolute top-3 right-3 p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition-all border border-[#1e2942]/60 hover:border-slate-700 bg-[#0b1226]/80 backdrop-blur-sm z-20 md:relative md:top-auto md:right-auto"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {clickedDateSessions.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-xs italic bg-slate-950/20 rounded-xl border border-dashed border-slate-800/80">
              No study sessions logged for this date. Select a category on the dashboard or start the timer to log your practice!
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Skill Focus Breakdown (Time Spent) */}
              <div className="bg-[#0e1630] border border-[#1e2942] rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-bold text-slate-300 font-display uppercase tracking-widest flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-blue-400" /> Skill Focus Breakdown (Time Spent)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
                  {/* Speaking Card */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-[#1e2942]/60 hover:border-blue-500/20 transition-colors">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 mb-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-blue-400" /> Speaking
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-200">
                      {Math.floor(clickedDateSpeakingMins / 60)}h {clickedDateSpeakingMins % 60}m
                    </div>
                  </div>

                  {/* Reading Card */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-[#1e2942]/60 hover:border-emerald-500/20 transition-colors">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 mb-1.5">
                      <Eye className="w-3.5 h-3.5 text-emerald-400" /> Reading
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-200">
                      {Math.floor(clickedDateReadingMins / 60)}h {clickedDateReadingMins % 60}m
                    </div>
                  </div>

                  {/* Writing Card */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-[#1e2942]/60 hover:border-amber-500/20 transition-colors">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 mb-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-amber-400" /> Writing
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-200">
                      {Math.floor(clickedDateWritingMins / 60)}h {clickedDateWritingMins % 60}m
                    </div>
                  </div>

                  {/* Listening Card */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-[#1e2942]/60 hover:border-purple-500/20 transition-colors">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 mb-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-purple-400" /> Listening
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-200">
                      {Math.floor(clickedDateListeningMins / 60)}h {clickedDateListeningMins % 60}m
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GENERAL LOG LIST */}
      <div className="bg-[#0e1630] border border-[#1e2942] rounded-2xl p-5 shadow-sm">
        {(() => {
          // Group sessions by date and category
          const groupedLogSessions: Array<{
            id: string;
            ids: string[];
            date: string;
            category: 'Speaking' | 'Reading' | 'Writing' | 'Listening';
            durationMinutes: number;
          }> = [];

          const logGroupMap = new Map<string, typeof groupedLogSessions[0]>();

          filteredSessions.forEach(session => {
            const key = `${session.date}_${session.category}`;
            const existing = logGroupMap.get(key);
            if (existing) {
              existing.durationMinutes += session.durationMinutes;
              existing.ids.push(session.id);
            } else {
              const newGroup = {
                id: session.id,
                ids: [session.id],
                date: session.date,
                category: session.category,
                durationMinutes: session.durationMinutes,
              };
              logGroupMap.set(key, newGroup);
              groupedLogSessions.push(newGroup);
            }
          });

          // Sort by date descending
          groupedLogSessions.sort((a, b) => b.date.localeCompare(a.date));

          // Pagination configuration
          const ITEMS_PER_PAGE = 40;
          const totalItems = groupedLogSessions.length;
          const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
          const safeCurrentPage = Math.min(currentPage, totalPages);
          const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
          const paginatedGroups = groupedLogSessions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

          return (
            <>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1e2942]/60">
                <div>
                  <h3 className="text-sm font-bold text-slate-200 font-display">
                    Chronological Logbook ({selectedYear})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Showing {groupedLogSessions.length} activity entries</p>
                </div>
                <span className="text-xs font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-md">
                  Year {selectedYear}
                </span>
              </div>

              {groupedLogSessions.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs italic">
                  No sessions found matching the filters. Start a new session to add entries!
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#111a36] text-slate-400 font-mono uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Skill Category</th>
                          <th className="py-3 px-4">Duration</th>
                          {onDeleteSession && !readOnly && <th className="py-3 px-4 text-right">Action</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#111a36]/50">
                        {paginatedGroups.map((group) => (
                          <tr 
                            key={`${group.date}-${group.category}`} 
                            className="hover:bg-slate-900/30 transition-colors group cursor-pointer"
                            onClick={() => setClickedDate(group.date)}
                          >
                            <td className="py-3.5 px-4 font-mono font-medium text-slate-300">
                              {formatLocalDate(group.date, { year: 'numeric', month: '2-digit', day: '2-digit' })}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
                                 {getCategoryIcon(group.category)}
                                 {group.category}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-blue-400 font-bold">
                              {Math.floor(group.durationMinutes / 60)}h {(group.durationMinutes % 60).toString().padStart(2, '0')}m
                            </td>
                            {onDeleteSession && !readOnly && (
                              <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                                {deleteConfirmKey === `${group.date}_${group.category}` ? (
                                  <div className="inline-flex items-center gap-1.5 bg-red-950/50 border border-red-500/30 p-1 px-2 rounded-lg shadow-lg animate-fade-in">
                                    <span className="text-[10px] font-semibold text-red-400">Sure?</span>
                                    <button
                                      onClick={() => {
                                        onDeleteSession(group.ids);
                                        setDeleteConfirmKey(null);
                                      }}
                                      className="bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-[9px] px-1.5 py-0.5 rounded transition-all cursor-pointer"
                                    >
                                      YES
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirmKey(null)}
                                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono font-bold text-[9px] px-1.5 py-0.5 rounded transition-all cursor-pointer"
                                    >
                                      NO
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeleteConfirmKey(`${group.date}_${group.category}`)}
                                    className="p-1 text-slate-500 hover:text-red-400 transition-colors opacity-40 group-hover:opacity-100"
                                    title="Delete entire category sessions for this day"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Beautiful Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-4 border-t border-[#1e2942]/60 text-slate-400 text-xs font-mono">
                      <div>
                        Showing <span className="text-slate-200 font-bold">{startIndex + 1}</span> to{' '}
                        <span className="text-slate-200 font-bold">
                          {Math.min(startIndex + ITEMS_PER_PAGE, totalItems)}
                        </span>{' '}
                        of <span className="text-blue-400 font-bold">{totalItems}</span> entries
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={safeCurrentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          className={`p-1.5 rounded-lg border border-[#1e2942] bg-[#070c1e] text-slate-300 transition-all cursor-pointer ${
                            safeCurrentPage === 1
                              ? 'opacity-40 cursor-not-allowed bg-slate-900/10'
                              : 'hover:bg-slate-800/80 hover:text-slate-100 hover:border-blue-500/20'
                          }`}
                          title="Previous Page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        
                        <span className="text-slate-300 px-3 py-1 bg-[#111a36]/40 border border-[#1e2942] rounded-lg">
                          Page <span className="text-blue-400 font-bold">{safeCurrentPage}</span> of{' '}
                          <span className="text-slate-200 font-bold">{totalPages}</span>
                        </span>

                        <button
                          disabled={safeCurrentPage === totalPages}
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          className={`p-1.5 rounded-lg border border-[#1e2942] bg-[#070c1e] text-slate-300 transition-all cursor-pointer ${
                            safeCurrentPage === totalPages
                              ? 'opacity-40 cursor-not-allowed bg-slate-900/10'
                              : 'hover:bg-slate-800/80 hover:text-slate-100 hover:border-blue-500/20'
                          }`}
                          title="Next Page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          );
        })()}
      </div>

    </div>
  );
}
