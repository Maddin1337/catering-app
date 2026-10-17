import { z } from 'zod';

const email = z
  .string()
  .trim()
  .min(1, 'company.validation.emailRequired')
  .pipe(z.email('auth.validation.emailInvalid'));

export const createCompanySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'company.validation.nameRequired')
    .max(120, 'company.validation.nameLong'),
  contactEmail: email,
  // Pflicht: ohne Zustimmung zur AVV entsteht keine Firma (docs/01 US-01.2).
  acceptAvv: z.boolean().refine((v) => v === true, 'company.validation.avvRequired'),
});

export type CreateCompanyFormValues = z.infer<typeof createCompanySchema>;
