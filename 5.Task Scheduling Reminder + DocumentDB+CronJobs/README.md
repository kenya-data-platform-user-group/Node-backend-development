# Task Scheduling: Reminder App with NoSQL and Cron Jobs

A beginner-friendly backend project that teaches task scheduling by building a reminder application with NestJS, a NoSQL database, and cron jobs. Users can create reminders, and the system automatically checks and sends them at the right time.

## What You Will Learn

- what task scheduling is
- what cron jobs are and how they work
- how to schedule recurring background tasks in NestJS
- how to store reminder data in a NoSQL database
- how to query pending reminders
- how to process due reminders automatically
- how backend systems handle timed and repeated work

## Project Idea

This project simulates a reminder system where users can create tasks they want to be reminded about later. Instead of relying on a user to manually check the app, the backend runs scheduled jobs that automatically look for reminders that are due and processes them.

This is a practical beginner project because it introduces automation, background processing, and time-based workflows in a simple and clear way.

## What Are Cron Jobs

A cron job is a scheduled task that runs automatically at a defined time or interval.

Examples:

- every minute
- every hour
- every day at 8:00 AM
- every Monday morning

In this project, a cron job can run every minute to check whether any reminders are due. If a reminder matches the current time and has not been sent yet, the application processes it.

This helps beginners understand how backend systems perform work even when no user is actively making a request.

## Features

- create reminders with a title, message, and due date
- store reminder data in a NoSQL database
- run cron jobs to check due reminders
- mark reminders as sent after processing
- filter pending and completed reminders
- prevent duplicate reminder processing
- expose API endpoints to manage reminders
- **recurring reminders** with daily, weekly, and monthly patterns
- **timezone support** for user-specific local times
- **priority levels** (high, medium, low) for reminder processing
- **automatic retry** for failed reminder processing
- **metrics and monitoring** endpoints for observability

## Tech Stack

- NestJS
- TypeScript
- NoSQL database such as MongoDB
- Mongoose or another NestJS-compatible NoSQL ODM
- NestJS Schedule module
- Docker

## Why This Project

Many real applications need scheduled background tasks.

Examples include:

- sending reminders
- notifying users about deadlines
- renewing subscriptions
- clearing expired sessions
- generating daily summaries

This project teaches the beginner version of that idea. It shows how a backend can wake up on a schedule, inspect stored data, and perform actions automatically.

## Learning Goals

By the end of this project, you should be able to:

- explain the purpose of cron jobs
- set up scheduled tasks in NestJS
- model reminder data in a NoSQL database
- find records that need processing
- build a simple automated workflow
- understand the difference between user-triggered actions and scheduled backend jobs

## Example Workflow

1. A user creates a reminder with a message and scheduled time.
2. The reminder is stored in the database.
3. A cron job runs every minute.
4. The application checks for reminders that are due.
5. Matching reminders are processed and marked as sent.
6. The user can view reminder history and status.

---

## 📐 Architecture Diagrams

### 1. Overall System Architecture

```
┌──────────────────────────────────────────────────────┐
│                    CLIENT                            │
│            (User / API Consumer)                     │
└────────────────────┬─────────────────────────────────┘
                     │
                     │ HTTP Requests
                     ▼
┌──────────────────────────────────────────────────────┐
│              NESTJS APPLICATION                      │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │       Reminders Module                     │    │
│  │                                            │    │
│  │  ┌──────────────┐   ┌──────────────┐     │    │
│  │  │  Controller  │   │   Service    │     │    │
│  │  │              │   │              │     │    │
│  │  │ POST /       │──▶│ create()     │─┐   │    │
│  │  │ GET  /       │◀──│ findAll()    │ │   │    │
│  │  │ PATCH /:id   │──▶│ update()     │ │   │    │
│  │  │ DELETE /:id  │──▶│ delete()     │ │   │    │
│  │  └──────────────┘   └──────────────┘ │   │    │
│  └────────────────────────────────────────┼───┘    │
│                                           │         │
│  ┌────────────────────────────────────────┼───┐    │
│  │       Scheduling Module               │   │    │
│  │                                       │   │    │
│  │  ┌─────────────────────────────────┐ │   │    │
│  │  │  ReminderProcessorService       │ │   │    │
│  │  │                                 │ │   │    │
│  │  │  @Cron('* * * * *')            │ │   │    │
│  │  │  handleCron()                  │ │   │    │
│  │  │  ├─ Query due reminders        │◀┘   │    │
│  │  │  ├─ Process each reminder      │     │    │
│  │  │  └─ Update status → 'sent'     │     │    │
│  │  └─────────────────────────────────┘     │    │
│  └──────────────────────────────────────────┘    │
│                        │                          │
└────────────────────────┼──────────────────────────┘
                         │
                         │ MongoDB Driver
                         ▼
              ┌─────────────────────┐
              │   MONGODB           │
              │                     │
              │  reminders          │
              │  ├─ _id             │
              │  ├─ title           │
              │  ├─ message         │
              │  ├─ dueDate         │
              │  ├─ status          │
              │  ├─ createdAt       │
              │  ├─ sentAt          │
              │  ├─ isRecurring     │
              │  ├─ nextDueDate     │
              │  └─ timezone        │
              └─────────────────────┘
```

