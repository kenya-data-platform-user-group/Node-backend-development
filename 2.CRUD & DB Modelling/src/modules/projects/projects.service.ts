import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, type SQL } from 'drizzle-orm';
import {
  isFkViolation,
  isUniqueViolation,
} from '../../common/errors/postgres-error.helpers';
import { DRIZZLE, type DrizzleDB } from '../../database/database.constants';
import { employees } from '../employees/schema/employee.schema';
import type { PaginatedResult } from '../employees/dto/list-employees.dto';
import {
  employeeProjects,
  type EmployeeProjectRow,
} from './schema/employee-project.schema';
import { projects, type ProjectRow } from './schema/project.schema';
import type { CreateProjectDto } from './dto/create-project.dto';
import type { UpdateProjectDto } from './dto/update-project.dto';
import type { ListProjectsDto } from './dto/list-projects.dto';
import type { AssignMemberDto, UpdateMemberDto } from './dto/assign-member.dto';

@Injectable()
export class ProjectsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async create(dto: CreateProjectDto): Promise<ProjectRow> {
    try {
      const [row] = await this.db.insert(projects).values(dto).returning();
      return row;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(`Project "${dto.name}" already exists`);
      }
      throw err;
    }
  }

  async findAll(query: ListProjectsDto): Promise<PaginatedResult<ProjectRow>> {
    const {
      page,
      pageSize,
      sortBy,
      sortOrder,
      search,
      isActive,
      includeMembers,
    } = query;

    const filters: SQL[] = [];
    if (search) filters.push(ilike(projects.name, `%${search}%`));
    if (isActive !== undefined) filters.push(eq(projects.isActive, isActive));
    const whereClause = filters.length ? and(...filters) : undefined;
    const orderFn = sortOrder === 'asc' ? asc : desc;
    const offset = (page - 1) * pageSize;

    const [rows, [{ total }]] = await Promise.all([
      includeMembers
        ? this.db.query.projects.findMany({
            where: whereClause,
            orderBy: orderFn(projects[sortBy]),
            limit: pageSize,
            offset,
            with: { members: { with: { employee: true } } },
          })
        : this.db
            .select()
            .from(projects)
            .where(whereClause)
            .orderBy(orderFn(projects[sortBy]))
            .limit(pageSize)
            .offset(offset),
      this.db.select({ total: count() }).from(projects).where(whereClause),
    ]);

    return {
      data: rows as ProjectRow[],
      meta: {
        page,
        pageSize,
        total: Number(total),
        totalPages: Math.max(1, Math.ceil(Number(total) / pageSize)),
      },
    };
  }

  async findOne(id: string, includeMembers = false): Promise<ProjectRow> {
    const row = includeMembers
      ? await this.db.query.projects.findFirst({
          where: eq(projects.id, id),
          with: { members: { with: { employee: true } } },
        })
      : (
          await this.db
            .select()
            .from(projects)
            .where(eq(projects.id, id))
            .limit(1)
        )[0];

    if (!row) throw new NotFoundException(`Project ${id} not found`);
    return row;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<ProjectRow> {
    if (Object.keys(dto).length === 0) return this.findOne(id);

    try {
      const [row] = await this.db
        .update(projects)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(projects.id, id))
        .returning();

      if (!row) throw new NotFoundException(`Project ${id} not found`);
      return row;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(`Project "${dto.name}" already exists`);
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning({ id: projects.id });
    if (result.length === 0) {
      throw new NotFoundException(`Project ${id} not found`);
    }
  }

  // ─── N:N members ──────────────────────────────────────────────────────────

  async listMembers(projectId: string) {
    await this.findOne(projectId); // ensure exists → 404 if not
    return this.db
      .select({
        employeeId: employeeProjects.employeeId,
        role: employeeProjects.role,
        allocation: employeeProjects.allocation,
        assignedAt: employeeProjects.assignedAt,
        employee: employees,
      })
      .from(employeeProjects)
      .innerJoin(employees, eq(employees.id, employeeProjects.employeeId))
      .where(eq(employeeProjects.projectId, projectId));
  }

  async addMember(
    projectId: string,
    dto: AssignMemberDto,
  ): Promise<EmployeeProjectRow> {
    try {
      const [row] = await this.db
        .insert(employeeProjects)
        .values({
          projectId,
          employeeId: dto.employeeId,
          role: dto.role,
          allocation: dto.allocation,
        })
        .returning();
      return row;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(
          `Employee ${dto.employeeId} is already assigned to project ${projectId}`,
        );
      }
      if (isFkViolation(err)) {
        throw new ConflictException(
          `Project ${projectId} or employee ${dto.employeeId} does not exist`,
        );
      }
      throw err;
    }
  }

  async updateMember(
    projectId: string,
    employeeId: string,
    dto: UpdateMemberDto,
  ): Promise<EmployeeProjectRow> {
    if (Object.keys(dto).length === 0) {
      const existing = await this.db
        .select()
        .from(employeeProjects)
        .where(
          and(
            eq(employeeProjects.projectId, projectId),
            eq(employeeProjects.employeeId, employeeId),
          ),
        )
        .limit(1);
      if (existing.length === 0) {
        throw new NotFoundException(
          `Assignment for employee ${employeeId} on project ${projectId} not found`,
        );
      }
      return existing[0];
    }

    const [row] = await this.db
      .update(employeeProjects)
      .set(dto)
      .where(
        and(
          eq(employeeProjects.projectId, projectId),
          eq(employeeProjects.employeeId, employeeId),
        ),
      )
      .returning();

    if (!row) {
      throw new NotFoundException(
        `Assignment for employee ${employeeId} on project ${projectId} not found`,
      );
    }
    return row;
  }

  async removeMember(projectId: string, employeeId: string): Promise<void> {
    const result = await this.db
      .delete(employeeProjects)
      .where(
        and(
          eq(employeeProjects.projectId, projectId),
          eq(employeeProjects.employeeId, employeeId),
        ),
      )
      .returning({ employeeId: employeeProjects.employeeId });

    if (result.length === 0) {
      throw new NotFoundException(
        `Assignment for employee ${employeeId} on project ${projectId} not found`,
      );
    }
  }

  // ─── error helpers ────────────────────────────────────────────────────────
}
