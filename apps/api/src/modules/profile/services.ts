import { eq } from "drizzle-orm";
import type { Database } from "@repo/db";
import { user as userTable } from "@repo/db/schema";
import type { ProfileResponse, UpdateProfileInput } from "@repo/contracts/profile";

export class ProfileNotFoundError extends Error {
  constructor() {
    super("User not found.");
    this.name = "ProfileNotFoundError";
  }
}

export function createProfileService(db: Pick<Database, "update">) {
  return { updateProfile };
  async function updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<ProfileResponse> {
    const [user] = await db
      .update(userTable)
      .set(
        input.image === undefined ? { name: input.name } : { image: input.image, name: input.name },
      )
      .where(eq(userTable.id, userId))
      .returning({
        createdAt: userTable.createdAt,
        email: userTable.email,
        emailVerified: userTable.emailVerified,
        id: userTable.id,
        image: userTable.image,
        name: userTable.name,
        role: userTable.role,
        updatedAt: userTable.updatedAt,
      });

    if (!user) {
      throw new ProfileNotFoundError();
    }

    return {
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    };
  }
}

export type ProfileService = ReturnType<typeof createProfileService>;
