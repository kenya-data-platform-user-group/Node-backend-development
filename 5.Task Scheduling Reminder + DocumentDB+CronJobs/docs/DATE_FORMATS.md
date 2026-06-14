# 📅 Date Format Guide

This document explains all the date and time formats accepted by the Reminder API.

## Supported Date Formats

The `dueDate` field accepts multiple formats for user convenience. All dates are automatically converted to UTC and stored as ISO 8601 timestamps.

### Quick Reference Table

| Format | Example | Description | When to Use |
|--------|---------|-------------|-------------|
| **Date Only** | `"2025-12-31"` | Just the date, time defaults to midnight (00:00:00) | Simple daily reminders |
| **Date + Space + Time** | `"2025-12-31 10:00"` | Date with 24-hour time (space separator) | Easy to read and write |
| **Date + Time (AM/PM)** | `"2025-12-31 2:30 PM"` | Date with 12-hour time and meridiem | User-friendly, natural format |
| **ISO 8601 Local** | `"2025-12-31T14:00"` | Standard format without timezone | Local time representation |
| **ISO 8601 UTC** | `"2025-12-31T10:00:00Z"` | Full ISO format with UTC timezone | API standard, recommended |
| **Unix Timestamp** | `1735646400000` | Milliseconds since epoch | Programmatic use |

---

## Detailed Examples

### 1. Date Only Format

**Format:** `YYYY-MM-DD`

**Example:**
```json
{
  "title": "Pay rent",
  "message": "Monthly rent payment",
  "dueDate": "2025-12-31"
}
```

**Result:** Time defaults to `00:00:00` (midnight)

**Use Cases:**
- All-day events
- Date-only reminders
- Deadlines without specific times

---

### 2. Date with 24-Hour Time (Space Separator)

**Format:** `YYYY-MM-DD HH:mm`

**Examples:**
```json
// Morning (9:00 AM)
{
  "title": "Team standup",
  "dueDate": "2025-12-31 09:00"
}

// Afternoon (2:30 PM)
{
  "title": "Client meeting",
  "dueDate": "2025-12-31 14:30"
}

// Evening (7:45 PM)
{
  "title": "Dinner reservation",
  "dueDate": "2025-12-31 19:45"
}

// Midnight
{
  "title": "New Year celebration",
  "dueDate": "2025-12-31 00:00"
}
```

**Use Cases:**
- Quick manual input
- Testing in REST clients
- Simple date-time combinations

---

### 3. Date with 12-Hour Time (AM/PM) ⭐ User-Friendly

**Format:** `YYYY-MM-DD H:mm AM/PM` or `YYYY-MM-DD HH:mm AM/PM`

**Examples:**
```json
// Morning - single digit hour
{
  "title": "Breakfast meeting",
  "dueDate": "2025-12-31 9:00 AM"
}

// Morning - double digit hour
{
  "title": "Late morning call",
  "dueDate": "2025-12-31 11:30 AM"
}

// Afternoon
{
  "title": "Lunch appointment",
  "dueDate": "2025-12-31 2:30 PM"
}

// Evening
{
  "title": "Dinner party",
  "dueDate": "2025-12-31 7:00 PM"
}

// Midnight (12:00 AM = start of day)
{
  "title": "Server maintenance",
  "dueDate": "2025-12-31 12:00 AM"
}

// Noon (12:00 PM = midday)
{
  "title": "Lunch break",
  "dueDate": "2025-12-31 12:00 PM"
}
```

**Special Cases:**
- `12:00 AM` = midnight (00:00 in 24-hour format)
- `12:30 AM` = 12:30 past midnight (00:30 in 24-hour format)
- `12:00 PM` = noon (12:00 in 24-hour format)
- `12:30 PM` = 12:30 in the afternoon (12:30 in 24-hour format)

**Use Cases:**
- Most natural for human input
- Matches how people speak ("2:30 PM")
- Familiar to non-technical users

---

### 4. ISO 8601 Local Time

**Format:** `YYYY-MM-DDTHH:mm` or `YYYY-MM-DDTHH:mm:ss`

**Examples:**
```json
// Without seconds
{
  "title": "Team meeting",
  "dueDate": "2025-12-31T14:30"
}

// With seconds
{
  "title": "System backup",
  "dueDate": "2025-12-31T03:00:00"
}
```

**Use Cases:**
- Standard datetime format
- Works with most datetime libraries
- No timezone specified (assumes local)

---

### 5. ISO 8601 with UTC Timezone (Recommended for APIs)

**Format:** `YYYY-MM-DDTHH:mm:ssZ` or `YYYY-MM-DDTHH:mm:ss.sssZ`

**Examples:**
```json
// Standard precision
{
  "title": "International conference call",
  "dueDate": "2025-12-31T10:00:00Z"
}

// With milliseconds
{
  "title": "High-precision event",
  "dueDate": "2025-12-31T10:00:00.000Z"
}
```

