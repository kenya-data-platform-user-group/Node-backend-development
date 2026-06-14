import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { ReminderProcessorService } from '../scheduling/reminder-processor.service';
import { ZodBody, ZodParam } from '../../common/decorators/zod.decorators';
import { ObjectIdSchema } from '../../common/schemas/object-id.schema';
import { CreateReminderSchema, UpdateReminderSchema } from './dto';
import type { CreateReminderDto, UpdateReminderDto } from './dto';

@Controller('reminders')
export class RemindersController {
  constructor(
    private readonly remindersService: RemindersService,
    private readonly reminderProcessorService: ReminderProcessorService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@ZodBody(CreateReminderSchema) dto: CreateReminderDto) {
    return this.remindersService.create(dto);
  }

  @Get()
  findAll() {
    return this.remindersService.findAll();
  }

  @Get('status/pending')
  findPending() {
    return this.remindersService.findByStatus('pending');
  }

  @Get('status/sent')
  findSent() {
    return this.remindersService.findByStatus('sent');
  }

  @Get('status/active')
  findActive() {
    return this.remindersService.findByStatus('active');
  }

  @Get('priority/high')
  findHighPriority() {
    return this.remindersService.findByPriority('high');
  }

  @Get('priority/medium')
  findMediumPriority() {
    return this.remindersService.findByPriority('medium');
  }

  @Get('priority/low')
  findLowPriority() {
    return this.remindersService.findByPriority('low');
  }

  @Get(':id')
  findOne(@ZodParam(ObjectIdSchema, 'id') id: string) {
    return this.remindersService.findOne(id);
  }

  @Patch(':id')
  update(
    @ZodParam(ObjectIdSchema, 'id') id: string,
    @ZodBody(UpdateReminderSchema) dto: UpdateReminderDto,
  ) {
    return this.remindersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@ZodParam(ObjectIdSchema, 'id') id: string) {
    return this.remindersService.remove(id);
  }

  @Get('metrics')
  getMetrics() {
    return this.reminderProcessorService.getMetrics();
  }

  @Get('health')
  async getHealth() {
    const stats = await this.getStats();
    const metrics = this.reminderProcessorService.getMetrics();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        totalReminders: stats.total,
        pending: stats.pending,
        active: stats.active,
        sent: stats.sent,
        failed: stats.failed,
      },
      processing: {
        lastRunAt: metrics.lastRunAt,
        lastProcessingTimeMs: metrics.lastProcessingTimeMs,
        averageProcessingTimeMs: Math.round(metrics.averageProcessingTimeMs),
        lifetimeProcessed: metrics.lifetimeProcessed,
        lifetimeSucceeded: metrics.lifetimeSucceeded,
        lifetimeFailed: metrics.lifetimeFailed,
      },
    };
  }

  /**
   * Get reminder statistics
   */
  private async getStats() {
    const [total, pending, active, sent, failed] = await Promise.all([
      this.remindersService.findAll().then((r) => r.length),
      this.remindersService.findByStatus('pending').then((r) => r.length),
      this.remindersService.findByStatus('active').then((r) => r.length),
      this.remindersService.findByStatus('sent').then((r) => r.length),
      this.remindersService.findByStatus('failed').then((r) => r.length),
    ]);

    return { total, pending, active, sent, failed };
  }
}
