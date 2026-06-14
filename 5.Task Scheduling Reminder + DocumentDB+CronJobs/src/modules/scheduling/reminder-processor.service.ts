import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';
import { Collection } from 'mongodb';
import { Reminder } from '../reminders/schemas/reminder.schema';
import {
  calculateNextOccurrence,
  shouldStopRecurrence,
} from '../../common/utils/recurrence.helper';
import { ProcessingMetrics } from './interfaces/metrics.interface';

@Injectable()
export class ReminderProcessorService implements OnModuleInit {
  private readonly logger = new Logger(ReminderProcessorService.name);
  private collection!: Collection<Reminder>;

  // Exponential backoff schedule (in milliseconds)
  private readonly BACKOFF_SCHEDULE = [
    1 * 60 * 1000, // 1 minute
    5 * 60 * 1000, // 5 minutes
    15 * 60 * 1000, // 15 minutes
  ];

  // Metrics tracking
  private metrics: ProcessingMetrics = {
    totalProcessed: 0,
    totalSucceeded: 0,
    totalFailed: 0,
    totalRetried: 0,
    oneTimeProcessed: 0,
    oneTimeSucceeded: 0,
    oneTimeFailed: 0,
    recurringProcessed: 0,
    recurringSucceeded: 0,
    recurringFailed: 0,
    highPriorityProcessed: 0,
    mediumPriorityProcessed: 0,
    lowPriorityProcessed: 0,
    averageProcessingTimeMs: 0,
    lastProcessingTimeMs: 0,
    lifetimeProcessed: 0,
    lifetimeSucceeded: 0,
    lifetimeFailed: 0,
  };

  constructor(private readonly databaseService: DatabaseService) {}

  onModuleInit() {
    this.collection = this.databaseService.getCollection<Reminder>('reminders');
  }

  /**
   * Get current processing metrics
   */
  getMetrics(): ProcessingMetrics {
    return { ...this.metrics };
  }

  /**
   * Calculate next retry time based on number of failures
   */
  private calculateNextRetryAt(failedAttempts: number): Date {
    const backoffIndex = Math.min(
      failedAttempts - 1,
      this.BACKOFF_SCHEDULE.length - 1,
    );
    const backoffMs = this.BACKOFF_SCHEDULE[backoffIndex];
    return new Date(Date.now() + backoffMs);
  }

