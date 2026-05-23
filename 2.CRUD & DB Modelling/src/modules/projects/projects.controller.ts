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
import { ProjectsService } from './projects.service';
import {
  createProjectSchema,
  type CreateProjectDto,
} from './dto/create-project.dto';
import {
  updateProjectSchema,
  type UpdateProjectDto,
} from './dto/update-project.dto';
import {
  listProjectsSchema,
  type ListProjectsDto,
} from './dto/list-projects.dto';
import {
  assignMemberSchema,
  updateMemberSchema,
  type AssignMemberDto,
  type UpdateMemberDto,
} from './dto/assign-member.dto';

const findOneQuerySchema = z
  .object({ includeMembers: z.coerce.boolean().optional() })
  .strict();

@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  @Post()
  create(@ZodBody(createProjectSchema) dto: CreateProjectDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@ZodQuery(listProjectsSchema) query: ListProjectsDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(findOneQuerySchema))
    query: { includeMembers?: boolean },
  ) {
    return this.service.findOne(id, query.includeMembers);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(updateProjectSchema) dto: UpdateProjectDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  // ─── N:N members ──────────────────────────────────────────────────────────

  @Get(':id/members')
  listMembers(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listMembers(id);
  }

  @Post(':id/members')
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(assignMemberSchema) dto: AssignMemberDto,
  ) {
    return this.service.addMember(id, dto);
  }

  @Patch(':id/members/:employeeId')
  updateMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @ZodBody(updateMemberSchema) dto: UpdateMemberDto,
  ) {
    return this.service.updateMember(id, employeeId, dto);
  }

  @Delete(':id/members/:employeeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return this.service.removeMember(id, employeeId);
  }
}
