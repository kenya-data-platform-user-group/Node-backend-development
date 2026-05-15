import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodError, ZodType } from 'zod';

/**
 * Validates and parses an incoming request payload against a zod schema.
 *
 *   @Body(new ZodValidationPipe(createEmployeeSchema)) dto: CreateEmployeeDto
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: this.formatIssues(result.error),
      });
    }
    return result.data;
  }

  private formatIssues(error: ZodError) {
    return error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
      code: i.code,
    }));
  }
}
