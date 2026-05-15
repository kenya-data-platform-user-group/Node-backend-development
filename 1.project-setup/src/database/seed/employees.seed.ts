import type { NewEmployeeRow } from '../../employees/schema/employee.schema';

/**
 * Demo dataset for the employees table.
 *
 * Emails are unique because the table has a `UNIQUE` constraint on `email`.
 * Department / position values are intentionally repeated so the filter
 * endpoints (`?department=...`, `?position=...`) return meaningful groups.
 */
export const employeeSeedData: NewEmployeeRow[] = [
  // ── Engineering ─────────────────────────────────────────────────────────
  {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.doe@example.com',
    position: 'Staff Engineer',
    department: 'Engineering',
    notes: 'Tech lead for the platform team.',
    isActive: true,
  },
  {
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@example.com',
    position: 'Engineering Manager',
    department: 'Engineering',
    notes: 'Manages the platform team.',
    isActive: true,
  },
  {
    firstName: 'Liam',
    lastName: 'Nguyen',
    email: 'liam.nguyen@example.com',
    position: 'Senior Engineer',
    department: 'Engineering',
    isActive: true,
  },
  {
    firstName: 'Sofia',
    lastName: 'Garcia',
    email: 'sofia.garcia@example.com',
    position: 'Engineer',
    department: 'Engineering',
    isActive: true,
  },
  {
    firstName: 'Noah',
    lastName: 'Wilson',
    email: 'noah.wilson@example.com',
    position: 'Engineer',
    department: 'Engineering',
    isActive: false,
    notes: 'On extended leave.',
  },
  {
    firstName: 'Mia',
    lastName: 'Patel',
    email: 'mia.patel@example.com',
    position: 'Junior Engineer',
    department: 'Engineering',
    isActive: true,
  },

  // ── Product / Design ────────────────────────────────────────────────────
  {
    firstName: 'Alice',
    lastName: 'Brown',
    email: 'alice.brown@example.com',
    position: 'Senior Designer',
    department: 'Product',
    isActive: true,
  },
  {
    firstName: 'Ethan',
    lastName: 'Kim',
    email: 'ethan.kim@example.com',
    position: 'Product Manager',
    department: 'Product',
    isActive: true,
  },
  {
    firstName: 'Olivia',
    lastName: 'Martinez',
    email: 'olivia.martinez@example.com',
    position: 'Designer',
    department: 'Product',
    isActive: true,
  },
  {
    firstName: 'Lucas',
    lastName: 'Anderson',
    email: 'lucas.anderson@example.com',
    position: 'Product Manager',
    department: 'Product',
    isActive: false,
  },

  // ── Sales ───────────────────────────────────────────────────────────────
  {
    firstName: 'Emma',
    lastName: 'Taylor',
    email: 'emma.taylor@example.com',
    position: 'Account Executive',
    department: 'Sales',
    isActive: true,
  },
  {
    firstName: 'James',
    lastName: 'Walker',
    email: 'james.walker@example.com',
    position: 'Sales Manager',
    department: 'Sales',
    isActive: true,
    notes: 'EMEA region lead.',
  },
  {
    firstName: 'Ava',
    lastName: 'Robinson',
    email: 'ava.robinson@example.com',
    position: 'Account Executive',
    department: 'Sales',
    isActive: true,
  },
  {
    firstName: 'Henry',
    lastName: 'Clark',
    email: 'henry.clark@example.com',
    position: 'Sales Development Rep',
    department: 'Sales',
    isActive: true,
  },

  // ── Marketing ───────────────────────────────────────────────────────────
  {
    firstName: 'Isabella',
    lastName: 'Lewis',
    email: 'isabella.lewis@example.com',
    position: 'Marketing Manager',
    department: 'Marketing',
    isActive: true,
  },
  {
    firstName: 'Mason',
    lastName: 'Hall',
    email: 'mason.hall@example.com',
    position: 'Content Strategist',
    department: 'Marketing',
    isActive: true,
  },

  // ── People / HR ─────────────────────────────────────────────────────────
  {
    firstName: 'Charlotte',
    lastName: 'Young',
    email: 'charlotte.young@example.com',
    position: 'HR Manager',
    department: 'People',
    isActive: true,
  },
  {
    firstName: 'Benjamin',
    lastName: 'King',
    email: 'benjamin.king@example.com',
    position: 'Recruiter',
    department: 'People',
    isActive: true,
  },

  // ── Finance ─────────────────────────────────────────────────────────────
  {
    firstName: 'Amelia',
    lastName: 'Wright',
    email: 'amelia.wright@example.com',
    position: 'Finance Manager',
    department: 'Finance',
    isActive: true,
  },
  {
    firstName: 'Daniel',
    lastName: 'Scott',
    email: 'daniel.scott@example.com',
    position: 'Accountant',
    department: 'Finance',
    isActive: false,
    notes: 'Contract ended 2026-04.',
  },
];
