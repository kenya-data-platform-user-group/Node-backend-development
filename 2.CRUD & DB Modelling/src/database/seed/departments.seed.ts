import type { NewDepartmentRow } from '../../modules/departments/schema/department.schema';

export const departmentSeedData: NewDepartmentRow[] = [
  { name: 'Engineering', description: 'Builds and maintains the platform.' },
  { name: 'Product', description: 'Owns product strategy and design.' },
  { name: 'Sales', description: 'Customer acquisition and account growth.' },
  { name: 'Marketing', description: 'Brand, demand-gen, and content.' },
  { name: 'People', description: 'Talent, HR, and culture.' },
  { name: 'Finance', description: 'Accounting, planning, and treasury.' },
];