### 2. Create Reminder Flow (One-Time)

```
┌──────────┐
│  Client  │
└────┬─────┘
     │ POST /api/v1/reminders
     │ {
     │   "title": "Doctor appointment",
     │   "message": "Annual checkup",
     │   "dueDate": "2026-06-15 2:30 PM"
     │ }
     ▼
┌─────────────────────────────┐
│ Reminders Controller        │
│ @Post()                     │
│ create(@ZodBody dto)        │
└────┬────────────────────────┘
     │ Zod Validation
     │ ✓ title: min 1, max 200
     │ ✓ message: min 1, max 1000
     │ ✓ dueDate: valid date
     ▼
┌─────────────────────────────┐
│ Reminders Service           │
│ create(dto)                 │
│                             │
│ reminder = {                │
│   ...dto,                   │
│   status: 'pending',        │
│   createdAt: new Date(),    │
│   updatedAt: new Date()     │
│ }                           │
└────┬────────────────────────┘
     │ INSERT INTO reminders
     ▼
┌─────────────────────────────┐
│        MongoDB              │
│  reminders collection       │
│                             │
│ {                           │
│   _id: ObjectId("..."),     │
│   title: "Doctor appt",     │
│   message: "Annual checkup",│
│   dueDate: 2026-06-15T14:30,│
│   status: "pending",        │
│   createdAt: 2026-05-23,    │
│   updatedAt: 2026-05-23     │
│ }                           │
└────┬────────────────────────┘
     │ Returns created document
     ▼
┌──────────┐
│  Client  │ ← 201 Created
└──────────┘   {_id, title, dueDate, status, ...}

⏱️ Reminder Status: PENDING
⏰ Will be processed when: dueDate <= current time
```

### 3. Cron Job Processing Flow (Every Minute)

```
Time: 14:30:00 (Every minute)

┌─────────────────────────────────────────────────────┐
│  @Cron('* * * * *')  ← Runs every minute           │
│  ReminderProcessorService.handleCron()              │
└────┬────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│ Step 1: Query Due Reminders                        │
│                                                     │
│ db.reminders.find({                                │
│   status: 'pending',                               │
│   dueDate: { $lte: new Date() }                    │
│ })                                                  │
└────┬────────────────────────────────────────────────┘
     │
     │ Found 3 reminders
     ▼
┌─────────────────────────────────────────────────────┐
│ Step 2: Process Each Reminder                      │
│                                                     │
│ For each reminder:                                  │
│   ┌─────────────────────────────────────────┐     │
│   │ 1. Log reminder info                    │     │
│   │    "Processing: Doctor appointment"     │     │
│   │                                         │     │
│   │ 2. Send notification (simulate)         │     │
│   │    logger.log("Sent: Annual checkup")   │     │
│   │                                         │     │
│   │ 3. Atomic update (prevent duplicates)   │     │
│   │    db.findOneAndUpdate(                 │     │
│   │      { _id, status: 'pending' },       │     │
│   │      {                                  │     │
│   │        $set: {                          │     │
│   │          status: 'sent',                │     │
│   │          sentAt: new Date()             │     │
│   │        }                                │     │
│   │      }                                  │     │
│   │    )                                    │     │
│   └─────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│ Step 3: Log Summary                                │
│                                                     │
│ "Reminder processing complete:                     │
│  3 processed, 0 failed"                            │
└─────────────────────────────────────────────────────┘

Database State After Processing:

BEFORE:
{_id: 1, status: "pending", dueDate: "2026-06-15T14:30"}
{_id: 2, status: "pending", dueDate: "2026-06-15T14:25"}
{_id: 3, status: "pending", dueDate: "2026-06-15T14:20"}

AFTER:
{_id: 1, status: "sent", sentAt: "2026-06-15T14:30:05"}
{_id: 2, status: "sent", sentAt: "2026-06-15T14:30:05"}
{_id: 3, status: "sent", sentAt: "2026-06-15T14:30:05"}
```

### 4. Recurring Reminder Flow

