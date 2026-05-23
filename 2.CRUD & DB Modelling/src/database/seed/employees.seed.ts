import type { NewEmployeeRow } from '../../modules/employees/schema/employee.schema';

/**
 * Demo dataset for the employees table.
 *
 * `departmentName` is the lookup key — the seed runner resolves it to the
 * matching `departments.id` and substitutes `departmentId` at insert time.
 */
export type EmployeeSeedRow = Omit<NewEmployeeRow, 'departmentId'> & {
  departmentName?: string;
};

export const employeeSeedData: EmployeeSeedRow[] = [
  // ── Engineering ─────────────────────────────────────────────────────────
  {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.doe@example.com',
    position: 'Staff Engineer',
    departmentName: 'Engineering',
    notes: 'Tech lead for the platform team.',
    isActive: true,
  },
  {
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@example.com',
    position: 'Engineering Manager',
    departmentName: 'Engineering',
    notes: 'Manages the platform team.',
    isActive: true,
  },
  {
    firstName: 'Liam',
    lastName: 'Nguyen',
    email: 'liam.nguyen@example.com',
    position: 'Senior Engineer',
    departmentName: 'Engineering',
    isActive: true,
  },
  {
    firstName: 'Sofia',
    lastName: 'Garcia',
    email: 'sofia.garcia@example.com',
    position: 'Engineer',
    departmentName: 'Engineering',
    isActive: true,
  },
  {
    firstName: 'Noah',
    lastName: 'Wilson',
    email: 'noah.wilson@example.com',
    position: 'Engineer',
    departmentName: 'Engineering',
    isActive: false,
    notes: 'On extended leave.',
  },
  {
    firstName: 'Mia',
    lastName: 'Patel',
    email: 'mia.patel@example.com',
    position: 'Junior Engineer',
    departmentName: 'Engineering',
    isActive: true,
  },

  // ── Product / Design ────────────────────────────────────────────────────
  {
    firstName: 'Alice',
    lastName: 'Brown',
    email: 'alice.brown@example.com',
    position: 'Senior Designer',
    departmentName: 'Product',
    isActive: true,
  },
  {
    firstName: 'Ethan',
    lastName: 'Kim',
    email: 'ethan.kim@example.com',
    position: 'Product Manager',
    departmentName: 'Product',
    isActive: true,
  },
  {
    firstName: 'Olivia',
    lastName: 'Martinez',
    email: 'olivia.martinez@example.com',
    position: 'Designer',
    departmentName: 'Product',
    isActive: true,
  },
  {
    firstName: 'Lucas',
    lastName: 'Anderson',
    email: 'lucas.anderson@example.com',
    position: 'Product Manager',
    departmentName: 'Product',
    isActive: false,
  },

  // ── Sales ───────────────────────────────────────────────────────────────
  {
    firstName: 'Emma',
    lastName: 'Taylor',
    email: 'emma.taylor@example.com',
    position: 'Account Executive',
    departmentName: 'Sales',
    isActive: true,
  },
  {
    firstName: 'James',
    lastName: 'Walker',
    email: 'james.walker@example.com',
    position: 'Sales Manager',
    departmentName: 'Sales',
    isActive: true,
    notes: 'EMEA region lead.',
  },
  {
    firstName: 'Ava',
    lastName: 'Robinson',
    email: 'ava.robinson@example.com',
    position: 'Account Executive',
    departmentName: 'Sales',
    isActive: true,
  },
  {
    firstName: 'Henry',
    lastName: 'Clark',
    email: 'henry.clark@example.com',
    position: 'Sales Development Rep',
    departmentName: 'Sales',
    isActive: true,
  },

  // ── Marketing ───────────────────────────────────────────────────────────
  {
    firstName: 'Isabella',
    lastName: 'Lewis',
    email: 'isabella.lewis@example.com',
    position: 'Marketing Manager',
    departmentName: 'Marketing',
    isActive: true,
  },
  {
    firstName: 'Mason',
    lastName: 'Hall',
    email: 'mason.hall@example.com',
    position: 'Content Strategist',
    departmentName: 'Marketing',
    isActive: true,
  },

  // ── People / HR ─────────────────────────────────────────────────────────
  {
    firstName: 'Charlotte',
    lastName: 'Young',
    email: 'charlotte.young@example.com',
    position: 'HR Manager',
    departmentName: 'People',
    isActive: true,
  },
  {
    firstName: 'Benjamin',
    lastName: 'King',
    email: 'benjamin.king@example.com',
    position: 'Recruiter',
    departmentName: 'People',
    isActive: true,
  },

  // ── Finance ─────────────────────────────────────────────────────────────
  {
    firstName: 'Amelia',
    lastName: 'Wright',
    email: 'amelia.wright@example.com',
    position: 'Finance Manager',
    departmentName: 'Finance',
    isActive: true,
  },
  {
    firstName: 'Daniel',
    lastName: 'Scott',
    email: 'daniel.scott@example.com',
    position: 'Accountant',
    departmentName: 'Finance',
    isActive: false,
    notes: 'Contract ended 2026-04.',
  },
];
