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
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodBody, ZodQuery } from '../../common/decorators/zod.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DepartmentsService } from './departments.service';
import {
  createDepartmentSchema,
  type CreateDepartmentDto,
} from './dto/create-department.dto';
import {
  listDepartmentsSchema,
  type ListDepartmentsDto,
} from './dto/list-departments.dto';
import {
  updateDepartmentSchema,
  type UpdateDepartmentDto,
} from './dto/update-department.dto';

const findOneQuerySchema = z
  .object({ includeEmployees: z.coerce.boolean().optional() })
  .strict();

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @Post()
  create(@ZodBody(createDepartmentSchema) dto: CreateDepartmentDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@ZodQuery(listDepartmentsSchema) query: ListDepartmentsDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(findOneQuerySchema))
    query: { includeEmployees?: boolean },
  ) {
    return this.service.findOne(id, query.includeEmployees);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(updateDepartmentSchema) dto: UpdateDepartmentDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
