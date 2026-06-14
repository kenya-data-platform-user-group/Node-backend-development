import { ObjectId } from 'mongodb';
import { z } from 'zod';

export const ObjectIdSchema = z
  .string()
  .refine((val) => ObjectId.isValid(val), {
    message: 'Invalid ObjectId format',
  });
