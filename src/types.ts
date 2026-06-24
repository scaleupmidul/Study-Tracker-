/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  category: 'Speaking' | 'Reading' | 'Writing' | 'Listening';
  durationMinutes: number;
  notes?: string;
  userId?: string;
}

export interface User {
  id: string;
  username: string;
}

export interface FocusStats {
  sessions: Session[];
}


