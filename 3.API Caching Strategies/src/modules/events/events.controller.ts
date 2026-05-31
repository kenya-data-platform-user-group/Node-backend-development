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
} from '@nestjs/common';
import { ZodBody, ZodQuery } from '../../common/decorators/zod.decorators';
import { createEventSchema, type CreateEventDto } from './dto/create-event.dto';
import { listEventsSchema, type ListEventsDto } from './dto/list-events.dto';
import { updateEventSchema, type UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(@ZodBody(createEventSchema) dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Get()
  findAll(@ZodQuery(listEventsSchema) query: ListEventsDto) {
    return this.eventsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(updateEventSchema) dto: UpdateEventDto,
  ) {
    return this.eventsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.remove(id);
  }
}