**Use Cases:**
- API integrations
- Multi-timezone applications
- Explicit UTC time
- Production systems

---

### 6. Unix Timestamp

**Format:** Milliseconds since Unix epoch (January 1, 1970 UTC)

**Examples:**
```json
{
  "title": "Timestamp-based reminder",
  "dueDate": 1735646400000
}
```

**Use Cases:**
- Programmatic creation
- Database migrations
- System-generated reminders

---

## Time Zone Behavior

**Important:** All times are stored in **UTC** regardless of input format.

### How It Works:

1. **Input:** You provide a date in any supported format
2. **Parsing:** The API parses and converts to UTC
3. **Storage:** Stored as UTC timestamp in database
4. **Output:** Returned as ISO 8601 UTC string

### Examples:

```javascript
// Input (local time, no timezone)
"2025-12-31 14:00"

// Stored as (UTC)
"2025-12-31T14:00:00.000Z"

// Returned in API response
{
  "dueDate": "2025-12-31T14:00:00.000Z"
}
```

### Best Practices:

- **For specific times:** Use ISO 8601 with `Z` suffix
- **For local events:** Ensure your input matches your timezone
- **For all-day events:** Use date-only format
- **For user input:** Accept AM/PM format for familiarity

---

## Validation Rules

### Valid Dates:
✅ Future dates (most common use case)
✅ Past dates (processed immediately by cron job)
✅ Current date/time
✅ Year range: 1970-2099 (reasonable limits)

### Invalid Dates:
❌ Invalid date values: `"2025-02-30"` (February 30th doesn't exist)
❌ Invalid time values: `"2025-12-31 25:00"` (no 25th hour)
❌ Malformed strings: `"not-a-date"`
❌ Empty strings or null values

---

## Common Use Cases with Examples

### 1. Simple Daily Reminder
```json
POST /api/v1/reminders
{
  "title": "Take medication",
  "message": "Daily vitamin",
  "dueDate": "2026-01-15"
}
```

### 2. Meeting Reminder (User-Friendly)
```json
POST /api/v1/reminders
{
  "title": "Client presentation",
  "message": "Q4 business review with stakeholders",
  "dueDate": "2026-01-20 2:30 PM"
}
```

### 3. Precise API Integration (Production)
```json
POST /api/v1/reminders
{
  "title": "Scheduled report generation",
  "message": "Generate monthly analytics report",
  "dueDate": "2026-02-01T00:00:00Z"
}
```

### 4. Early Morning Reminder
```json
POST /api/v1/reminders
{
  "title": "Gym session",
  "message": "Morning workout routine",
  "dueDate": "2026-01-16 6:30 AM"
}
```

### 5. Late Night Reminder
```json
POST /api/v1/reminders
{
  "title": "System backup",
  "message": "Nightly database backup",
  "dueDate": "2026-01-17 11:30 PM"
}
```

---

## Testing Different Formats

You can test all formats using the included `app.http` file:

```bash
# Open app.http in VS Code with REST Client extension
# Try each format example
# All should work seamlessly
```

---

## Frequently Asked Questions

### Q: What timezone is used?
**A:** All times are stored in UTC. Input times without timezone info are treated as-is and stored in UTC.

### Q: Can I use timezone offsets like `+05:30`?
**A:** Yes! JavaScript's Date constructor supports this:
```json
"dueDate": "2025-12-31T14:00:00+05:30"
```

### Q: What happens with past dates?
**A:** The cron job will process them in the next run (within 1 minute).

### Q: Which format is fastest?
**A:** All formats have negligible parsing time. Choose based on readability.

### Q: Can I omit the year?
**A:** No, the full date (YYYY-MM-DD) is required.

### Q: What about daylight saving time?
**A:** Using UTC avoids DST complications. The cron job processes based on UTC time.

---

## Recommendations by Use Case

| Scenario | Recommended Format | Example |
|----------|-------------------|---------|
| Manual API testing | AM/PM format | `"2025-12-31 2:30 PM"` |
| Production APIs | ISO 8601 UTC | `"2025-12-31T14:30:00Z"` |
| Date-only reminders | Date only | `"2025-12-31"` |
| User input forms | AM/PM format | `"2025-12-31 2:30 PM"` |
| System integrations | Unix timestamp | `1735646400000` |
| Quick testing | Space-separated | `"2025-12-31 14:30"` |

---

## Implementation Details

The API uses:
- **Zod** for schema validation
- **Custom preprocessor** for AM/PM parsing
- **JavaScript Date object** for standard formats
- **UTC storage** in MongoDB

All format conversions happen automatically before validation, ensuring consistent behavior across all input types.

---

## Summary

✨ **Best for humans:** `"2025-12-31 2:30 PM"`
🔧 **Best for APIs:** `"2025-12-31T14:30:00Z"`
📅 **Best for dates:** `"2025-12-31"`
⚡ **Best for systems:** `1735646400000`

**All formats work!** Choose what's most convenient for your use case.
