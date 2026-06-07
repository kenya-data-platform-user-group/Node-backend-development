import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Collection, ObjectId, WithId } from 'mongodb';
import { DatabaseService } from '../database/database.service';
import {
  CreateCommentDto,
  type CommentsQueryDto,
  UpdateCommentDto,
} from './dto';
import type { Comment } from './schemas';

@Injectable()
export class CommentsService implements OnModuleInit {
  private comments!: Collection<Comment>;

  constructor(private readonly db: DatabaseService) {}

  // Runs after DatabaseService.onModuleInit() — client is connected by this point
  onModuleInit() {
    this.comments = this.db.getCollection<Comment>('comments');
  }

  // Fetch a paginated, sorted page of comments scoped to a single post
  async findByPost(postId: string, q: CommentsQueryDto) {
    const sortDir = q.sortOrder === 'asc' ? 1 : -1;
    const skip = (q.page - 1) * q.limit;

    const [data, total] = await Promise.all([
      this.comments
        .find({ postId })
        .sort({ createdAt: sortDir })
        .skip(skip)
        .limit(q.limit)
        .toArray(),
      this.comments.countDocuments({ postId }),
    ]);

    return {
      data,
      meta: {
        total,
        page: q.page,
        limit: q.limit,
        totalPages: Math.ceil(total / q.limit),
      },
    };
  }

  // Find a single comment by its ObjectId, scoped to a post — throws 404 if not found
  async findOne(postId: string, id: string): Promise<WithId<Comment>> {
    const comment = await this.comments.findOne({
      _id: new ObjectId(id),
      postId,
    });
    if (!comment) throw new NotFoundException(`Comment ${id} not found`);
    return comment;
  }

  // Insert a new comment for a post and return the full document
  async create(
    postId: string,
    dto: CreateCommentDto,
  ): Promise<WithId<Comment>> {
    const now = new Date();
    const result = await this.comments.insertOne({
      postId,
      ...dto,
      createdAt: now,
      updatedAt: now,
    });
    return this.findOne(postId, result.insertedId.toString());
  }

  // Atomically update only the content field and return the updated document
  async update(
    postId: string,
    id: string,
    dto: UpdateCommentDto,
  ): Promise<WithId<Comment>> {
    const result = await this.comments.findOneAndUpdate(
      { _id: new ObjectId(id), postId },
      { $set: { content: dto.content, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!result) throw new NotFoundException(`Comment ${id} not found`);
    return result;
  }

  // Delete a single comment — throws 404 if nothing was deleted
  async remove(postId: string, id: string): Promise<void> {
    const result = await this.comments.deleteOne({
      _id: new ObjectId(id),
      postId,
    });
    if (result.deletedCount === 0)
      throw new NotFoundException(`Comment ${id} not found`);
  }

  // Bulk-delete all comments for a post (used when a post itself is deleted)
  removeByPost(postId: string) {
    return this.comments.deleteMany({ postId });
  }
}
