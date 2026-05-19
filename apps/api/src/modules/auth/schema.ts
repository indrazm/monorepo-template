import { z } from "zod";
import { normalizeEmail, normalizeName } from "./utils";

const emailSchema = z
  .string()
  .trim()
  .min(1, "email and password are required")
  .email("invalid email")
  .transform(normalizeEmail);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "email and password are required"),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "password must be at least 8 characters"),
  name: z.string().nullish().transform(normalizeName),
});
