import { z } from 'zod';
import { QUOTE_STATUS } from '../models/quote.model.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Id inválido.');

export const quoteListQuerySchema = z.object({
  status: z.enum(QUOTE_STATUS).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(20),
});

export const quoteUpdateSchema = z
  .object({
    status: z.enum(QUOTE_STATUS).optional(),
    adminNotes: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.status !== undefined || v.adminNotes !== undefined, {
    message: 'Nada para actualizar.',
  });

export const quoteIdParam = z.object({ id: objectId });

export type QuoteListQuery = z.infer<typeof quoteListQuerySchema>;
