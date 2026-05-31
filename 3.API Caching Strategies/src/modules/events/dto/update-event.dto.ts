import { z } from 'zod';
import { eventBaseSchema } from './create-event.dto';

export const updateEventSchema = eventBaseSchema
  .partial()
  .superRefine((value, ctx) => {
    if (
      value.startsAt &&
      value.endsAt &&
      new Date(value.endsAt) <= new Date(value.startsAt)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'endsAt must be later than startsAt',
      });
    }
  });

export type UpdateEventDto = z.infer<typeof updateEventSchema>;
