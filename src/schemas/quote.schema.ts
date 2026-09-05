import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectId = z.string().regex(objectIdRegex, 'Id invalido.');

/**
 * Entrada de POST /api/quotes. El navegador solo manda identificadores y cantidades:
 * nombre, sku y precio de cada item se resuelven leyendo el producto real en el
 * servidor (ver quote.service.ts). Nunca se confia en un precio que mande el cliente.
 */
export const createQuoteSchema = z.object({
  customerName: z.string().trim().min(1, 'El nombre es obligatorio.').max(120),
  customerCity: z.string().trim().min(1, 'La ciudad es obligatoria.').max(120),
  customerPhone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(500).optional(),
  customizationRequest: z.string().trim().max(800).optional(),
  source: z.enum(['web', 'product-page', 'cart']).default('product-page'),
  items: z
    .array(
      z.object({
        productId: objectId,
        variantId: objectId,
        quantity: z.coerce.number().int().min(1).max(20).default(1),
        // Respuestas del cliente a los campos de personalizacion del producto.
        // El servidor las sanea contra los campos reales (quote.service.ts).
        customization: z
          .array(
            z.object({
              label: z.string().trim().min(1).max(60),
              value: z.string().trim().max(300),
            }),
          )
          .max(15)
          .optional(),
      }),
    )
    .min(1, 'La cotizacion necesita al menos un producto.'),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

export const productSlugParamSchema = z.object({
  slug: z.string().trim().min(1),
});
