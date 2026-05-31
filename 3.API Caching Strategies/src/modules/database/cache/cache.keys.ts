type CacheKeyValue = boolean | number | string | null | undefined;

export const EVENTS_LIST_VERSION_KEY = 'events:list:version';

export function eventDetailCacheKey(id: string): string {
  return `events:detail:${id}`;
}

export function buildEventsListCacheKey(
  version: number,
  query: Record<string, CacheKeyValue>,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (value === undefined || value === null) {
      continue;
    }

    params.set(key, String(value));
  }

  const suffix = params.toString();
  return suffix
    ? `events:list:v${version}:${suffix}`
    : `events:list:v${version}`;
}
