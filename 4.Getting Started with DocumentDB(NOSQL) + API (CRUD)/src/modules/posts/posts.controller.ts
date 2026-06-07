import { Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ObjectIdSchema } from '../../common/schemas/object-id.schema';
import {
  ZodBody,
  ZodParam,
  ZodQuery,
} from '../../common/decorators/zod.decorators';
import {
  CreatePostSchema,
  type CreatePostDto,
  PostsQuerySchema,
  type PostsQueryDto,
  UpdatePostSchema,
  type UpdatePostDto,
} from './dto';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // GET /posts — list all posts with filtering, sorting, and pagination
  @Get()
  findAll(@ZodQuery(PostsQuerySchema) query: PostsQueryDto) {
    return this.postsService.findAll(query);
  }

  // GET /posts/:id — get a single post by its ID
  @Get(':id')
  findOne(@ZodParam(ObjectIdSchema, 'id') id: string) {
    return this.postsService.findOne(id);
  }

  // POST /posts — create a new blog post
  @Post()
  create(@ZodBody(CreatePostSchema) dto: CreatePostDto) {
    return this.postsService.create(dto);
  }

  // PATCH /posts/:id — partially update a post (only provided fields are changed)
  @Patch(':id')
  update(
    @ZodParam(ObjectIdSchema, 'id') id: string,
    @ZodBody(UpdatePostSchema) dto: UpdatePostDto,
  ) {
    return this.postsService.update(id, dto);
  }

  // PATCH /posts/:id/publish — set published=true on a post
  @Patch(':id/publish')
  publish(@ZodParam(ObjectIdSchema, 'id') id: string) {
    return this.postsService.publish(id);
  }

  // DELETE /posts/:id — permanently delete a post (204 No Content)
  @Delete(':id')
  @HttpCode(204)
  remove(@ZodParam(ObjectIdSchema, 'id') id: string) {
    return this.postsService.remove(id);
  }
}
