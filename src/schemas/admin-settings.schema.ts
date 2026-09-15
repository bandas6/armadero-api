import { z } from 'zod';

const urlOrEmpty = z.string().trim().url('URL inválida.').or(z.literal(''));

export const FAQ_COUNT = 6;

export const adminSettingsUpdateSchema = z
  .object({
    whatsappNumber: z
      .string()
      .trim()
      .regex(/^\d{10,15}$/, 'El número va en formato internacional sin +, solo dígitos.')
      .or(z.literal('')),
    hoursWeekday: z.string().trim().max(80),
    hoursSaturday: z.string().trim().max(80),
    announcement: z.string().trim().max(200),
    instagramUrl: urlOrEmpty,
    facebookUrl: urlOrEmpty,
    storeAddress: z.string().trim().max(160),
    // null = sin dato (el bloque de historia se arma sin el año).
    foundingYear: z.number().int().min(1900).max(2100).nullable(),
    // Siempre 6: la cantidad y el lugar no se editan, solo el texto.
    faqs: z
      .array(
        z.object({
          q: z.string().trim().max(120),
          a: z.string().trim().max(400),
        }),
      )
      .length(FAQ_COUNT, `Son ${FAQ_COUNT} preguntas, ni más ni menos.`),
    quoteMessageTemplate: z.string().trim().max(2000),
  })
  .partial();

export type AdminSettingsUpdate = z.infer<typeof adminSettingsUpdateSchema>;
