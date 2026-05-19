import type { Role, User } from "../../utils/prisma";
import type { z } from "zod";
import type { loginSchema, registerSchema } from "./schema";

export type AuthPayload = {
  sub?: string;
  role?: Role;
};

export type LoginInput = z.infer<typeof loginSchema>;

export type RegisterInput = z.infer<typeof registerSchema>;

export type SanitizedUser = Pick<
  User,
  "id" | "email" | "name" | "role" | "createdAt" | "updatedAt"
>;

export type AuthResponse = {
  user: SanitizedUser;
};
