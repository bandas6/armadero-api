import { z } from 'zod';

/**
 * Query de GET /api/products. Todos los campos son opcionales: sin filtros devuelve el
 * catalogo completo paginado. El corte tejido/madera (`material`) es de primer nivel
 * (docs/cliente.md); `category` acepta el slug de un padre o de una hoja.
 */
export const productListQuerySchema = z.object({
  category: z.string().trim().min(1).optional(),
  material: z.enum(['tejido', 'madera']).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  // Puestos: la medida que el comprador entiende primero en salas y comedores.
  seats: z.coerce.number().int().min(1).max(30).optional(),
  // "Se fabrica a la medida" y "entrega inmediata" son los dos filtros que la clienta
  // resuelve hoy por WhatsApp (design/PROMPT-3-catalogo.md).
  personalizable: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  disponible: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  sort: z.enum(['destacados', 'precio-asc', 'precio-desc', 'recientes']).default('destacados'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;