```
Create Recurring Reminder:

┌──────────┐
│  Client  │
└────┬─────┘
     │ POST /api/v1/reminders
     │ {
     │   "title": "Daily standup",
     │   "message": "Team meeting",
     │   "dueDate": "2026-06-01 9:00 AM",
     │   "timezone": "America/New_York",
     │   "isRecurring": true,
     │   "recurrencePattern": "daily"
     │ }
     ▼
┌─────────────────────────────┐
│ Reminders Service           │
│                             │
│ Calculate nextDueDate       │
│ Status: 'active' (not 'pending') │
└────┬────────────────────────┘
     │
     ▼
┌─────────────────────────────┐
│        MongoDB              │
│                             │
│ {                           │
│   _id: ObjectId("..."),     │
│   title: "Daily standup",   │
│   dueDate: 2026-06-01 09:00,│
│   status: "active",  ←      │
│   isRecurring: true,        │
│   recurrencePattern: "daily",│
│   nextDueDate: 2026-06-01,  │
│   occurrenceCount: 0,       │
│   timezone: "America/NY"    │
│ }                           │
└─────────────────────────────┘

Cron Job Processing (Every Minute):

Time: 2026-06-01 09:00

┌─────────────────────────────────────────────────────┐
│  Query Active Recurring Reminders                  │
│                                                     │
│  db.reminders.find({                               │
│    status: 'active',                               │
│    nextDueDate: { $lte: new Date() }               │
│  })                                                 │
└────┬────────────────────────────────────────────────┘
     │ Found 1 recurring reminder
     ▼
┌─────────────────────────────────────────────────────┐
│  Process Recurring Reminder                        │
│                                                     │
│  1. Send notification                              │
│     logger.log("Sent: Daily standup")              │
│                                                     │
│  2. Calculate next occurrence                      │
│     nextOccurrence = calculateNextOccurrence(      │
│       currentDate: 2026-06-01 09:00,              │
│       pattern: 'daily',                            │
│       interval: 1,                                 │
│       timezone: 'America/New_York'                 │
│     )                                              │
│     → Result: 2026-06-02 09:00 (next day)         │
│                                                     │
│  3. Update reminder                                │
│     db.findOneAndUpdate(                           │
│       { _id },                                     │
│       {                                            │
│         $set: {                                    │
│           nextDueDate: 2026-06-02 09:00,          │
│           lastProcessedAt: new Date(),             │
│         },                                         │
│         $inc: { occurrenceCount: 1 }               │
│       }                                            │
│     )                                              │
└─────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────┐
│     Database Updated        │
│                             │
│ {                           │
│   status: "active",         │
│   nextDueDate: 2026-06-02,  │ ← Updated!
│   occurrenceCount: 1,       │ ← Incremented!
│   lastProcessedAt: now      │ ← Updated!
│ }                           │
└─────────────────────────────┘

Timeline:
Day 1 (Jun 1): Process at 9:00 AM → nextDueDate = Jun 2
Day 2 (Jun 2): Process at 9:00 AM → nextDueDate = Jun 3
Day 3 (Jun 3): Process at 9:00 AM → nextDueDate = Jun 4
... (continues indefinitely or until recurrenceEndDate)
```

### 5. Timezone Handling

```
User Creates Reminder in Different Timezone:

┌──────────┐
│  Client  │ (Located in New York)
└────┬─────┘
     │ POST /api/v1/reminders
     │ {
     │   "title": "Morning meeting",
     │   "dueDate": "2026-06-15 9:00 AM",
     │   "timezone": "America/New_York"
     │ }
     ▼
┌─────────────────────────────────────────────┐
│ Timezone Conversion (date-fns-tz)          │
│                                             │
│ Input: "2026-06-15 9:00 AM"                │
│ Timezone: "America/New_York" (EDT = UTC-4) │
│                                             │
│ Convert to UTC:                             │
│ 9:00 AM EDT = 1:00 PM UTC                  │
│                                             │
│ Stored in DB: 2026-06-15T13:00:00.000Z    │
└─────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────┐
│        MongoDB (Stores UTC)                 │
│                                             │
│ {                                           │
│   dueDate: 2026-06-15T13:00:00.000Z,       │ ← UTC
│   timezone: "America/New_York"             │
│ }                                           │
└─────────────────────────────────────────────┘

Cron Job Processing (Server in UTC):

Time: 2026-06-15 13:00:00 UTC

┌─────────────────────────────────────────────┐
│ Query: dueDate <= current UTC time         │
│                                             │
│ Current: 2026-06-15T13:00:00.000Z          │
│ Match:   2026-06-15T13:00:00.000Z  ✓       │
│                                             │
│ → Process reminder at correct local time!   │
│   (9:00 AM New York time)                  │
└─────────────────────────────────────────────┘

Result: Reminder fires at exactly 9:00 AM in New York,
        regardless of server timezone!

Multiple Timezones Example:

Reminder A: 9:00 AM America/New_York  → Stored: 13:00 UTC
Reminder B: 9:00 AM America/Los_Angeles → Stored: 17:00 UTC
Reminder C: 9:00 AM Europe/London     → Stored: 08:00 UTC

All fire at their local 9:00 AM time!
```

### 6. Priority-Based Processing

```
Cron Job Finds Multiple Due Reminders:

┌─────────────────────────────────────────────────────┐
│  Query Result (Due Reminders)                      │
│                                                     │
│  Sort by: priority DESC, dueDate ASC               │
└────┬────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│  Priority 10 (HIGH)                                │
│  ┌────────────────────────────────────────┐        │
│  │ Reminder 1: "Emergency meeting"         │ ───┐   │
│  │ dueDate: 14:25                          │    │   │
│  └────────────────────────────────────────┘    │   │
│                                                 │   │
│  Priority 5 (MEDIUM)                            │   │
│  ┌────────────────────────────────────────┐    │   │
│  │ Reminder 2: "Team standup"              │    │   │
│  │ dueDate: 14:20                          │    │   │
│  └────────────────────────────────────────┘    │   │
│  ┌────────────────────────────────────────┐    │   │
│  │ Reminder 3: "Code review"               │    │   │
│  │ dueDate: 14:28                          │    │   │
│  └────────────────────────────────────────┘    │   │
│                                                 │   │
│  Priority 1 (LOW)                               │   │
│  ┌────────────────────────────────────────┐    │   │
│  │ Reminder 4: "Read docs"                 │    │   │
│  │ dueDate: 14:15                          │    │   │
│  └────────────────────────────────────────┘    │   │
└─────────────────────────────────────────────────────┘
                 │
                 │ Processing Order
                 ▼
┌─────────────────────────────────────────────────────┐
│  Process in Priority Order:                        │
│                                                     │
│  1. ✅ Reminder 1 (Priority 10) - Processed first  │
│  2. ✅ Reminder 2 (Priority 5)  - Earlier dueDate  │
│  3. ✅ Reminder 3 (Priority 5)  - Later dueDate    │
│  4. ✅ Reminder 4 (Priority 1)  - Processed last   │
│                                                     │
│  (Even though Reminder 4 was due earliest,         │
│   it's processed last due to low priority)         │
└─────────────────────────────────────────────────────┘
```

