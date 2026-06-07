import { Body, Param, Query } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

/**
 * Param decorators that bundle the standard extractor (`@Body`, `@Query`,
 * `@Param`) with a `ZodValidationPipe`, so route handlers stay tidy:
 *
 *   @Post()
 *   create(@ZodBody(createPostSchema) dto: CreatePostDto) { ... }
 */
export const ZodBody = <T>(schema: ZodType<T>) =>
  Body(new ZodValidationPipe(schema));

export const ZodQuery = <T>(schema: ZodType<T>) =>
  Query(new ZodValidationPipe(schema));

export const ZodParam = <T>(schema: ZodType<T>, property?: string) =>
  property
    ? Param(property, new ZodValidationPipe(schema))
    : Param(new ZodValidationPipe(schema));
