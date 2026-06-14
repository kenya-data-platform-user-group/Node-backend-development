# 🔁 Recurring Reminders Guide

This guide explains how to use recurring reminders in the Task Scheduling Reminder application.

## Table of Contents

- [Overview](#overview)
- [Recurrence Patterns](#recurrence-patterns)
- [Creating Recurring Reminders](#creating-recurring-reminders)
- [How It Works](#how-it-works)
- [Intervals](#intervals)
- [End Dates](#end-dates)
- [Timezone Handling](#timezone-handling)
- [Edge Cases](#edge-cases)
- [Monitoring Recurring Reminders](#monitoring-recurring-reminders)
- [FAQ](#faq)

---

## Overview

Recurring reminders allow you to create reminders that repeat automatically on a schedule. Instead of creating the same reminder manually every day, week, or month, you can configure it once and let the system handle the repetition.

**Key benefits:**
- Eliminate manual repetition
- Ensure consistency
- Automatic timezone handling
- Track occurrence count
- Optional end dates

---

## Recurrence Patterns

The system supports three recurrence patterns:

| Pattern | Description | Use Cases |
|---------|-------------|-----------|
| **`daily`** | Repeats every day or every N days | Daily standup, daily report, medication reminders |
| **`weekly`** | Repeats every week or every N weeks | Weekly meeting, weekly review, weekly backups |
| **`monthly`** | Repeats every month or every N months | Rent payment, monthly report, subscription renewals |

---

## Creating Recurring Reminders

### Basic Recurring Reminder

To create a recurring reminder, set `isRecurring: true` and provide a `recurrencePattern`:

```json
POST /api/v1/reminders
{
  "title": "Daily standup",
  "message": "Team sync meeting",
  "dueDate": "2026-01-20 9:00 AM",
  "isRecurring": true,
  "recurrencePattern": "daily"
}
```

**Result:**
- Status: `active` (not `pending`)
- First occurrence: `2026-01-20 9:00 AM`
- After processing: `nextDueDate` set to `2026-01-21 9:00 AM`
- `occurrenceCount` increments with each processing

### Daily Recurring Reminder

```json
POST /api/v1/reminders
{
  "title": "Morning exercise",
  "message": "Go for a 30-minute run",
  "dueDate": "2026-01-20 7:00 AM",
  "timezone": "America/New_York",
  "isRecurring": true,
  "recurrencePattern": "daily"
}
```

**Timeline:**
- 2026-01-20 7:00 AM EST → processes, sets nextDueDate to 2026-01-21 7:00 AM EST
- 2026-01-21 7:00 AM EST → processes, sets nextDueDate to 2026-01-22 7:00 AM EST
- Continues indefinitely (unless end date set)

### Weekly Recurring Reminder

```json
POST /api/v1/reminders
{
  "title": "Team retrospective",
  "message": "Review the week and plan improvements",
  "dueDate": "2026-01-24 2:00 PM",
  "timezone": "America/Los_Angeles",
  "isRecurring": true,
  "recurrencePattern": "weekly"
}
```

**Timeline:**
- 2026-01-24 2:00 PM PST (Friday) → processes
- 2026-01-31 2:00 PM PST (Friday) → processes
- 2026-02-07 2:00 PM PST (Friday) → processes
- Continues every Friday at 2:00 PM PST

### Monthly Recurring Reminder

```json
POST /api/v1/reminders
{
  "title": "Pay rent",
  "message": "Monthly rent payment due",
  "dueDate": "2026-02-01 9:00 AM",
  "timezone": "America/New_York",
  "isRecurring": true,
  "recurrencePattern": "monthly"
}
```

**Timeline:**
- 2026-02-01 9:00 AM EST → processes
- 2026-03-01 9:00 AM EST → processes
- 2026-04-01 9:00 AM EDT → processes (note: DST transition handled automatically)
- Continues on the 1st of every month

---

## How It Works

### 1. Creation

When you create a recurring reminder:
- `status` is set to `active` (not `pending`)
- `dueDate` represents the first occurrence
- `nextDueDate` is calculated based on the pattern
- `occurrenceCount` starts at 0

### 2. Processing

Every minute, the cron job:
- Finds reminders where `status = 'active'` and `nextDueDate <= now`
- Processes the reminder (sends notification, logs it)
- Calculates the next occurrence
- Updates `nextDueDate` to the next occurrence time
- Increments `occurrenceCount`
- Checks if `recurrenceEndDate` has been reached

### 3. Completion

If `recurrenceEndDate` is set and the next occurrence would be after it:
- `status` changes from `active` to `sent`
- `nextDueDate` is not updated
- No more occurrences will be processed

---

## Intervals

The `recurrenceInterval` field allows you to specify "every N days/weeks/months" instead of just "every day/week/month".

**Default:** `1` (every day, every week, every month)

### Every 2 Days

```json
{
  "title": "Gym day",
  "message": "Workout at the gym",
  "dueDate": "2026-01-20 6:00 AM",
  "isRecurring": true,
  "recurrencePattern": "daily",
  "recurrenceInterval": 2
}
```

**Timeline:**
- 2026-01-20 → 2026-01-22 → 2026-01-24 → 2026-01-26 → ...

### Every 2 Weeks (Biweekly)

```json
{
  "title": "Biweekly sync",
  "message": "Catch up with manager",
  "dueDate": "2026-01-24 3:00 PM",
  "isRecurring": true,
  "recurrencePattern": "weekly",
  "recurrenceInterval": 2
}
```

**Timeline:**
- 2026-01-24 → 2026-02-07 → 2026-02-21 → 2026-03-07 → ...

### Every 3 Months (Quarterly)

```json
{
  "title": "Quarterly review",
  "message": "Review goals and progress",
  "dueDate": "2026-01-31 5:00 PM",
  "isRecurring": true,
  "recurrencePattern": "monthly",
  "recurrenceInterval": 3
}
```

**Timeline:**
- 2026-01-31 → 2026-04-30 → 2026-07-31 → 2026-10-31 → ...

---

## End Dates

By default, recurring reminders continue indefinitely. Use `recurrenceEndDate` to stop recurrence after a specific date.

### Limited-Duration Recurring Reminder

```json
{
  "title": "Project daily sync",
  "message": "Quick team check-in during project phase",
  "dueDate": "2026-01-20 10:00 AM",
  "timezone": "America/New_York",
  "isRecurring": true,
  "recurrencePattern": "daily",
  "recurrenceEndDate": "2026-03-31"
}
```

**Timeline:**
- Starts: 2026-01-20 10:00 AM EST
- Processes daily until 2026-03-31
- Last occurrence: 2026-03-31 10:00 AM EDT
- After 2026-03-31: status changes to `sent`, no more occurrences

### How End Date Works

When the cron job processes a recurring reminder:

1. Calculate the next occurrence
2. Check if `nextOccurrence > recurrenceEndDate`
3. If yes: mark `status = 'sent'`, stop recurring
4. If no: update `nextDueDate`, continue recurring

**Example:**
- `recurrenceEndDate`: `2026-03-31`
- Last occurrence: `2026-03-30`
- Next would be: `2026-03-31` (allowed, processes)
- After that: `2026-04-01` (exceeds end date, stops)

---

## Timezone Handling

Recurring reminders maintain the same **local time** across occurrences, even during DST transitions.

### Example: DST Transition

```json
{
  "title": "Daily standup",
  "message": "Team sync",
  "dueDate": "2026-03-01 9:00 AM",
  "timezone": "America/New_York",
  "isRecurring": true,
  "recurrencePattern": "daily"
}
```

**Timeline:**
- 2026-03-01 9:00 AM EST (UTC-5) → stored as `14:00:00Z`
- 2026-03-08 9:00 AM EST (UTC-5) → stored as `14:00:00Z`
- 2026-03-09 9:00 AM EDT (UTC-4) → stored as `13:00:00Z` *(DST starts)*
- 2026-03-10 9:00 AM EDT (UTC-4) → stored as `13:00:00Z`

**Key point:** The reminder always fires at 9:00 AM Eastern Time, but the UTC representation changes during DST transitions. The system handles this automatically.

---

## Edge Cases

### End of Month

When a monthly recurring reminder is scheduled for a day that doesn't exist in the next month, the system uses the **last day of that month**.

#### Example 1: January 31 → February

```json
{
  "title": "Monthly report",
  "dueDate": "2026-01-31 5:00 PM",
  "isRecurring": true,
  "recurrencePattern": "monthly"
}
```

**Timeline:**
- 2026-01-31 (January has 31 days) → processes
- 2026-02-28 (February has 28 days in 2026) → processes (not March 3rd!)
- 2026-03-31 (March has 31 days) → processes
- 2026-04-30 (April has 30 days) → processes
- 2026-05-31 (May has 31 days) → processes

#### Example 2: February 29 (Leap Year)

```json
{
  "title": "Leap year reminder",
  "dueDate": "2024-02-29 10:00 AM",
  "isRecurring": true,
  "recurrencePattern": "monthly"
}
```

**Timeline:**
- 2024-02-29 (leap year) → processes
- 2024-03-29 → processes
- 2024-04-29 → processes
- (If it were yearly, 2025-02-28 would be used since Feb 29 doesn't exist)

### Daylight Saving Time (DST)

The system uses the `date-fns-tz` library, which handles DST transitions automatically.

**What happens:**
- Times are always stored in UTC
- Timezone conversions happen during calculation
- The same **local time** is maintained across DST boundaries
- No manual adjustment needed

### Interval Edge Cases

**Intervals are capped at 365:**
- `recurrenceInterval: 400` → validation error (max 365)

**Intervals must be positive:**
- `recurrenceInterval: 0` → validation error (min 1)
- `recurrenceInterval: -1` → validation error (min 1)

---

## Monitoring Recurring Reminders

### Get All Active Recurring Reminders

```bash
GET /api/v1/reminders/status/active
```

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Daily standup",
    "status": "active",
    "dueDate": "2026-01-20T14:00:00.000Z",
    "nextDueDate": "2026-01-21T14:00:00.000Z",
    "occurrenceCount": 5,
    "recurrencePattern": "daily",
    "timezone": "America/New_York",
    ...
  }
]
```

### Check a Specific Recurring Reminder

```bash
GET /api/v1/reminders/:id
```

**Key fields to monitor:**
- `status`: Should be `active` while recurring
- `nextDueDate`: When the next occurrence will fire
- `occurrenceCount`: How many times it has processed
- `lastProcessedAt`: When it was last processed

---

## FAQ

### Q: Can I change a one-time reminder to recurring?

**A:** Yes! Use `PATCH /api/v1/reminders/:id`:

```json
PATCH /api/v1/reminders/507f1f77bcf86cd799439011
{
  "isRecurring": true,
  "recurrencePattern": "weekly"
}
```

The reminder's status will change from `pending` to `active` and start recurring.

---

### Q: Can I change a recurring reminder back to one-time?

**A:** Yes, but with caution:

```json
PATCH /api/v1/reminders/507f1f77bcf86cd799439011
{
  "isRecurring": false
}
```

This will stop recurrence. However, the `dueDate` will remain as the original first occurrence, so you may need to update it.

---

### Q: What happens if I update the `dueDate` of a recurring reminder?

**A:** Updating `dueDate` doesn't affect active recurring reminders because the system uses `nextDueDate` for scheduling.

To reschedule a recurring reminder:
1. Delete the old one
2. Create a new one with the desired start time

---

### Q: Can I pause a recurring reminder?

**A:** Not directly. You can:
1. Update `status` to `sent` (stops recurring, marks as complete)
2. Or, set `recurrenceEndDate` to today (stops after today)

To resume, create a new recurring reminder.

---

### Q: What's the difference between `dueDate` and `nextDueDate`?

**A:**
- **`dueDate`**: The **original first occurrence** (never changes)
- **`nextDueDate`**: The **next upcoming occurrence** (updates after each processing)

For one-time reminders, only `dueDate` is used. For recurring reminders, the system uses `nextDueDate` for scheduling.

---

### Q: Can I create a reminder that recurs on specific days of the week?

**A:** Not currently. The system supports:
- Daily (every day or every N days)
- Weekly (same day every week or every N weeks)
- Monthly (same date every month or every N months)

For more complex patterns (e.g., "every Monday and Wednesday"), create separate weekly reminders.

---

### Q: What happens if the server is down during a scheduled occurrence?

**A:** When the server restarts, the cron job will immediately process any reminders where `nextDueDate <= now`. It won't "miss" occurrences — they'll just be late.

---

### Q: Can I see a history of all occurrences?

**A:** The current implementation tracks:
- `occurrenceCount`: Total number of times processed
- `lastProcessedAt`: When it was last processed

For a full history, you would need to implement a separate `RemindersHistory` collection (not included in this beginner project).

---

### Q: How do I stop a recurring reminder?

**A:** Three options:

1. **Delete it:**
   ```bash
   DELETE /api/v1/reminders/:id
   ```

2. **Set an end date:**
   ```json
   PATCH /api/v1/reminders/:id
   {
     "recurrenceEndDate": "2026-01-31"
   }
   ```

3. **Mark as sent (stops recurring):**
   ```json
   PATCH /api/v1/reminders/:id
   {
     "status": "sent"
   }
   ```

---

### Q: Can I change the recurrence pattern of an existing reminder?

**A:** Yes:

```json
PATCH /api/v1/reminders/:id
{
  "recurrencePattern": "monthly",
  "recurrenceInterval": 1
}
```

The next occurrence will be calculated based on the **new pattern** starting from the current `nextDueDate`.

---

### Q: What's the maximum recurrence interval?

**A:** 365 (one year). This is a safety limit to prevent accidental misuse (e.g., typing `10000` instead of `1`).

---

### Q: Does the system handle leap years?

**A:** Yes. The `date-fns` library handles leap years automatically:
- February 29 exists in leap years
- Monthly recurring reminders scheduled on Feb 29 will occur on Feb 28/29 depending on the year

---

## Summary

**Recurring reminders are powerful for:**
- Daily habits and routines
- Weekly meetings and check-ins
- Monthly administrative tasks
- Any repetitive task that needs automation

**Key takeaways:**
- Set `isRecurring: true` and provide a `recurrencePattern`
- Use `recurrenceInterval` for "every N days/weeks/months"
- Use `recurrenceEndDate` to limit duration
- Use `timezone` to ensure correct local time
- Monitor with `nextDueDate`, `occurrenceCount`, and `lastProcessedAt`
- Edge cases (end of month, DST) are handled automatically

For more examples, see `app.http` in the project root.
