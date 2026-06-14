import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { parseISO, isValid } from 'date-fns';

/**
 * Validate if a timezone string is a valid IANA timezone identifier
 * @param timezone - IANA timezone string (e.g., 'America/New_York')
 * @returns true if valid, false otherwise
 * @throws Error if timezone is invalid
 */
export function validateTimezone(timezone: string): boolean {
  try {
    // Attempt to format a date in the given timezone
    // If timezone is invalid, this will throw
    formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd');
    return true;
  } catch {
    throw new Error(
      `Invalid timezone: ${timezone}. Must be a valid IANA timezone identifier (e.g., 'America/New_York', 'Europe/London', 'Asia/Tokyo')`,
    );
  }
}

/**
 * Parse a date string in a specific timezone and return UTC Date
 * @param dateString - Date string in various formats
 * @param timezone - IANA timezone identifier
 * @returns Date object in UTC
 *
 * @example
 * parseTimezoneAwareDate('2026-01-15 2:30 PM', 'America/Los_Angeles')
 * // Returns Date object representing 2026-01-15 22:30:00 UTC (PST is UTC-8)
 */
export function parseTimezoneAwareDate(
  dateString: string,
  timezone: string,
): Date {
  validateTimezone(timezone);

  // Handle AM/PM format
  const amPmRegex = /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
  const match = dateString.match(amPmRegex);

  let localDateString: string;

  if (match) {
    const [, datePart, hourStr, minute, meridiem] = match;
    let hour = parseInt(hourStr, 10);

    // Convert to 24-hour format
    if (meridiem.toUpperCase() === 'PM' && hour !== 12) {
      hour += 12;
    } else if (meridiem.toUpperCase() === 'AM' && hour === 12) {
      hour = 0;
    }

    localDateString = `${datePart}T${hour.toString().padStart(2, '0')}:${minute}:00`;
  } else {
    // For other formats, try parsing as-is
    localDateString = dateString;
  }

  // Parse the date string as a local date
  const parsedDate = parseISO(localDateString);

  if (!isValid(parsedDate)) {
    throw new Error(`Invalid date string: ${dateString}`);
  }

  // Convert from the specified timezone to UTC
  return convertToUTC(parsedDate, timezone);
}

/**
 * Convert a local date in a specific timezone to UTC
 * @param date - Date object representing local time
 * @param timezone - IANA timezone identifier
 * @returns Date object in UTC
 *
 * @example
 * const localDate = new Date('2026-01-15T14:30:00'); // Treated as local time
 * convertToUTC(localDate, 'America/New_York')
 * // Returns UTC equivalent of 2:30 PM EST/EDT
 */
export function convertToUTC(date: Date, timezone: string): Date {
  validateTimezone(timezone);

  // fromZonedTime treats the input date as if it were in the specified timezone
  // and returns the equivalent UTC date
  return fromZonedTime(date, timezone);
}

/**
 * Convert a UTC date to a specific timezone
 * @param utcDate - Date object in UTC
 * @param timezone - IANA timezone identifier
 * @returns Date object representing the same instant in the target timezone
 *
 * @example
 * const utcDate = new Date('2026-01-15T22:30:00Z');
 * convertFromUTC(utcDate, 'America/Los_Angeles')
 * // Returns Date object showing 2:30 PM PST
 */
export function convertFromUTC(utcDate: Date, timezone: string): Date {
  validateTimezone(timezone);

  // toZonedTime converts a UTC date to the specified timezone
  return toZonedTime(utcDate, timezone);
}

/**
 * Get the current date/time in a specific timezone
 * @param timezone - IANA timezone identifier
 * @returns Date object representing current time in the target timezone
 */
export function getCurrentTimeInTimezone(timezone: string): Date {
  validateTimezone(timezone);
  return toZonedTime(new Date(), timezone);
}

/**
 * Format a date in a specific timezone
 * @param date - Date object
 * @param timezone - IANA timezone identifier
 * @param format - Date format string (date-fns format)
 * @returns Formatted date string
 */
export function formatDateInTimezone(
  date: Date,
  timezone: string,
  format: string = 'yyyy-MM-dd HH:mm:ss',
): string {
  validateTimezone(timezone);
  return formatInTimeZone(date, timezone, format);
}