### 7. Atomic Update (Idempotency)

```
Problem: Multiple Cron Instances Running

┌────────────┐       ┌────────────┐
│  Cron #1   │       │  Cron #2   │
│ (Server 1) │       │ (Server 2) │
└─────┬──────┘       └─────┬──────┘
      │                    │
      │ Both find same     │
      │ due reminder       │
      │                    │
      ▼                    ▼
┌──────────────────────────────────┐
│  Reminder ID: 123                │
│  status: "pending"               │
│  dueDate: 14:30                  │
└──────────────────────────────────┘

Without Atomic Update (❌ BAD):
┌────────────────────────────────────────┐
│ Cron #1: Read reminder (status=pending)│
│ Cron #2: Read reminder (status=pending)│
│          Both see status="pending"!    │
│                                        │
│ Cron #1: Update status="sent"          │
│ Cron #2: Update status="sent"          │
│          Processed TWICE! ❌           │
└────────────────────────────────────────┘

With Atomic Update (✅ GOOD):
┌────────────────────────────────────────┐
│ Cron #1: findOneAndUpdate(             │
│   { _id: 123, status: 'pending' },    │
│   { $set: { status: 'sent' } }        │
│ )                                      │
│ → Success! Updated 1 document          │
│                                        │
│ Cron #2: findOneAndUpdate(             │
│   { _id: 123, status: 'pending' },    │
│   { $set: { status: 'sent' } }        │
│ )                                      │
│ → Failed! No document matches          │
│   (status is now 'sent', not 'pending')│
│                                        │
│ Result: Processed ONCE ✅              │
└────────────────────────────────────────┘

MongoDB Guarantees:
✅ Atomic read-modify-write operation
✅ No race conditions
✅ Idempotent processing
✅ Safe for multiple cron instances
```

### 8. Retry Logic for Failed Reminders

```
Cron Job Encounters Error:

┌─────────────────────────────────────────────────────┐
│  Processing Reminder ID: 456                       │
│                                                     │
│  try {                                              │
│    sendNotification(reminder)                       │
│  } catch (error) {                                  │
│    ❌ Network timeout                              │
│  }                                                  │
└────┬────────────────────────────────────────────────┘
     │
     │ Error caught
     ▼
┌─────────────────────────────────────────────────────┐
│  Update Reminder with Retry Info                   │
│                                                     │
│  db.findOneAndUpdate(                              │
│    { _id: 456 },                                   │
│    {                                                │
│      $inc: { failedAttempts: 1 },                  │
│      $set: {                                        │
│        lastFailureReason: "Network timeout",       │
│        failedAt: new Date()                        │
│      }                                              │
│    }                                                │
│  )                                                  │
└────┬────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│  Reminder State After Attempt 1                    │
│                                                     │
│  {                                                  │
│    _id: 456,                                        │
│    status: "pending",                              │
│    failedAttempts: 1,  ← Incremented               │
│    lastFailureReason: "Network timeout",           │
│    maxRetries: 3                                   │
│  }                                                  │
└─────────────────────────────────────────────────────┘

Next Cron Run (1 minute later):

┌─────────────────────────────────────────────────────┐
│  Check Retry Eligibility                           │
│                                                     │
│  if (failedAttempts < maxRetries) {                │
│    try {                                            │
│      sendNotification(reminder)                     │
│    } catch (error) {                                │
│      ❌ Still failing                              │
│      failedAttempts = 2                            │
│    }                                                │
│  }                                                  │
└─────────────────────────────────────────────────────┘

After Max Retries:

┌─────────────────────────────────────────────────────┐
│  Final State (After 3 Failed Attempts)             │
│                                                     │
│  {                                                  │
│    _id: 456,                                        │
│    status: "failed",  ← Changed from pending       │
│    failedAttempts: 3,                              │
│    lastFailureReason: "Network timeout",           │
│    maxRetries: 3                                   │
│  }                                                  │
│                                                     │
│  Cron job stops retrying this reminder             │
└─────────────────────────────────────────────────────┘
```

---

## Suggested Endpoints

- `POST /reminders` to create a new reminder
- `GET /reminders` to list reminders
- `GET /reminders/:id` to get a single reminder
- `PATCH /reminders/:id` to update a reminder
- `DELETE /reminders/:id` to remove a reminder
- `GET /reminders/status/pending` to view unsent reminders
- `GET /reminders/status/sent` to view completed reminders

## Recurring Reminders

