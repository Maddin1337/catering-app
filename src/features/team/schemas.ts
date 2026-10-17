import { z } from 'zod';

export const inviteSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'team.validation.nameRequired')
    .max(80, 'team.validation.nameLong'),
  role: z.enum(['admin', 'kitchen', 'staff']),
  // Optional: mit Adresse gilt die Einladung nur für diese Adresse.
  email: z
    .string()
    .trim()
    .refine((v) => v === '' || z.email().safeParse(v).success, 'auth.validation.emailInvalid'),
});

export type InviteFormValues = z.infer<typeof inviteSchema>;
