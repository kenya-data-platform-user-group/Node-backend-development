import type { NewProjectRow } from '../../modules/projects/schema/project.schema';

export const projectSeedData: NewProjectRow[] = [
  {
    name: 'Atlas Platform v2',
    description: 'Next-gen multi-tenant platform rewrite.',
    isActive: true,
  },
  {
    name: 'Mobile Companion App',
    description: 'iOS + Android companion to the web product.',
    isActive: true,
  },
  {
    name: 'Q3 Lead-Gen Campaign',
    description: 'Cross-channel campaign targeting EMEA mid-market.',
    isActive: true,
  },
  {
    name: 'Internal Tools Refresh',
    description: 'Replace legacy admin dashboards with modern UI.',
    isActive: false,
  },
];
