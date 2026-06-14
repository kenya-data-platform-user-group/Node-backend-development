import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Collection, ObjectId } from 'mongodb';
import { Reminder } from './schemas/reminder.schema';
import { CreateReminderDto, UpdateReminderDto } from './dto';
import { calculateNextOccurrence } from '../../common/utils/recurrence.helper';

@Injectable()
export class RemindersService implements OnModuleInit {
  private collection!: Collection<Reminder>;

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    this.collection = this.databaseService.getCollection<Reminder>('reminders');

    // Create indexes for efficient queries
    await this.collection.createIndex({ status: 1, dueDate: 1 });
    await this.collection.createIndex({ status: 1, nextDueDate: 1 }); // For recurring reminders
    await this.collection.createIndex({ status: 1 });
    await this.collection.createIndex({ priority: 1 }); // For filtering by priority
  }

  async create(dto: CreateReminderDto): Promise<Reminder> {
    const now = new Date();

    // Determine status based on recurrence
    const isRecurring = dto.isRecurring ?? false;
    const status = isRecurring ? 'active' : 'pending';

    // Calculate nextDueDate for recurring reminders
    let nextDueDate: Date | undefined;
    if (isRecurring && dto.recurrencePattern) {
      nextDueDate = calculateNextOccurrence(
        dto.dueDate,
        dto.recurrencePattern,
        dto.recurrenceInterval ?? 1,
        dto.timezone,
      );
    }

    const reminder: Omit<Reminder, '_id'> = {
      title: dto.title,
      message: dto.message,
      dueDate: dto.dueDate,
      status,
      priority: dto.priority ?? 'medium', // Default priority
      createdAt: now,
      updatedAt: now,

      // Timezone support
      ...(dto.timezone && { timezone: dto.timezone }),

      // Recurrence support
      ...(isRecurring && {
        isRecurring: true,
        recurrencePattern: dto.recurrencePattern,
        recurrenceInterval: dto.recurrenceInterval ?? 1,
        ...(dto.recurrenceEndDate && {
          recurrenceEndDate: dto.recurrenceEndDate,
        }),
        ...(nextDueDate && { nextDueDate }),
        occurrenceCount: 0,
      }),
    };

    const result = await this.collection.insertOne(reminder);

    return {
      _id: result.insertedId,
      ...reminder,
    };
  }

  async findAll(): Promise<Reminder[]> {
    return this.collection.find({}).toArray();
  }

  async findOne(id: string): Promise<Reminder> {
    if (!ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid reminder ID: ${id}`);
    }

    const reminder = await this.collection.findOne({ _id: new ObjectId(id) });

    if (!reminder) {
      throw new NotFoundException(`Reminder with ID ${id} not found`);
    }

    return reminder;
  }

  async update(id: string, dto: UpdateReminderDto): Promise<Reminder> {
    if (!ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid reminder ID: ${id}`);
    }

    const updateData: Partial<Reminder> = {
      ...dto,
      updatedAt: new Date(),
    };

    const result = await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException(`Reminder with ID ${id} not found`);
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    if (!ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid reminder ID: ${id}`);
    }

    const result = await this.collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      throw new NotFoundException(`Reminder with ID ${id} not found`);
    }
  }

  async findByStatus(
    status: 'pending' | 'sent' | 'active' | 'failed',
  ): Promise<Reminder[]> {
    return this.collection.find({ status }).toArray();
  }

  async findDueReminders(): Promise<Reminder[]> {
    return this.collection
      .find({
        status: 'pending',
        dueDate: { $lte: new Date() },
      })
      .toArray();
  }

  /**
   * Find active recurring reminders that are due for processing
   * @returns Array of active recurring reminders where nextDueDate <= now
   */
  async findActiveRecurringDue(): Promise<Reminder[]> {
    return this.collection
      .find({
        status: 'active',
        nextDueDate: { $lte: new Date() },
      })
      .toArray();
  }

  /**
   * Update the next occurrence date for a recurring reminder
   * @param id - Reminder ID
   * @param nextDate - Next due date
   * @param incrementCount - Whether to increment occurrence count (default: true)
   */
  async updateNextOccurrence(
    id: string | ObjectId,
    nextDate: Date,
    incrementCount: boolean = true,
  ): Promise<void> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const now = new Date();

    const updateData: Partial<Reminder> = {
      nextDueDate: nextDate,
      lastProcessedAt: now,
      updatedAt: now,
    };

    if (incrementCount) {
      await this.collection.updateOne(
        { _id: objectId },
        {
          $set: updateData,
          $inc: { occurrenceCount: 1 },
        },
      );
    } else {
      await this.collection.updateOne({ _id: objectId }, { $set: updateData });
    }
  }

  /**
   * Find reminders by priority level
   * @param priority - Priority level (high, medium, low)
   * @returns Array of reminders with the specified priority
   */
  async findByPriority(
    priority: 'high' | 'medium' | 'low',
  ): Promise<Reminder[]> {
    return this.collection.find({ priority }).toArray();
  }
}
