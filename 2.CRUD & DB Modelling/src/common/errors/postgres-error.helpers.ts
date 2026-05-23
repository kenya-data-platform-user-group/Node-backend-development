// Postgres "unique_violation" — see https://www.postgresql.org/docs/current/errcodes-appendix.html
export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FK_VIOLATION = '23503';

const hasCode = (value: unknown): value is { code?: string } =>
  typeof value === 'object' && value !== null && 'code' in value;

export function hasPgCode(err: unknown, code: string): boolean {
  if (hasCode(err) && err.code === code) {
    return true;
  }

  if (
    typeof err === 'object' &&
    err !== null &&
    'cause' in err &&
    hasCode((err as { cause?: unknown }).cause) &&
    (err as { cause: { code?: string } }).cause.code === code
  ) {
    return true;
  }

  return false;
}

export function isUniqueViolation(err: unknown): boolean {
  return hasPgCode(err, PG_UNIQUE_VIOLATION);
}

export function isFkViolation(err: unknown): boolean {
  return hasPgCode(err, PG_FK_VIOLATION);
}