  /**
   * Handle reminder processing failure with retry logic
   */
  private async handleReminderFailure(
    reminder: Reminder,
    error: unknown,
    reminderType: 'one-time' | 'recurring',
  ): Promise<void> {
    const now = new Date();
    const failedAttempts = (reminder.failedAttempts || 0) + 1;
    const maxRetries = reminder.maxRetries || 3;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const reminderId = String(reminder._id ?? 'unknown');

    if (failedAttempts >= maxRetries) {
      // Max retries exceeded - mark as failed
      await this.collection.updateOne(
        { _id: reminder._id },
        {
          $set: {
            status: 'failed',
            failedAttempts,
            lastFailureReason: errorMessage,
            failedAt: now,
            updatedAt: now,
          },
          $unset: {
            nextRetryAt: '',
          },
        },
      );

      this.logger.error(
        `${reminderType} reminder [${reminder.priority || 'medium'}] "${reminder.title}" (ID: ${reminderId}) failed after ${maxRetries} attempts: ${errorMessage}`,
      );
    } else {
      // Schedule retry with exponential backoff
      const nextRetryAt = this.calculateNextRetryAt(failedAttempts);
      await this.collection.updateOne(
        { _id: reminder._id },
        {
          $set: {
            failedAttempts,
            lastFailureReason: errorMessage,
            failedAt: now,
            nextRetryAt,
            updatedAt: now,
          },
        },
      );

      const backoffMinutes = Math.round(
        (nextRetryAt.getTime() - now.getTime()) / 60000,
      );
      this.logger.warn(
        `${reminderType} reminder [${reminder.priority || 'medium'}] "${reminder.title}" (ID: ${reminderId}) failed (attempt ${failedAttempts}/${maxRetries}). Retrying in ${backoffMinutes} minute(s): ${errorMessage}`,
      );
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processDueReminders() {
    const startTime = Date.now();
    const now = new Date();
    this.logger.log('Starting reminder processing check...');

    try {
      // Process both one-time and recurring reminders
      const oneTimeStats = await this.processOneTimeReminders(now);
      const recurringStats = await this.processRecurringReminders(now);

      const endTime = Date.now();
      const durationMs = endTime - startTime;

      const totalProcessed = oneTimeStats.processed + recurringStats.processed;
      const totalFailed = oneTimeStats.failed + recurringStats.failed;

      // Update metrics
      this.updateMetrics({
        oneTimeStats,
        recurringStats,
        durationMs,
        now,
      });

      if (totalProcessed === 0 && totalFailed === 0) {
        this.logger.log('No due reminders to process');
        return;
      }

      this.logger.log(
        `Reminder processing complete: ${totalProcessed} processed (${oneTimeStats.processed} one-time, ${recurringStats.processed} recurring), ${totalFailed} failed in ${durationMs}ms`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error during reminder processing: ${message}`, stack);
    }
  }

  /**
   * Track priority-based processing
   */
  private trackPriorityProcessing(priority?: 'high' | 'medium' | 'low') {
    const p = priority || 'medium';
    if (p === 'high') {
      this.metrics.highPriorityProcessed++;
    } else if (p === 'medium') {
      this.metrics.mediumPriorityProcessed++;
    } else if (p === 'low') {
      this.metrics.lowPriorityProcessed++;
    }
  }

  /**
   * Update processing metrics
   */
  private updateMetrics(params: {
    oneTimeStats: { processed: number; failed: number };
    recurringStats: { processed: number; failed: number };
    durationMs: number;
    now: Date;
  }) {
    const { oneTimeStats, recurringStats, durationMs, now } = params;

    // Current run metrics
    this.metrics.totalProcessed =
      oneTimeStats.processed + recurringStats.processed;
    this.metrics.totalSucceeded =
      this.metrics.totalProcessed -
      (oneTimeStats.failed + recurringStats.failed);
    this.metrics.totalFailed = oneTimeStats.failed + recurringStats.failed;

    this.metrics.oneTimeProcessed = oneTimeStats.processed;
    this.metrics.oneTimeSucceeded =
      oneTimeStats.processed - oneTimeStats.failed;
    this.metrics.oneTimeFailed = oneTimeStats.failed;

    this.metrics.recurringProcessed = recurringStats.processed;
    this.metrics.recurringSucceeded =
      recurringStats.processed - recurringStats.failed;
    this.metrics.recurringFailed = recurringStats.failed;

    // Performance metrics
    this.metrics.lastProcessingTimeMs = durationMs;
    this.metrics.lastRunAt = now;

    // Update average (simple moving average)
    if (this.metrics.averageProcessingTimeMs === 0) {
      this.metrics.averageProcessingTimeMs = durationMs;
    } else {
      this.metrics.averageProcessingTimeMs =
        this.metrics.averageProcessingTimeMs * 0.7 + durationMs * 0.3;
    }

    // Lifetime metrics
    this.metrics.lifetimeProcessed += this.metrics.totalProcessed;
    this.metrics.lifetimeSucceeded += this.metrics.totalSucceeded;
    this.metrics.lifetimeFailed += this.metrics.totalFailed;
  }

  /**
   * Process one-time reminders (status: 'pending')
   */
  private async processOneTimeReminders(
    now: Date,
  ): Promise<{ processed: number; failed: number }> {
    // Priority mapping: high=3, medium=2, low=1 for sorting
    const dueReminders = await this.collection
      .find({
        status: 'pending',
        dueDate: { $lte: now },
      })
      .sort({ priority: -1, dueDate: 1 }) // High priority first, then by due date
      .toArray();

    if (dueReminders.length === 0) {
      return { processed: 0, failed: 0 };
    }

    this.logger.log(`Found ${dueReminders.length} due one-time reminder(s)`);

    let processed = 0;
    let failed = 0;

    for (const reminder of dueReminders) {
      try {
        // Skip if retry backoff period hasn't elapsed
        if (reminder.nextRetryAt && reminder.nextRetryAt > now) {
          continue;
        }

        // Simulate reminder processing (in real app: send email, push notification, etc.)
        // For now, we just log it
        // If this were to fail, we'd catch it below

        // Atomic update: only update if status is still 'pending'
        const result = await this.collection.findOneAndUpdate(
          {
            _id: reminder._id,
            status: 'pending',
          },
          {
            $set: {
              status: 'sent',
              sentAt: now,
              updatedAt: now,
            },
            $unset: {
              failedAttempts: '',
              lastFailureReason: '',
              failedAt: '',
              nextRetryAt: '',
            },
          },
          {
            returnDocument: 'after',
          },
        );

        if (result) {
          this.logger.log(
            `Processed one-time reminder [${reminder.priority || 'medium'}]: "${reminder.title}" (ID: ${String(reminder._id)})`,
          );
          this.trackPriorityProcessing(reminder.priority);
          processed++;
        }
      } catch (error) {
        // Handle processing failure
        await this.handleReminderFailure(reminder, error, 'one-time');
        failed++;
      }
    }

    return { processed, failed };
  }

  /**
   * Process recurring reminders (status: 'active')
   */
  private async processRecurringReminders(
    now: Date,
  ): Promise<{ processed: number; failed: number }> {
    const dueRecurringReminders = await this.collection
      .find({
        status: 'active',
        nextDueDate: { $lte: now },
      })
      .sort({ priority: -1, nextDueDate: 1 }) // High priority first, then by due date
      .toArray();

    if (dueRecurringReminders.length === 0) {
      return { processed: 0, failed: 0 };
    }

    this.logger.log(
      `Found ${dueRecurringReminders.length} due recurring reminder(s)`,
    );

    let processed = 0;
    let failed = 0;

    for (const reminder of dueRecurringReminders) {
      try {
        // Skip if retry backoff period hasn't elapsed
        if (reminder.nextRetryAt && reminder.nextRetryAt > now) {
          continue;
        }

        // Calculate next occurrence
        const nextOccurrence = calculateNextOccurrence(
          reminder.nextDueDate!,
          reminder.recurrencePattern!,
          reminder.recurrenceInterval ?? 1,
          reminder.timezone,
        );

        // Check if recurrence should stop
        const shouldStop = shouldStopRecurrence(
          nextOccurrence,
          reminder.recurrenceEndDate,
        );

        if (shouldStop) {
          // Mark as sent (recurrence ended)
          const result = await this.collection.findOneAndUpdate(
            {
              _id: reminder._id,
              status: 'active',
            },
            {
              $set: {
                status: 'sent',
                sentAt: now,
                lastProcessedAt: now,
                updatedAt: now,
              },
              $inc: {
                occurrenceCount: 1,
              },
              $unset: {
                failedAttempts: '',
                lastFailureReason: '',
                failedAt: '',
                nextRetryAt: '',
              },
            },
            {
              returnDocument: 'after',
            },
          );

          if (result) {
            this.logger.log(
              `Processed final occurrence of recurring reminder [${reminder.priority || 'medium'}]: "${reminder.title}" (ID: ${String(reminder._id)}) - recurrence ended`,
            );
            this.trackPriorityProcessing(reminder.priority);
            processed++;
          }
        } else {
          // Update with next occurrence
          const result = await this.collection.findOneAndUpdate(
            {
              _id: reminder._id,
              status: 'active',
            },
            {
              $set: {
                nextDueDate: nextOccurrence,
                lastProcessedAt: now,
                updatedAt: now,
              },
              $inc: {
                occurrenceCount: 1,
              },
              $unset: {
                failedAttempts: '',
                lastFailureReason: '',
                failedAt: '',
                nextRetryAt: '',
              },
            },
            {
              returnDocument: 'after',
            },
          );

          if (result) {
            this.logger.log(
              `Processed recurring reminder [${reminder.priority || 'medium'}]: "${reminder.title}" (ID: ${String(reminder._id)}) - next occurrence: ${nextOccurrence.toISOString()}`,
            );
            this.trackPriorityProcessing(reminder.priority);
            processed++;
          }
        }
      } catch (error) {
        // Handle processing failure
        await this.handleReminderFailure(reminder, error, 'recurring');
        failed++;
      }
    }

    return { processed, failed };
  }
}
