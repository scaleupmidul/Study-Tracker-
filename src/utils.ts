/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Returns today's local date formatted as YYYY-MM-DD.
 */
export function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD date string in the local timezone and returns a Date object.
 * This avoids any off-by-one day shifting caused by UTC parsing.
 */
export function getLocalDateObject(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Formats a YYYY-MM-DD string to a readable format (e.g., "Wed, Jun 24, 2026")
 * without any timezone shifting.
 */
export function formatLocalDate(dateStr: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }): string {
  try {
    const d = getLocalDateObject(dateStr);
    return d.toLocaleDateString('en-US', options);
  } catch (e) {
    return dateStr;
  }
}
