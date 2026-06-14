import { ObjectId } from 'mongodb';

export interface Reminder {
  _id?: ObjectId;
  title: string;
  message: string;
  dueDate: Date;
  status: 'pending' | 'sent' | 'active' | 'failed';
  priority?: 'high' | 'medium' | 'low'; // Priority level (default: medium)
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;

  // Timezone support
  timezone?: string; // IANA timezone identifier (e.g., 'America/New_York')

  // Recurrence support
  isRecurring?: boolean; // Default: false
  recurrencePattern?: 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  recurrenceInterval?: number; // Default: 1 (e.g., 2 for "every 2 days")
  recurrenceEndDate?: Date; // Optional: when recurring stops
  nextDueDate?: Date; // Computed: next occurrence time (for active recurring reminders)
  lastProcessedAt?: Date; // Track last execution
  occurrenceCount?: number; // Count of how many times processed

  // Retry support
  failedAttempts?: number; // Number of failed processing attempts (default: 0)
  lastFailureReason?: string; // Error message from last failure
  failedAt?: Date; // When the last failure occurred
  maxRetries?: number; // Maximum retry attempts (default: 3)
  nextRetryAt?: Date; // When to retry next (with exponential backoff)
}
