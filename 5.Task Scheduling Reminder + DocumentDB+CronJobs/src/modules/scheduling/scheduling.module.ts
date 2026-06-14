import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ReminderProcessorService } from './reminder-processor.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [ReminderProcessorService],
  exports: [ReminderProcessorService],
})
export class SchedulingModule {}
