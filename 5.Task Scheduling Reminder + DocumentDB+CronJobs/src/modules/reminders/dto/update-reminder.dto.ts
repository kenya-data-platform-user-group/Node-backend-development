import { z } from 'zod';
import { CreateReminderBaseSchema } from './create-reminder.dto';

export const UpdateReminderSchema = CreateReminderBaseSchema.partial().refine(
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

export type UpdateReminderDto = z.infer<typeof UpdateReminderSchema>;
