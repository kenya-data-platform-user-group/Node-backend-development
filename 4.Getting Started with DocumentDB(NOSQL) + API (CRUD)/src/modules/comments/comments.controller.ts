import { Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ObjectIdSchema } from '../../common/schemas/object-id.schema';
import {
  ZodBody,
  ZodParam,
  ZodQuery,
} from '../../common/decorators/zod.decorators';
import { CommentsService } from './comments.service';
import {
  CommentsQuerySchema,
  type CommentsQueryDto,
  CreateCommentSchema,
  type CreateCommentDto,
  UpdateCommentSchema,
  type UpdateCommentDto,
} from './dto';

@Controller('posts/:postId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  // GET /posts/:postId/comments — list all comments for a post with pagination
  @Get()
  findAll(
    @ZodParam(ObjectIdSchema, 'postId') postId: string,
    @ZodQuery(CommentsQuerySchema) query: CommentsQueryDto,
  ) {
    return this.commentsService.findByPost(postId, query);
  }

  // POST /posts/:postId/comments — add a new comment to a post
  @Post()
  create(
    @ZodParam(ObjectIdSchema, 'postId') postId: string,
    @ZodBody(CreateCommentSchema) dto: CreateCommentDto,
  ) {
    return this.commentsService.create(postId, dto);
  }

  // PATCH /posts/:postId/comments/:commentId — edit a comment's content
  @Patch(':commentId')
  update(
    @ZodParam(ObjectIdSchema, 'postId') postId: string,
    @ZodParam(ObjectIdSchema, 'commentId') commentId: string,
    @ZodBody(UpdateCommentSchema) dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(postId, commentId, dto);
  }

  // DELETE /posts/:postId/comments/:commentId — remove a comment (204 No Content)
  @Delete(':commentId')
  @HttpCode(204)
  remove(
    @ZodParam(ObjectIdSchema, 'postId') postId: string,
    @ZodParam(ObjectIdSchema, 'commentId') commentId: string,
  ) {
    return this.commentsService.remove(postId, commentId);
  }
}
