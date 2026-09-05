import { z } from 'zod';

const urlOrEmpty = z.string().trim().url('URL inválida.').or(z.literal(''));

export const adminSettingsUpdateSchema = z
  .object({
    whatsappNumber: z
      .string()
      .trim()
      .regex(/^\d{10,15}$/, 'El número va en formato internacional sin +, solo dígitos.')
      .or(z.literal('')),
    businessHours: z.string().trim().max(200),
    announcement: z.string().trim().max(200),
    instagramUrl: urlOrEmpty,
    facebookUrl: urlOrEmpty,
    quoteMessageTemplate: z.string().trim().max(2000),
  })
  .partial();

export type AdminSettingsUpdate = z.infer<typeof adminSettingsUpdateSchema>;