Reminders can be configured to repeat automatically on a schedule.

### Supported Patterns

- **Minutely**: Repeats every minute or every N minutes (useful for testing)
- **Hourly**: Repeats every hour or every N hours
- **Daily**: Repeats every day or every N days
- **Weekly**: Repeats every week or every N weeks
- **Monthly**: Repeats every month or every N months

### How It Works

1. Create a reminder with `isRecurring: true` and a `recurrencePattern`
2. The system sets `status: 'active'` instead of `'pending'`
3. The cron job processes the reminder when due
4. Instead of marking it as `'sent'`, the system calculates the next occurrence
5. The `nextDueDate` field is updated with the next occurrence time
6. The `occurrenceCount` field increments with each processing
7. This repeats until `recurrenceEndDate` is reached (if set)

### Example: Daily Recurring Reminder

```json
POST /api/v1/reminders
{
  "title": "Daily standup",
  "message": "Team sync meeting",
  "dueDate": "2026-01-20 9:00 AM",
  "timezone": "America/New_York",
  "isRecurring": true,
  "recurrencePattern": "daily"
}
```

### Example: Weekly Recurring Reminder with Interval

```json
POST /api/v1/reminders
{
  "title": "Biweekly report",
  "message": "Submit status report",
  "dueDate": "2026-01-24 5:00 PM",
  "timezone": "America/Los_Angeles",
  "isRecurring": true,
  "recurrencePattern": "weekly",
  "recurrenceInterval": 2
}
```

### Example: Monthly Recurring Reminder with End Date

```json
POST /api/v1/reminders
{
  "title": "Pay rent",
  "message": "Monthly rent payment",
  "dueDate": "2026-02-01 9:00 AM",
  "timezone": "America/New_York",
  "isRecurring": true,
  "recurrencePattern": "monthly",
  "recurrenceEndDate": "2026-12-31"
}
```

### Recurrence Fields

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `isRecurring` | boolean | Enable recurring behavior | When using recurrence |
| `recurrencePattern` | string | Pattern: `daily`, `weekly`, `monthly` | When `isRecurring: true` |
| `recurrenceInterval` | number | Interval (e.g., 2 for "every 2 days") | No (default: 1) |
| `recurrenceEndDate` | date | When to stop recurring | No (continues indefinitely) |
| `nextDueDate` | date | Next occurrence (auto-calculated) | Read-only |
| `occurrenceCount` | number | Times processed (auto-incremented) | Read-only |

---

## Timezone Support

Reminders can be created with specific timezones to ensure they fire at the correct local time regardless of server location.

### How Timezones Work

1. All dates are stored in **UTC** in the database
2. When a `timezone` is provided, the due date is interpreted in that timezone
3. The cron job processes reminders based on UTC time
4. For recurring reminders, the next occurrence maintains the same local time

### Supported Timezones

This application uses **IANA timezone identifiers**. Common examples:

- `America/New_York` (Eastern Time)
- `America/Los_Angeles` (Pacific Time)
- `America/Chicago` (Central Time)
- `Europe/London` (GMT/BST)
- `Europe/Paris` (CET/CEST)
- `Asia/Tokyo` (JST)
- `Asia/Kolkata` (IST)
- `Australia/Sydney` (AEDT/AEDT)

[Full list of IANA timezones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)

### Example: Timezone-Aware Reminder

```json
POST /api/v1/reminders
{
  "title": "International conference call",
  "message": "Call with Tokyo office",
  "dueDate": "2026-02-15 10:00 AM",
  "timezone": "Asia/Tokyo"
}
```

**What happens:**
- Input: `2026-02-15 10:00 AM` in `Asia/Tokyo`
- Stored as UTC: `2026-02-15T01:00:00.000Z`
- Processes at: 10:00 AM Tokyo time (regardless of server timezone)

### Example: Recurring Reminder with Timezone

```json
POST /api/v1/reminders
{
  "title": "Daily standup",
  "message": "Team meeting",
  "dueDate": "2026-01-20 9:00 AM",
  "timezone": "America/New_York",
  "isRecurring": true,
  "recurrencePattern": "daily"
}
```

**What happens:**
- First occurrence: `2026-01-20 9:00 AM EST`
- Next occurrence: `2026-01-21 9:00 AM EST`
- Always fires at 9:00 AM Eastern Time, even during DST transitions

### Timezone Field

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `timezone` | string | IANA timezone identifier | No (defaults to UTC) |

---

## Beginner Topics Covered

- NestJS modules and services
- NoSQL data modeling
- creating REST API endpoints
- scheduled tasks with cron jobs
- querying due records
- updating reminder status
- background automation in backend systems
- recurring task scheduling
- timezone-aware date handling
- atomic database updates for concurrency

## Reminder Data Example

A reminder can contain:

- title
- message
- due date and time
- status
- created at
- sent at

This simple structure is enough to teach how scheduled checks work with stored application data.

## Possible Extensions

After completing the beginner version, you can extend the project with:

- email reminders
- SMS reminders
- recurring reminders
- user authentication
- timezone support
- notification logs
- failed reminder retry handling
- dashboard for upcoming reminders

## Who This Project Is For

This project is designed for:

