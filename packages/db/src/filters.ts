import { eq, sql, type SQL } from "drizzle-orm";
import { event } from "./schema";

// A loosely-typed view of a notification's data source. Kept free of a
// `@repo/contracts` import so both the API and the worker can build the same
// SQL constraints from a jsonb row (the contract is the source of truth for
// the shape; see `notificationDataSourceSchema`).
type DataSourceLike = {
  source?: string | null;
  filters?: Array<{ field: string; op: string; value: string }> | null;
};

// Turns a notification's data source into extra WHERE conditions on the `event`
// table (FR-NED-08): an optional provider source plus simple payload filters.
// Numeric comparisons guard the cast so a non-numeric row is excluded rather
// than aborting the whole query.
export function eventDataSourceConditions(dataSource: DataSourceLike | null | undefined): SQL[] {
  const conditions: SQL[] = [];
  if (!dataSource) return conditions;
  if (dataSource.source) conditions.push(eq(event.source, dataSource.source));
  for (const filter of dataSource.filters ?? []) {
    if (!filter || !filter.field || filter.value == null) continue;
    const field = filter.field;
    const column =
      field === "city"
        ? sql`${event.city}`
        : field === "name" || field === "first_name" || field === "displayName"
          ? sql`${event.displayName}`
          : sql`(${event.payload} ->> ${field})`;
    const value = String(filter.value);
    switch (filter.op) {
      case "contains":
        conditions.push(sql`${column} ILIKE ${`%${value}%`}`);
        break;
      case "gte":
      case "lte": {
        const n = Number(value);
        if (Number.isNaN(n)) break;
        const numeric = sql`CASE WHEN ${column} ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${column})::numeric END`;
        conditions.push(filter.op === "gte" ? sql`${numeric} >= ${n}` : sql`${numeric} <= ${n}`);
        break;
      }
      default:
        conditions.push(sql`${column} = ${value}`);
    }
  }
  return conditions;
}
