import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, type SQL } from 'drizzle-orm';
import { isUniqueViolation } from '../../common/errors/postgres-error.helpers';
import { DRIZZLE, type DrizzleDB } from '../../database/database.constants';
import { departments, type DepartmentRow } from './schema/department.schema';
import type { CreateDepartmentDto } from './dto/create-department.dto';
import type { UpdateDepartmentDto } from './dto/update-department.dto';
import type { ListDepartmentsDto } from './dto/list-departments.dto';
import type { PaginatedResult } from '../employees/dto/list-employees.dto';

@Injectable()
export class DepartmentsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(dto: CreateDepartmentDto): Promise<DepartmentRow> {
    try {
      const [row] = await this.db.insert(departments).values(dto).returning();
      return row;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(`Department "${dto.name}" already exists`);
      }
      throw err;
    }
  }

  async findAll(
    query: ListDepartmentsDto,
  ): Promise<PaginatedResult<DepartmentRow>> {
    const { page, pageSize, sortBy, sortOrder, search, includeEmployees } =
      query;

    const filters: SQL[] = [];
    if (search) filters.push(ilike(departments.name, `%${search}%`));
    const whereClause = filters.length ? and(...filters) : undefined;
    const orderFn = sortOrder === 'asc' ? asc : desc;
    const offset = (page - 1) * pageSize;

    const [rows, [{ total }]] = await Promise.all([
      includeEmployees
        ? this.db.query.departments.findMany({
            where: whereClause,
            orderBy: orderFn(departments[sortBy]),
            limit: pageSize,
            offset,
            with: { employees: true },
          })
        : this.db
            .select()
            .from(departments)
            .where(whereClause)
            .orderBy(orderFn(departments[sortBy]))
            .limit(pageSize)
            .offset(offset),
      this.db.select({ total: count() }).from(departments).where(whereClause),
    ]);

    return {
      data: rows as DepartmentRow[],
      meta: {
        page,
        pageSize,
        total: Number(total),
        totalPages: Math.max(1, Math.ceil(Number(total) / pageSize)),
      },
    };
  }

  async findOne(id: string, includeEmployees = false): Promise<DepartmentRow> {
    const row = includeEmployees
      ? await this.db.query.departments.findFirst({
          where: eq(departments.id, id),
          with: { employees: true },
        })
      : (
          await this.db
            .select()
            .from(departments)
            .where(eq(departments.id, id))
            .limit(1)
        )[0];

    if (!row) throw new NotFoundException(`Department ${id} not found`);
    return row;
  }

  async update(id: string, dto: UpdateDepartmentDto): Promise<DepartmentRow> {
    if (Object.keys(dto).length === 0) return this.findOne(id);

    try {
      const [row] = await this.db
        .update(departments)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(departments.id, id))
        .returning();

      if (!row) throw new NotFoundException(`Department ${id} not found`);
      return row;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(`Department "${dto.name}" already exists`);
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.db
      .delete(departments)
      .where(eq(departments.id, id))
      .returning({ id: departments.id });

    if (result.length === 0) {
      throw new NotFoundException(`Department ${id} not found`);
    }
  }
}
