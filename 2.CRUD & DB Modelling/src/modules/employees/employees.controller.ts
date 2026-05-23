import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodBody, ZodQuery } from '../../common/decorators/zod.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createEmployeeSchema,
  type CreateEmployeeDto,
} from './dto/create-employee.dto';
import {
  employeeIncludeFields,
  listEmployeesSchema,
  type EmployeeInclude,
  type ListEmployeesDto,
} from './dto/list-employees.dto';
import {
  updateEmployeeSchema,
  type UpdateEmployeeDto,
} from './dto/update-employee.dto';
import {
  upsertEmployeeProfileSchema,
  type UpsertEmployeeProfileDto,
} from './dto/employee-profile.dto';
import { EmployeesService } from './employees.service';

const findOneIncludeSchema = z
  .object({
    include: z
      .string()
      .transform((s) =>
        s
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.enum(employeeIncludeFields)))
      .optional(),
  })
  .strict();

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  create(@ZodBody(createEmployeeSchema) dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Get()
  findAll(@ZodQuery(listEmployeesSchema) query: ListEmployeesDto) {
    return this.employeesService.findAll(query);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(findOneIncludeSchema))
    query: { include?: EmployeeInclude[] },
  ) {
    return this.employeesService.findOne(id, query.include);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(updateEmployeeSchema) dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.remove(id);
  }

  // ─── 1:1 profile ──────────────────────────────────────────────────────────

  @Get(':id/profile')
  getProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.getProfile(id);
  }

  @Put(':id/profile')
  upsertProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(upsertEmployeeProfileSchema) dto: UpsertEmployeeProfileDto,
  ) {
    return this.employeesService.upsertProfile(id, dto);
  }

  // ─── N:N projects ─────────────────────────────────────────────────────────

  @Get(':id/projects')
  listProjects(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.listProjects(id);
  }
}
