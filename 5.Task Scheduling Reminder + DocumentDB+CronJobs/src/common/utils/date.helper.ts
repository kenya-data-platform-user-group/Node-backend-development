/**
 * Parse various date formats including AM/PM notation
 * Converts to a Date object that Zod can validate
 */
export function parseFlexibleDate(value: unknown): Date {
  // If already a Date, return it
  if (value instanceof Date) {
    return value;
  }

  // If it's a number (timestamp), convert it
  if (typeof value === 'number') {
    return new Date(value);
  }

  // If not a string, let Zod handle the error
  if (typeof value !== 'string') {
    return new Date(String(value));
  }

  const dateString = value.trim();

  // Handle AM/PM formats
  // Examples: "2025-12-31 2:30 PM", "2025-12-31 10:00 AM"
  const amPmRegex = /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
  const match = dateString.match(amPmRegex);

  if (match) {
    const [, datePart, hourStr, minute, meridiem] = match;
    let hour = parseInt(hourStr, 10);

    // Convert to 24-hour format
    if (meridiem.toUpperCase() === 'PM' && hour !== 12) {
      hour += 12;
    } else if (meridiem.toUpperCase() === 'AM' && hour === 12) {
      hour = 0;
    }

    // Create ISO string: "2025-12-31T14:30:00"
    const isoString = `${datePart}T${hour.toString().padStart(2, '0')}:${minute}:00`;
    return new Date(isoString);
  }

  // Let JavaScript's Date constructor handle other formats
  return new Date(dateString);
}
