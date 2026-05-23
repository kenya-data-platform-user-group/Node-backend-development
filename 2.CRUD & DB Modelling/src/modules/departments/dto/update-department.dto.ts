import { z } from 'zod';
import { createDepartmentSchema } from './create-department.dto';

export const updateDepartmentSchema = createDepartmentSchema.partial();
export type UpdateDepartmentDto = z.infer<typeof updateDepartmentSchema>;
