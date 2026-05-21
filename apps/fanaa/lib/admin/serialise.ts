/**
 * Recursive BigInt→string serialiser.
 *
 * Prisma returns `bigint` for any column typed BigInt — those don't survive
 * `JSON.stringify` (it throws `TypeError: Do not know how to serialize a BigInt`).
 * Every metrics route shoves its payload through this helper before
 * `NextResponse.json` so the dashboard sees plain numbers / strings.
 *
 * We convert `bigint` to `Number` when it fits Number.MAX_SAFE_INTEGER and
 * to a string otherwise. The dashboard parses both transparently.
 */
const SAFE_MAX = BigInt(Number.MAX_SAFE_INTEGER);

export function serialise<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") {
    return (value <= SAFE_MAX ? Number(value) : value.toString()) as unknown as T;
  }
  if (value instanceof Date) {
    return value.toISOString() as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => serialise(v)) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as object)) {
      out[k] = serialise(v);
    }
    return out as unknown as T;
  }
  return value;
}
