import { z } from 'zod';

export const eventCategories = [
  'conference',
  'meetup',
  'workshop',
  'webinar',
  'hackathon',
] as const;

export const eventStatuses = ['draft', 'published', 'cancelled'] as const;

export const eventBaseSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    slug: z
      .string()
      .trim()
      .min(3)
      .max(180)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().trim().min(10).max(5000).optional(),
    location: z.string().trim().min(2).max(160),
    organizer: z.string().trim().min(2).max(120),
    category: z.enum(eventCategories),
    status: z.enum(eventStatuses).default('draft'),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    capacity: z.coerce.number().int().positive().max(100000).optional(),
    isVirtual: z.boolean().default(false),
  })
  .strict();

export const createEventSchema = eventBaseSchema.superRefine((value, ctx) => {
  if (new Date(value.endsAt) <= new Date(value.startsAt)) {
    ctx.addIssue({
      code: 'custom',
      path: ['endsAt'],
      message: 'endsAt must be later than startsAt',
    });
  }
});

export type CreateEventDto = z.infer<typeof createEventSchema>;