- beginners learning backend development
- developers new to cron jobs
- students learning NestJS and NoSQL
- anyone who wants to understand task automation in backend systems

## Outcome

By building this project, you move beyond basic CRUD and learn how backend systems perform scheduled work automatically. You will understand how to combine APIs, databases, and cron jobs to create useful real-world automation.

This is a strong project for learning task scheduling before moving into more advanced background processing systems.

---

## Setup Instructions

### Prerequisites

- Node.js 22 or higher
- pnpm (package manager)
- Docker and Docker Compose (for local database)

### Installation

1. Clone the repository and navigate to the project directory:
```bash
cd "5.Task Scheduling Reminder + DocumentDB+CronJobs"
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure environment variables:
```bash
# Copy the example environment file
cp .env.example .env.development

# Or create your own .env file with these variables:
PORT=3000
NODE_ENV=development
DATABASE_URL=mongodb://admin:password@localhost:10260?authSource=admin&tls=true&tlsAllowInvalidCertificates=true&directConnection=true
DATABASE_NAME=reminders
```

### Running with Docker

Start the application and DocumentDB Local with Docker Compose:

```bash
docker-compose up
```

This will start:
- NestJS API on `http://localhost:3000`
- DocumentDB Local on `localhost:10260`

### Running Locally (Development)

1. Start DocumentDB Local separately:
```bash
docker-compose up documentdb
```

2. Run the application in development mode:
```bash
pnpm start:dev
```

The API will be available at `http://localhost:3000/api/v1`

---

## Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PORT` | API server port | `3000` | `3000` |
| `NODE_ENV` | Environment mode | `development` | `development` or `production` |
| `DATABASE_URL` | MongoDB connection string | `mongodb://localhost:27017` | `mongodb://admin:password@localhost:10260?authSource=admin&tls=true&tlsAllowInvalidCertificates=true` |
| `DATABASE_NAME` | Database name | `reminders` | `reminders` |

---

## API Endpoints

All endpoints are prefixed with `/api/v1`.

### Create a Reminder

**POST** `/api/v1/reminders`

Create a new reminder.

**Request Body:**
```json
{
  "title": "Buy groceries",
  "message": "Remember to buy milk, eggs, and bread",
  "dueDate": "2025-12-31T10:00:00Z"
}
```

**📅 Accepted Date Formats** (all convert to UTC):

| Format | Example | Description |
|--------|---------|-------------|
| **Date Only** | `"2025-12-31"` | Simple date (time = midnight) |
| **Date + Time** | `"2025-12-31 10:00"` | 24-hour format with space |
| **AM/PM Format** ⭐ | `"2025-12-31 2:30 PM"` | 12-hour format (user-friendly) |
| **ISO 8601 Local** | `"2025-12-31T14:00"` | Standard format |
| **ISO 8601 UTC** | `"2025-12-31T10:00:00Z"` | Recommended for APIs |
| **Unix Timestamp** | `1735646400000` | Milliseconds since epoch |

**Examples:**
```json
// User-friendly (recommended for manual input)
"dueDate": "2025-12-31 2:30 PM"

// API standard (recommended for integrations)
"dueDate": "2025-12-31T14:30:00Z"

// Simple date only
"dueDate": "2025-12-31"
```

📖 **[See complete date format documentation](docs/DATE_FORMATS.md)** for detailed examples and use cases.

**Response:** `201 Created`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "title": "Buy groceries",
  "message": "Remember to buy milk, eggs, and bread",
  "dueDate": "2025-12-31T10:00:00.000Z",
  "status": "pending",
  "createdAt": "2025-05-23T12:00:00.000Z",
  "updatedAt": "2025-05-23T12:00:00.000Z"
}
```

**Curl Example:**
```bash
curl -X POST http://localhost:3000/api/v1/reminders \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Buy groceries",
    "message": "Remember to buy milk, eggs, and bread",
    "dueDate": "2025-12-31T10:00:00Z"
  }'
```

---

### List All Reminders

**GET** `/api/v1/reminders`

Retrieve all reminders.

**Response:** `200 OK`
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Buy groceries",
    "message": "Remember to buy milk, eggs, and bread",
    "dueDate": "2025-12-31T10:00:00.000Z",
    "status": "pending",
    "createdAt": "2025-05-23T12:00:00.000Z",
    "updatedAt": "2025-05-23T12:00:00.000Z"
  }
]
```

**Curl Example:**
```bash
curl http://localhost:3000/api/v1/reminders
```

---

### Get a Single Reminder

**GET** `/api/v1/reminders/:id`

Retrieve a specific reminder by ID.

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "title": "Buy groceries",
  "message": "Remember to buy milk, eggs, and bread",
  "dueDate": "2025-12-31T10:00:00.000Z",
  "status": "pending",
  "createdAt": "2025-05-23T12:00:00.000Z",
  "updatedAt": "2025-05-23T12:00:00.000Z"
}
```

**Curl Example:**
```bash
curl http://localhost:3000/api/v1/reminders/507f1f77bcf86cd799439011
```

---

### Update a Reminder

**PATCH** `/api/v1/reminders/:id`

Update an existing reminder (partial update supported).

**Request Body:**
```json
{
  "title": "Buy groceries and cook dinner",
  "dueDate": "2025-12-31T14:00:00Z"
}
```

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "title": "Buy groceries and cook dinner",
  "message": "Remember to buy milk, eggs, and bread",
  "dueDate": "2025-12-31T14:00:00.000Z",
  "status": "pending",
  "createdAt": "2025-05-23T12:00:00.000Z",
  "updatedAt": "2025-05-23T13:00:00.000Z"
}
```

