import {
  addMinutes,
  addHours,
  addDays,
  addWeeks,
  addMonths,
  endOfMonth,
  isSameDay,
  lastDayOfMonth,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Recurrence pattern types
 */
export type RecurrencePattern =
  | 'minutely'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly';

/**
 * Calculate the next occurrence of a recurring reminder
 * @param currentDate - The current due date (in UTC)
 * @param pattern - The recurrence pattern
 * @param interval - The interval (e.g., 1 for every day, 2 for every 2 days)
 * @param timezone - IANA timezone identifier for maintaining local time consistency
 * @returns Next due date in UTC
 *
 * @example
 * // Daily recurrence
 * const next = calculateNextOccurrence(
 *   new Date('2026-01-15T22:30:00Z'), // 2:30 PM PST
 *   'daily',
 *   1,
 *   'America/Los_Angeles'
 * );
 * // Returns: 2026-01-16T22:30:00Z (same local time, next day)
 */
export function calculateNextOccurrence(
  currentDate: Date,
  pattern: RecurrencePattern,
  interval: number = 1,
  timezone?: string,
): Date {
  if (interval < 1) {
    throw new Error('Interval must be at least 1');
  }

  // If no timezone provided, work in UTC directly
  if (!timezone) {
    return calculateNextOccurrenceUTC(currentDate, pattern, interval);
  }

  // Convert UTC to local timezone
  const localDate = toZonedTime(currentDate, timezone);

  // Calculate next occurrence in local time
  const nextLocalDate = calculateNextOccurrenceUTC(
    localDate,
    pattern,
    interval,
  );

  // Convert back to UTC, preserving the local time
  return fromZonedTime(nextLocalDate, timezone);
}

/**
 * Calculate next occurrence in UTC or local time (no timezone conversion)
 * @internal
 */
function calculateNextOccurrenceUTC(
  currentDate: Date,
  pattern: RecurrencePattern,
  interval: number,
): Date {
  switch (pattern) {
    case 'minutely':
      return calculateMinutelyOccurrence(currentDate, interval);
    case 'hourly':
      return calculateHourlyOccurrence(currentDate, interval);
    case 'daily':
      return calculateDailyOccurrence(currentDate, interval);
    case 'weekly':
      return calculateWeeklyOccurrence(currentDate, interval);
    case 'monthly':
      return calculateMonthlyOccurrence(currentDate, interval);
    default: {
      const exhaustiveCheck: never = pattern;
      throw new Error(
        `Unsupported recurrence pattern: ${String(exhaustiveCheck)}`,
      );
    }
  }
}

/**
 * Calculate next minutely occurrence
 * @param currentDate - Current date
 * @param interval - Number of minutes to add
 * @returns Next occurrence
 *
 * @example
 * calculateMinutelyOccurrence(new Date('2026-01-15T10:00:00'), 1) // 2026-01-15T10:01:00
 * calculateMinutelyOccurrence(new Date('2026-01-15T10:00:00'), 5) // 2026-01-15T10:05:00
 */
function calculateMinutelyOccurrence(
  currentDate: Date,
  interval: number,
): Date {
  return addMinutes(currentDate, interval);
}

/**
 * Calculate next hourly occurrence
 * @param currentDate - Current date
 * @param interval - Number of hours to add
 * @returns Next occurrence
 *
 * @example
 * calculateHourlyOccurrence(new Date('2026-01-15T10:00:00'), 1) // 2026-01-15T11:00:00
 * calculateHourlyOccurrence(new Date('2026-01-15T10:00:00'), 3) // 2026-01-15T13:00:00
 */
function calculateHourlyOccurrence(currentDate: Date, interval: number): Date {
  return addHours(currentDate, interval);
}

/**
 * Calculate next daily occurrence
 * @param currentDate - Current date
 * @param interval - Number of days to add
 * @returns Next occurrence
 *
 * @example
 * calculateDailyOccurrence(new Date('2026-01-15'), 1) // 2026-01-16
 * calculateDailyOccurrence(new Date('2026-01-15'), 2) // 2026-01-17
 */
function calculateDailyOccurrence(currentDate: Date, interval: number): Date {
  return addDays(currentDate, interval);
}

/**
 * Calculate next weekly occurrence
 * @param currentDate - Current date
 * @param interval - Number of weeks to add
 * @returns Next occurrence
 *
 * @example
 * calculateWeeklyOccurrence(new Date('2026-01-15'), 1) // 2026-01-22 (7 days later)
 * calculateWeeklyOccurrence(new Date('2026-01-15'), 2) // 2026-01-29 (14 days later)
 */
function calculateWeeklyOccurrence(currentDate: Date, interval: number): Date {
  return addWeeks(currentDate, interval);
}

/**
 * Calculate next monthly occurrence
 * Handles edge cases like:
 * - Jan 31 → Feb 28/29 (last day of shorter month)
 * - Jan 30 → Feb 28/29 (last day of shorter month)
 * - Feb 29 (leap year) → Mar 29 (non-leap year)
 *
 * @param currentDate - Current date
 * @param interval - Number of months to add
 * @returns Next occurrence
 *
 * @example
 * // Regular case
 * calculateMonthlyOccurrence(new Date('2026-01-15'), 1) // 2026-02-15
 *
 * // Edge case: end of month
 * calculateMonthlyOccurrence(new Date('2026-01-31'), 1) // 2026-02-28 (last day of Feb)
 * calculateMonthlyOccurrence(new Date('2026-01-31'), 2) // 2026-03-31
 */
function calculateMonthlyOccurrence(currentDate: Date, interval: number): Date {
  const currentDay = currentDate.getDate();
  const nextMonth = addMonths(currentDate, interval);
  const lastDayOfNextMonth = lastDayOfMonth(nextMonth);
  const maxDayInNextMonth = lastDayOfNextMonth.getDate();

  // If current day exists in next month, use it
  if (currentDay <= maxDayInNextMonth) {
    return nextMonth;
  }

  // If current day doesn't exist in next month (e.g., Jan 31 → Feb),
  // use the last day of next month
  return lastDayOfNextMonth;
}

/**
 * Check if a date is on the last day of its month
 * @param date - Date to check
 * @returns true if date is the last day of the month
 */
export function isLastDayOfMonth(date: Date): boolean {
  const lastDay = endOfMonth(date);
  return isSameDay(date, lastDay);
}

/**
 * Calculate multiple future occurrences
 * @param startDate - Starting date
 * @param pattern - Recurrence pattern
 * @param interval - Interval
 * @param count - Number of occurrences to generate
 * @param timezone - Optional timezone for local time consistency
 * @returns Array of future occurrence dates
 *
 * @example
 * calculateFutureOccurrences(
 *   new Date('2026-01-15'),
 *   'weekly',
 *   1,
 *   4,
 *   'America/New_York'
 * )
 * // Returns: [2026-01-22, 2026-01-29, 2026-02-05, 2026-02-12]
 */
export function calculateFutureOccurrences(
  startDate: Date,
  pattern: RecurrencePattern,
  interval: number,
  count: number,
  timezone?: string,
): Date[] {
  const occurrences: Date[] = [];
  let currentDate = startDate;

  for (let i = 0; i < count; i++) {
    currentDate = calculateNextOccurrence(
      currentDate,
      pattern,
      interval,
      timezone,
    );
    occurrences.push(currentDate);
  }

  return occurrences;
}

/**
 * Check if a recurring reminder should stop based on end date
 * @param nextDueDate - Next calculated due date
 * @param recurrenceEndDate - Optional end date for recurrence
 * @returns true if recurrence should stop, false if it should continue
 */
export function shouldStopRecurrence(
  nextDueDate: Date,
  recurrenceEndDate?: Date,
): boolean {
  if (!recurrenceEndDate) {
    return false; // No end date, continue indefinitely
  }

  return nextDueDate > recurrenceEndDate;
}
