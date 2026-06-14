import { z } from 'zod';
import { parseFlexibleDate } from '../../../common/utils/date.helper';
import { validateTimezone } from '../../../common/utils/timezone.helper';

export const CreateReminderBaseSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less'),
  message: z
    .string()
    .min(1, 'Message is required')
    .max(1000, 'Message must be 1000 characters or less'),
  dueDate: z.preprocess(parseFlexibleDate, z.date()),

  // Priority support
  priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),

  // Timezone support
  timezone: z
    .string()
    .refine(
      (tz) => {
        try {
          validateTimezone(tz);
          return true;
        } catch {
          return false;
        }
      },
      {
        message:
          'Invalid IANA timezone identifier (e.g., America/New_York, Europe/London, Asia/Tokyo)',
      },
    )
    .optional(),

  // Recurrence support
  isRecurring: z.boolean().optional().default(false),
  recurrencePattern: z
    .enum(['minutely', 'hourly', 'daily', 'weekly', 'monthly'])
    .optional(),
  recurrenceInterval: z.number().int().min(1).max(365).optional().default(1),
  recurrenceEndDate: z.preprocess(parseFlexibleDate, z.date()).optional(),
});

export const CreateReminderSchema = CreateReminderBaseSchema.refine(
  (data) => {
    if (data.isRecurring && !data.recurrencePattern) {
      return false;
    }
    return true;
  },
  {
    message: 'recurrencePattern is required when isRecurring is true',
    path: ['recurrencePattern'],
  },
);

export type CreateReminderDto = z.infer<typeof CreateReminderSchema>;