**Curl Example:**
```bash
curl -X PATCH http://localhost:3000/api/v1/reminders/507f1f77bcf86cd799439011 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Buy groceries and cook dinner"
  }'
```

---

### Delete a Reminder

**DELETE** `/api/v1/reminders/:id`

Delete a reminder.

**Response:** `204 No Content`

**Curl Example:**
```bash
curl -X DELETE http://localhost:3000/api/v1/reminders/507f1f77bcf86cd799439011
```

---

### List Pending Reminders

**GET** `/api/v1/reminders/status/pending`

Retrieve all reminders with status `pending`.

**Response:** `200 OK`
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Buy groceries",
    "status": "pending",
    ...
  }
]
```

**Curl Example:**
```bash
curl http://localhost:3000/api/v1/reminders/status/pending
```

---

### List Sent Reminders

**GET** `/api/v1/reminders/status/sent`

Retrieve all reminders with status `sent`.

**Response:** `200 OK`
```json
[
  {
    "_id": "507f1f77bcf86cd799439012",
    "title": "Doctor appointment",
    "status": "sent",
    "sentAt": "2025-05-23T14:00:00.000Z",
    ...
  }
]
```

**Curl Example:**
```bash
curl http://localhost:3000/api/v1/reminders/status/sent
```

---

## How Cron Jobs Work in This Application

### Automatic Reminder Processing

The application includes a **cron job** that runs **every minute** to automatically process due reminders.

**Process Flow:**

1. **Every minute**, the `ReminderProcessorService` executes
2. It queries the database for reminders where:
   - `status = 'pending'`
   - `dueDate <= current time`
3. For each due reminder:
   - Uses **atomic update** (`findOneAndUpdate`) to mark as `sent`
   - Only updates if status is still `pending` (prevents duplicates)
   - Sets `sentAt` timestamp
   - Logs the processing activity
4. Continues processing even if individual reminders fail

**Idempotency:**
The cron job is designed to be **idempotent** - running it multiple times won't process the same reminder twice. This is achieved through atomic MongoDB updates with status filtering.

**Example Logs:**
```
[ReminderProcessorService] Starting reminder processing check...
[ReminderProcessorService] Found 2 due reminder(s) to process
[ReminderProcessorService] Processed reminder: "Buy groceries" (ID: 507f1f77bcf86cd799439011)
[ReminderProcessorService] Processed reminder: "Doctor appointment" (ID: 507f1f77bcf86cd799439012)
[ReminderProcessorService] Reminder processing complete: 2 processed, 0 failed
```

### Testing the Cron Job

To test the automatic processing:

1. Create a reminder with a past due date:
```bash
curl -X POST http://localhost:3000/api/v1/reminders \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Past Reminder",
    "message": "This should be processed immediately",
    "dueDate": "2025-01-01T10:00:00Z"
  }'
```

2. Wait up to 1 minute for the cron job to run

3. Check the reminder status:
```bash
curl http://localhost:3000/api/v1/reminders/status/sent
```

4. Check application logs to see processing activity

---

## Project Structure

```
src/
├── main.ts                              # Application entry point
├── app.module.ts                        # Root module
├── config/
│   └── index.ts                         # Zod-validated configuration
├── database/
│   ├── database.module.ts               # Global database module
│   └── database.service.ts              # MongoDB client wrapper
├── common/
│   ├── decorators/
│   │   └── zod.decorators.ts            # Custom Zod validation decorators
│   ├── pipes/
│   │   └── zod-validation.pipe.ts       # Zod validation pipe
│   └── schemas/
│       └── object-id.schema.ts          # ObjectId validator
├── modules/
│   └── reminders/
│       ├── reminders.module.ts          # Reminders feature module
│       ├── reminders.controller.ts      # API endpoints
│       ├── reminders.service.ts         # Business logic
│       ├── schemas/
│       │   └── reminder.schema.ts       # Database document interface
│       └── dto/
│           ├── create-reminder.dto.ts   # Create validation schema
│           └── update-reminder.dto.ts   # Update validation schema
└── scheduling/
    ├── scheduling.module.ts             # Scheduling module
    └── reminder-processor.service.ts    # Cron job service
