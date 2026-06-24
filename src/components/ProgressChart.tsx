/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Session } from '../types';
import { getLocalDateObject, formatLocalDate } from '../utils';

interface ProgressChartProps {
  sessions: Session[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export default function ProgressChart({
  sessions,
  selectedDate,
  onSelectDate,
}: ProgressChartProps) {
  // Let's display the 7 dates leading up to (and including) the selectedDate.
  // This gives a beautiful rolling weekly view of their studies.
  const getPast7Dates = (centerDateStr: string): string[] => {
    const centerDate = getLocalDateObject(centerDateStr);
    const dates: string[] = [];
    for (let i = -5; i <= 1; i++) {
      const d = new Date(centerDate);
      d.setDate(centerDate.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayVal = String(d.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${dayVal}`);
    }
    return dates;
  };

  const chartDates = getPast7Dates(selectedDate);

  // SVG parameters
  const width = 600;
  const height = 200;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Calculate minutes for each date
  const dateMinutes = chartDates.map(date => {
    const mins = sessions
      .filter(s => s.date === date)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    return { date, mins };
  });

  const maxMins = Math.max(...dateMinutes.map(d => d.mins), 60); // min ceiling is 60 mins

  // Grid ticks
  const yTicks = [0, Math.round(maxMins * 0.25), Math.round(maxMins * 0.5), Math.round(maxMins * 0.75), maxMins];
  const gridLinesY = yTicks.map((tick) => {
    const ratio = tick / maxMins;
    const y = paddingTop + chartHeight - ratio * chartHeight;
    return { value: tick, y };
  });

  return (
    <div className="w-full h-full flex flex-col">
      <div className="relative flex-1 min-h-[220px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          id="calendar-progress-svg"
        >
          {/* Defs for gradients and glow filters */}
          <defs>
            <linearGradient id="chartBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="selectedBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#047857" stopOpacity="0.4" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Y Grid Lines & Labels */}
          {gridLinesY.map((line, idx) => (
            <g key={idx} className="opacity-30">
              <line
                x1={paddingLeft}
                y1={line.y}
                x2={width - paddingRight}
                y2={line.y}
                stroke="#1e2942"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={paddingLeft - 12}
                y={line.y + 4}
                fill="#64748b"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                textAnchor="end"
              >
                {line.value}m
              </text>
            </g>
          ))}

          {/* Bars for each of the 7 dates */}
          {dateMinutes.map((item, idx) => {
            const barWidth = 32;
            // X coordinate centered in its segment
            const xSegmentCenter = paddingLeft + (idx / 6) * chartWidth;
            const x = xSegmentCenter - barWidth / 2;
            
            const heightRatio = item.mins / maxMins;
            const barHeight = heightRatio * chartHeight;
            const y = paddingTop + chartHeight - barHeight;

            const isSelected = item.date === selectedDate;
            const dateObj = getLocalDateObject(item.date);
            const formattedLabel = formatLocalDate(item.date, { month: 'short', day: 'numeric' });
            const dayOfWeekLabel = formatLocalDate(item.date, { weekday: 'short' });

            return (
              <g
                key={item.date}
                className="cursor-pointer group"
                onClick={() => onSelectDate(item.date)}
              >
                {/* Transparent hover background trigger area */}
                <rect
                  x={xSegmentCenter - 30}
                  y={paddingTop}
                  width={60}
                  height={chartHeight + 35}
                  fill="transparent"
                />

                {/* Bar outline/glow when active */}
                {isSelected && (
                  <rect
                    x={x - 2}
                    y={y - 2}
                    width={barWidth + 4}
                    height={barHeight + 2}
                    rx="5"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1.5"
                    className="opacity-40 animate-pulse"
                  />
                )}

                {/* Actual Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barHeight, 2)} // ensure at least a tiny sliver is shown
                  rx="4"
                  fill={isSelected ? 'url(#selectedBarGradient)' : 'url(#chartBarGradient)'}
                  className="transition-all duration-300 hover:brightness-125"
                />

                {/* Value tooltip label over the bar */}
                {item.mins > 0 && (
                  <text
                    x={xSegmentCenter}
                    y={y - 6}
                    fill={isSelected ? '#10b981' : '#60a5fa'}
                    fontSize="9"
                    fontFamily="JetBrains Mono, monospace"
                    textAnchor="middle"
                    fontWeight="bold"
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  >
                    {item.mins}m
                  </text>
                )}

                {/* X Axis Date Label */}
                <text
                  x={xSegmentCenter}
                  y={paddingTop + chartHeight + 16}
                  fill={isSelected ? '#10b981' : '#64748b'}
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle"
                  className={isSelected ? 'font-bold' : ''}
                >
                  {formattedLabel}
                </text>
                
                {/* X Axis Day of Week Label */}
                <text
                  x={xSegmentCenter}
                  y={paddingTop + chartHeight + 28}
                  fill={isSelected ? '#34d399' : '#475569'}
                  fontSize="8"
                  fontFamily="Inter, sans-serif"
                  textAnchor="middle"
                  className={isSelected ? 'font-bold' : ''}
                >
                  {dayOfWeekLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="text-center mt-1">
        <span className="font-mono text-[10px] text-slate-500">
          Showing rolling calendar week progress • Click bars to navigate dates
        </span>
      </div>
    </div>
  );
}
