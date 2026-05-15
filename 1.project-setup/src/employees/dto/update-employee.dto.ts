import { createEmployeeSchema } from './create-employee.dto';
import { z } from 'zod';

export const updateEmployeeSchema = createEmployeeSchema.partial();

export type UpdateEmployeeDto = z.infer<typeof updateEmployeeSchema>;