```

---

## Troubleshooting

### Application won't start

**Error:** `Cannot connect to MongoDB`

**Solution:**
- Ensure Docker Compose is running: `docker-compose up documentdb`
- Verify `DATABASE_URL` in `.env` matches your DocumentDB connection string
- Check that port 10260 is not in use by another application

---

### Cron job not running

**Symptoms:** Reminders remain in `pending` status even after due date passes

**Solution:**
- Check application logs for cron job execution messages
- Verify `@nestjs/schedule` is installed: `pnpm list @nestjs/schedule`
- Ensure `SchedulingModule` is imported in `AppModule`
- Restart the application

---

### Database connection issues with Docker

**Error:** `TLS handshake failed`

**Solution:**
- Ensure connection string includes: `tls=true&tlsAllowInvalidCertificates=true`
- Use the exact connection string from `.env.example`
- For DocumentDB Local, self-signed certificates are expected

---

### Validation errors

**Error:** `Validation failed`

**Solution:**
- Check request body matches the schema requirements
- `title`: required, max 200 characters
- `message`: required, max 1000 characters
- `dueDate`: required, must be a valid date (ISO 8601 format recommended)
- `timezone`: must be a valid IANA timezone identifier
- `recurrencePattern`: required when `isRecurring: true`

---

### Invalid timezone error

**Error:** `Invalid timezone: Invalid/Timezone`

**Solution:**
- Use a valid IANA timezone identifier
- Examples: `America/New_York`, `Europe/London`, `Asia/Tokyo`
- Check spelling and capitalization (case-sensitive)
- Verify the timezone exists in the IANA database

---

### Recurring reminder not processing

**Symptoms:** Recurring reminder remains in `active` status but `nextDueDate` not updating

**Solution:**
- Check application logs for cron job execution
- Verify `nextDueDate` is in the past (should be ≤ current time)
- Ensure `recurrencePattern` and `recurrenceInterval` are valid
- Check if `recurrenceEndDate` has been reached
- Restart the application if cron job seems stuck

---

## Technology Details

- **Framework:** NestJS 11
- **Language:** TypeScript 5.7
- **Database:** MongoDB 7 / DocumentDB Local
- **Validation:** Zod (instead of class-validator)
- **Scheduling:** @nestjs/schedule
- **Package Manager:** pnpm
- **Containerization:** Docker & Docker Compose

---

## Next Steps

After completing this project, consider these extensions:

1. **User Authentication:** Add JWT-based authentication
2. **Email Notifications:** Send actual emails when reminders are processed
3. **Recurring Reminders:** Support daily/weekly/monthly recurring reminders ✅ (Implemented)
4. **Timezone Support:** Handle user-specific timezones ✅ (Implemented)
5. **Web Dashboard:** Build a frontend to visualize reminders
6. **Reminder Priority:** Add priority levels (high, medium, low) ✅ (Implemented)
7. **Retry Logic:** Retry failed reminder processing ✅ (Implemented)
8. **Metrics & Monitoring:** Track reminder processing metrics ✅ (Implemented)

---

## 📊 Cron Jobs vs Message Queues

### Comparison Table

| Feature | **Cron Jobs (This Project)** | **Message Queues** |
|---------|------------------------------|---------------------|
| **Trigger** | Time-based (every minute, hour, day) | On-demand (API request) |
| **Use Case** | Scheduled maintenance tasks | User-initiated tasks |
| **Scalability** | Vertical (single instance) | Horizontal (multiple workers) |
| **Retry Logic** | Manual implementation ✅ (Implemented in this project) | Built-in with exponential backoff |
| **Priority** | No built-in support ✅ (Implemented in this project) | Yes (1-15 levels) |
| **Progress Tracking** | Not applicable ✅ (Metrics implemented) | Yes (0-100%) |
| **Job Status** | Binary (running/not running) | Detailed (waiting/active/completed/failed) |
| **Examples** | Database cleanup, daily reports, reminder processing | File upload, email sending, CSV import |

### When to Use Cron Jobs

✅ **Use cron jobs when:**
- Tasks run on a fixed schedule (every hour, daily, weekly)
- No user interaction triggers the task
- Processing all records at once is acceptable
- The task is time-based rather than event-based

**Examples in this project:**
- Check for due reminders every minute
- Process recurring reminders on schedule
- Daily cleanup of old sent reminders
- Nightly database maintenance

### When to Use Message Queues

✅ **Use queues when:**
- Users trigger the task via API
- Need to track individual job progress
- Need to prioritize certain jobs
- Need to scale workers independently
- Need detailed retry and error handling

**Examples:**
- User uploads CSV → Import 10,000 employees
- User requests PDF report → Generate in background
- User sends bulk emails → Queue each email

### Real-World Example

**This Project (Cron Jobs):**
```
Every minute:
  → Check database for due reminders
  → Process all matching reminders
  → Mark them as sent
```

**Queue-Based Project (see Employee Import Queue project):**
```
User uploads CSV:
  → API queues import job
  → Returns immediately with job ID
  → Worker processes in background
  → User polls for status
```

### Hybrid Approach

Many real-world applications use **both**:

| System | Cron Job | Queue |
|--------|----------|-------|
| **E-commerce** | Daily sales report at 6 AM | User requests custom report |
| **Email** | Daily newsletter at 8 AM | User sends password reset |
| **Backup** | Nightly database backup | User exports their data |
| **Reminders** | Check due reminders every minute | User triggers manual notification |

### See Also

For a complete implementation of message queues, check out the companion project:

**📦 [Employee Import Queue with NestJS and BullMQ](../6.Queues%20Employee%20Import%20Queue%20with%20NestJS%20and%20BullMQ)**

This project demonstrates:
- BullMQ queue setup
- Producer-consumer pattern
- Job prioritization
- Progress tracking
- Retry with exponential backoff
- Batch processing

Together, these two projects cover the complete spectrum of background task processing in backend systems.
