/**
 * Processing metrics for reminder processing
 */
export interface ProcessingMetrics {
  // Overall statistics
  totalProcessed: number;
  totalSucceeded: number;
  totalFailed: number;
  totalRetried: number;

  // Breakdown by type
  oneTimeProcessed: number;
  oneTimeSucceeded: number;
  oneTimeFailed: number;

  recurringProcessed: number;
  recurringSucceeded: number;
  recurringFailed: number;

  // Breakdown by priority
  highPriorityProcessed: number;
  mediumPriorityProcessed: number;
  lowPriorityProcessed: number;

  // Performance metrics
  averageProcessingTimeMs: number;
  lastProcessingTimeMs: number;
  lastRunAt?: Date;

  // Cumulative statistics (since server start)
  lifetimeProcessed: number;
  lifetimeSucceeded: number;
  lifetimeFailed: number;
}

/**
 * Single processing run statistics
 */
export interface ProcessingRunStats {
  processed: number;
  succeeded: number;
  failed: number;
  retried: number;
  startTime: Date;
  endTime: Date;
  durationMs: number;
}
