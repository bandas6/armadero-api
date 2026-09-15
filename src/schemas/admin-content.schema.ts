import { z } from 'zod';

/** Banners del home, colecciones (ambientes) y zonas de envio: la "segunda version" del panel. */

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Id inválido.');
const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'La dirección solo lleva minúsculas, números y guiones.')
  .max(90);
const isoDate = z.coerce.date();

export const idParam = z.object({ id: objectId });
export const slugParam = z.object({ slug });
export const activeSchema = z.object({ active: z.boolean() });
export const reorderSchema = z.object({ orderedIds: z.array(objectId).min(1) });

// --- Banners ---
export const bannerCreateSchema = z.object({
  title: z.string().trim().max(120).optional(),
  subtitle: z.string().trim().max(240).optional(),
  imageUrl: z.string().url('Falta la foto.'),
  imagePublicId: z.string().optional(),
  // Ruta interna ("/catalogo?material=madera") o URL completa.
  linkUrl: z.string().trim().max(300).optional(),
  startsAt: isoDate.nullable().optional(),
  endsAt: isoDate.nullable().optional(),
});
export const bannerUpdateSchema = bannerCreateSchema.partial();

// --- Colecciones / ambientes ---
export const collectionCreateSchema = z.object({
  name: z.string().trim().min(2, 'El nombre es obligatorio.').max(80),
  description: z.string().trim().max(600).optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  imagePublicId: z.string().optional(),
  products: z.array(objectId).max(60).optional(),
});
export const collectionUpdateSchema = collectionCreateSchema.partial().extend({
  slug: slug.optional(),
});

// --- Zonas de envio ---
export const shippingZoneCreateSchema = z.object({
  city: z.string().trim().min(2, 'La ciudad es obligatoria.').max(80),
  // COP como entero: nunca decimales.
  cost: z.number().int().min(0),
  estimatedDays: z.number().int().min(0).max(120).nullable().optional(),
  notes: z.string().trim().max(240).optional(),
});
export const shippingZoneUpdateSchema = shippingZoneCreateSchema.partial();

export type BannerCreate = z.infer<typeof bannerCreateSchema>;
export type BannerUpdate = z.infer<typeof bannerUpdateSchema>;
export type CollectionCreate = z.infer<typeof collectionCreateSchema>;
export type CollectionUpdate = z.infer<typeof collectionUpdateSchema>;
export type ShippingZoneCreate = z.infer<typeof shippingZoneCreateSchema>;
export type ShippingZoneUpdate = z.infer<typeof shippingZoneUpdateSchema>;
