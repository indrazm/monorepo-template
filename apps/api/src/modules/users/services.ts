import { and, desc, eq, lt, or } from "drizzle-orm";
import type { Database } from "@repo/db";
import { user } from "@repo/db/schema";
import type { UsersResponse, ListUsersInput } from "@repo/contracts/users";

export class InvalidUsersCursorError extends Error {
  constructor() {
    super("Invalid users cursor.");
    this.name = "InvalidUsersCursorError";
  }
}

export function createUsersService(db: Pick<Database, "select">) {
  return { listRecentUsers };
  async function listRecentUsers({ cursor, limit }: ListUsersInput): Promise<UsersResponse> {
    const cursorUser = cursor
      ? (
          await db
            .select({ createdAt: user.createdAt, id: user.id })
            .from(user)
            .where(eq(user.id, cursor))
            .limit(1)
        )[0]
      : null;

    if (cursor && !cursorUser) {
      throw new InvalidUsersCursorError();
    }

    const where = cursorUser
      ? or(
          lt(user.createdAt, cursorUser.createdAt),
          and(eq(user.createdAt, cursorUser.createdAt), lt(user.id, cursorUser.id)),
        )
      : undefined;

    const users = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt), desc(user.id))
      .limit(limit + 1);

    const visibleUsers = users.slice(0, limit);

    return {
      nextCursor: users.length > limit ? (visibleUsers.at(-1)?.id ?? null) : null,
      users: visibleUsers.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      })),
    };
  }
}

export type UsersService = ReturnType<typeof createUsersService>;
