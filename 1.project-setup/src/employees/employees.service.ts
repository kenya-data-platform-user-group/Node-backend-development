import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.constants';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import type {
  ListEmployeesDto,
  PaginatedResult,
} from './dto/list-employees.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { employees, type EmployeeRow } from './schema/employee.schema';

// Postgres "unique_violation" — see https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class EmployeesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(dto: CreateEmployeeDto): Promise<EmployeeRow> {
    try {
      const [row] = await this.db.insert(employees).values(dto).returning();
      return row;
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException(
          `Employee with email "${dto.email}" already exists`,
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
      department,
      position,
      isActive,
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
    if (department) filters.push(ilike(employees.department, department));
    if (position) filters.push(ilike(employees.position, position));
    if (isActive !== undefined) filters.push(eq(employees.isActive, isActive));

    const whereClause = filters.length > 0 ? and(...filters) : undefined;
    const orderFn = sortOrder === 'asc' ? asc : desc;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(employees)
        .where(whereClause)
        .orderBy(orderFn(employees[sortBy]))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ total: count() }).from(employees).where(whereClause),
    ]);

    return {
      data: rows,
      meta: {
        page,
        pageSize,
        total: Number(total),
        totalPages: Math.max(1, Math.ceil(Number(total) / pageSize)),
      },
    };
  }

  async findOne(id: string): Promise<EmployeeRow> {
    const [row] = await this.db
      .select()
      .from(employees)
      .where(eq(employees.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Employee ${id} not found`);
    }
    return row;
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<EmployeeRow> {
    if (Object.keys(dto).length === 0) {
      // Nothing to update — return current row (also validates existence).
      return this.findOne(id);
    }

    try {
      const [row] = await this.db
        .update(employees)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(employees.id, id))
        .returning();

      if (!row) {
        throw new NotFoundException(`Employee ${id} not found`);
      }
      return row;
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException(
          `Employee with email "${dto.email}" already exists`,
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

  private isUniqueViolation(err: unknown): boolean {
    const hasCode = (e: unknown): e is { code?: string } =>
      typeof e === 'object' && e !== null && 'code' in e;
    if (hasCode(err) && err.code === PG_UNIQUE_VIOLATION) return true;
    // drizzle wraps the underlying pg error on `.cause`
    if (
      typeof err === 'object' &&
      err !== null &&
      'cause' in err &&
      hasCode((err as { cause?: unknown }).cause) &&
      (err as { cause: { code?: string } }).cause.code === PG_UNIQUE_VIOLATION
    ) {
      return true;
    }
    return false;
  }
}
