import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import {
  isFkViolation,
  isUniqueViolation,
} from '../../common/errors/postgres-error.helpers';
import { DRIZZLE, type DrizzleDB } from '../../database/database.constants';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import type {
  EmployeeInclude,
  ListEmployeesDto,
  PaginatedResult,
} from './dto/list-employees.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import type { UpsertEmployeeProfileDto } from './dto/employee-profile.dto';
import { employees, type EmployeeRow } from './schema/employee.schema';
import {
  employeeProfiles,
  type EmployeeProfileRow,
} from './schema/employee-profile.schema';
import { employeeProjects } from '../projects/schema/employee-project.schema';
import { projects, type ProjectRow } from '../projects/schema/project.schema';

/** Build the `with` object passed to drizzle's relational query API. */
function buildWith(include: EmployeeInclude[] | undefined) {
  if (!include?.length) return undefined;
  return {
    department: include.includes('department') ? (true as const) : undefined,
    profile: include.includes('profile') ? (true as const) : undefined,
    projects: include.includes('projects')
      ? { with: { project: true as const } }
      : undefined,
  };
}

@Injectable()
export class EmployeesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(dto: CreateEmployeeDto): Promise<EmployeeRow> {
    try {
      const [row] = await this.db.insert(employees).values(dto).returning();
      return row;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(
          `Employee with email "${dto.email}" already exists`,
        );
      }
      if (isFkViolation(err)) {
        throw new ConflictException(
          `departmentId "${dto.departmentId}" does not reference an existing department`,
        );
      }
      throw err;
    }
  }

  async findAll(
    query: ListEmployeesDto,
  ): Promise<PaginatedResult<EmployeeRow>> {
    const {
      page,
      pageSize,
      sortBy,
      sortOrder,
      search,
      departmentId,
      position,
      isActive,
      include,
    } = query;

    const filters: SQL[] = [];
    if (search) {
      const pattern = `%${search}%`;
      const searchFilter = or(
        ilike(employees.firstName, pattern),
        ilike(employees.lastName, pattern),
        ilike(employees.email, pattern),
      );
      if (searchFilter) filters.push(searchFilter);
    }
    if (departmentId) filters.push(eq(employees.departmentId, departmentId));
    if (position) filters.push(ilike(employees.position, position));
    if (isActive !== undefined) filters.push(eq(employees.isActive, isActive));

    const whereClause = filters.length > 0 ? and(...filters) : undefined;
    const orderFn = sortOrder === 'asc' ? asc : desc;
    const offset = (page - 1) * pageSize;

    const withClause = buildWith(include);

    const [rows, [{ total }]] = await Promise.all([
      withClause
        ? this.db.query.employees.findMany({
            where: whereClause,
            orderBy: orderFn(employees[sortBy]),
            limit: pageSize,
            offset,
            with: withClause,
          })
        : this.db
            .select()
            .from(employees)
            .where(whereClause)
            .orderBy(orderFn(employees[sortBy]))
            .limit(pageSize)
            .offset(offset),
      this.db.select({ total: count() }).from(employees).where(whereClause),
    ]);

    return {
      data: rows as EmployeeRow[],
      meta: {
        page,
        pageSize,
        total: Number(total),
        totalPages: Math.max(1, Math.ceil(Number(total) / pageSize)),
      },
    };
  }

  async findOne(id: string, include?: EmployeeInclude[]): Promise<EmployeeRow> {
    const withClause = buildWith(include);

    const row = withClause
      ? await this.db.query.employees.findFirst({
          where: eq(employees.id, id),
          with: withClause,
        })
      : (
          await this.db
            .select()
            .from(employees)
            .where(eq(employees.id, id))
            .limit(1)
        )[0];

    if (!row) throw new NotFoundException(`Employee ${id} not found`);
    return row;
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<EmployeeRow> {
    if (Object.keys(dto).length === 0) return this.findOne(id);

    try {
      const [row] = await this.db
        .update(employees)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(employees.id, id))
        .returning();

      if (!row) throw new NotFoundException(`Employee ${id} not found`);
      return row;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(
          `Employee with email "${dto.email}" already exists`,
        );
      }
      if (isFkViolation(err)) {
        throw new ConflictException(
          `departmentId "${dto.departmentId}" does not reference an existing department`,
        );
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.db
      .delete(employees)
      .where(eq(employees.id, id))
      .returning({ id: employees.id });

    if (result.length === 0) {
      throw new NotFoundException(`Employee ${id} not found`);
    }
  }

  // ─── 1:1 — employee profile ───────────────────────────────────────────────

  async getProfile(employeeId: string): Promise<EmployeeProfileRow> {
    await this.findOne(employeeId); // 404 if employee missing
    const [row] = await this.db
      .select()
      .from(employeeProfiles)
      .where(eq(employeeProfiles.employeeId, employeeId))
      .limit(1);
    if (!row) {
      throw new NotFoundException(`Employee ${employeeId} has no profile yet`);
    }
    return row;
  }

  /**
   * Insert-or-update the 1:1 profile row. Postgres `ON CONFLICT (employee_id)
   * DO UPDATE` keeps the call idempotent.
   */
  async upsertProfile(
    employeeId: string,
    dto: UpsertEmployeeProfileDto,
  ): Promise<EmployeeProfileRow> {
    await this.findOne(employeeId); // 404 if employee missing

    const [row] = await this.db
      .insert(employeeProfiles)
      .values({ employeeId, ...dto })
      .onConflictDoUpdate({
        target: employeeProfiles.employeeId,
        set: { ...dto, updatedAt: new Date() },
      })
      .returning();
    return row;
  }

  // ─── N:N — projects an employee belongs to ────────────────────────────────

  /**
   * Returns the projects this employee is assigned to, with their role and
   * allocation. Demonstrates joining through a junction with explicit SQL.
   */
  async listProjects(
    employeeId: string,
  ): Promise<Array<{ project: ProjectRow; role: string; allocation: number }>> {
    await this.findOne(employeeId); // 404 if employee missing

    const rows = await this.db
      .select({
        project: projects,
        role: employeeProjects.role,
        allocation: employeeProjects.allocation,
      })
      .from(employeeProjects)
      .innerJoin(projects, eq(employeeProjects.projectId, projects.id))
      .where(eq(employeeProjects.employeeId, employeeId));

    return rows;
  }
}
