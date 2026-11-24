import { z } from "zod";

const imageUrlSchema = z
  .string()
  .trim()
  .pipe(z.url({ protocol: /^https?$/ }));

export const updateProfileSchema = z.object({
  image: z
    .string()
    .trim()
    .transform((value) => value || null)
    .pipe(imageUrlSchema.nullable())
    .nullable()
    .optional(),
  name: z.string().trim().min(1).max(100),
});

export const profileUserSchema = z.object({
  createdAt: z.iso.datetime(),
  email: z.email(),
  emailVerified: z.boolean(),
  id: z.string(),
  image: z.string().nullable(),
  name: z.string(),
  role: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});
export const profileResponseSchema = z.object({ user: profileUserSchema });

export type UpdateProfileFormValues = z.input<typeof updateProfileSchema>;
export type UpdateProfileInput = z.output<typeof updateProfileSchema>;
export type ProfileUser = z.output<typeof profileUserSchema>;
export type ProfileResponse = z.output<typeof profileResponseSchema>;
