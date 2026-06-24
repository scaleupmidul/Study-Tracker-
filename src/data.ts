/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Session } from './types';

// Seed sessions using German language learning categories
export const INITIAL_SESSIONS: Session[] = [
  {
    id: 's-1-1',
    date: '2026-06-20',
    category: 'Speaking',
    durationMinutes: 180, // 3 hours
    notes: 'Practiced German pronunciation and spoken everyday conversations.',
  },
  {
    id: 's-1-2',
    date: '2026-06-20',
    category: 'Reading',
    durationMinutes: 120, // 2 hours
    notes: 'Read a German newspaper article and highlighted new vocabulary.',
  },
  
  {
    id: 's-2-1',
    date: '2026-06-21',
    category: 'Writing',
    durationMinutes: 240, // 4 hours
    notes: 'Drafted a formal letter and corrected grammatical errors.',
  },
  {
    id: 's-2-2',
    date: '2026-06-21',
    category: 'Listening',
    durationMinutes: 60, // 1 hour
    notes: 'Listened to a German podcast about culture and travel.',
  },

  {
    id: 's-3-1',
    date: '2026-06-22',
    category: 'Speaking',
    durationMinutes: 210, // 3.5 hours
    notes: 'Practiced reading aloud and analyzed speech recordings.',
  },
  {
    id: 's-3-2',
    date: '2026-06-22',
    category: 'Reading',
    durationMinutes: 150, // 2.5 hours
    notes: 'Read short stories and summarized the main themes.',
  },

  {
    id: 's-4-1',
    date: '2026-06-23',
    category: 'Speaking',
    durationMinutes: 120, // 2 hours
    notes: 'Conversational practice and spontaneous response training.',
  },
  {
    id: 's-4-2',
    date: '2026-06-23',
    category: 'Reading',
    durationMinutes: 100, // 1 hr 40 mins
    notes: 'Reading comprehension exercise and active recall of words.',
  },
  {
    id: 's-4-3',
    date: '2026-06-23',
    category: 'Writing',
    durationMinutes: 78, // 1 hr 18 mins
    notes: 'Wrote an essay on a contemporary topic.',
  },
  {
    id: 's-4-4',
    date: '2026-06-23',
    category: 'Listening',
    durationMinutes: 62, // 1 hr 02 mins
    notes: 'Listened to radio reports and took comprehensive notes.',
  }
];
