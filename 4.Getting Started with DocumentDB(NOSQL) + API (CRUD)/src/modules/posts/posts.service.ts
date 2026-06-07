import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Collection, ObjectId, WithId } from 'mongodb';
import { DatabaseService } from '../database/database.service';
import { CreatePostDto, type PostsQueryDto, UpdatePostDto } from './dto';
import type { Post } from './schemas';

@Injectable()
export class PostsService implements OnModuleInit {
  private posts!: Collection<Post>;

  constructor(private readonly db: DatabaseService) {}

  // Runs after DatabaseService.onModuleInit() — client is connected by this point
  onModuleInit() {
    this.posts = this.db.getCollection<Post>('posts');
  }

  // Build a filter from optional query params, then fetch a page of results
  // alongside a total count in parallel to avoid two sequential round-trips
  async findAll(q: PostsQueryDto) {
    const filter: Record<string, unknown> = {};
    if (q.published !== undefined) filter.published = q.published;
    if (q.author) filter.author = q.author;
    if (q.tag) filter.tags = q.tag;

    const sortDir = q.sortOrder === 'asc' ? 1 : -1;
    const skip = (q.page - 1) * q.limit;

    const [data, total] = await Promise.all([
      this.posts
        .find(filter)
        .sort({ [q.sortBy]: sortDir })
        .skip(skip)
        .limit(q.limit)
        .toArray(),
      this.posts.countDocuments(filter),
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

  // Find a single post by its ObjectId — throws 404 if not found
  async findOne(id: string): Promise<WithId<Post>> {
    const post = await this.posts.findOne({ _id: new ObjectId(id) });
    if (!post) throw new NotFoundException(`Post ${id} not found`);
    return post;
  }

  // Insert a new post and return the full document (re-fetched by insertedId)
  async create(dto: CreatePostDto): Promise<WithId<Post>> {
    const now = new Date();
    const result = await this.posts.insertOne({
      ...dto,
      createdAt: now,
      updatedAt: now,
    });
    return this.findOne(result.insertedId.toString());
  }

  // Atomically apply a partial update and return the updated document
  async update(id: string, dto: UpdatePostDto): Promise<WithId<Post>> {
    const result = await this.posts.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...dto, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!result) throw new NotFoundException(`Post ${id} not found`);
    return result;
  }

  // Shorthand to flip published=true on a post
  async publish(id: string): Promise<WithId<Post>> {
    return this.update(id, { published: true });
  }

  // Delete a post — throws 404 if nothing was deleted
  async remove(id: string): Promise<void> {
    const result = await this.posts.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0)
      throw new NotFoundException(`Post ${id} not found`);
  }
}
