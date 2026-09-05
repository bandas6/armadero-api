import { z } from 'zod';
import { PRODUCT_STATUS, CUSTOMIZATION_TYPES } from '../models/product.model.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Id inválido.');
const money = z.number().int('El precio va en pesos enteros, sin decimales.').min(0);
const cm = z.number().min(0).max(2000);

export const variantInputSchema = z.object({
  sku: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1, 'La opción necesita un nombre.').max(120),
  price: money.optional(),
  compareAtPrice: money.optional(),
  colorName: z.string().trim().max(60).optional(),
  colorHex: z.string().trim().max(9).optional(),
  fabric: z.string().trim().max(60).optional(),
  sizeLabel: z.string().trim().max(60).optional(),
  seats: z.number().int().min(0).max(30).optional(),
  widthCm: cm.optional(),
  heightCm: cm.optional(),
  depthCm: cm.optional(),
  weightKg: z.number().min(0).max(500).optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const customizationFieldInputSchema = z
  .object({
    label: z.string().trim().min(1, 'El campo necesita un nombre.').max(60),
    type: z.enum(CUSTOMIZATION_TYPES),
    required: z.boolean().optional(),
    hint: z.string().trim().max(140).optional(),
    unit: z.string().trim().max(12).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    options: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((f) => f.type !== 'select' || (f.options?.length ?? 0) >= 2, {
    message: 'Una lista de opciones necesita al menos 2.',
    path: ['options'],
  });

const productBase = {
  name: z.string().trim().min(2, 'El nombre es obligatorio.').max(140),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'La dirección solo lleva minúsculas, números y guiones.')
    .max(90)
    .optional(),
  shortDescription: z.string().trim().max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  material: z.string().trim().max(80).optional(),
  finish: z.string().trim().max(80).optional(),
  careNotes: z.string().trim().max(2000).optional(),
  warrantyMonths: z.number().int().min(0).max(600).optional(),
  leadTimeDays: z.number().int().min(0).max(365).optional(),
  status: z.enum(PRODUCT_STATUS).optional(),
  personalizable: z.boolean().optional(),
  customizationNotes: z.string().trim().max(1000).optional(),
  customizationFields: z.array(customizationFieldInputSchema).max(12).optional(),
  featured: z.boolean().optional(),
  category: objectId,
  seo: z
    .object({
      title: z.string().trim().max(120).optional(),
      description: z.string().trim().max(200).optional(),
    })
    .optional(),
};

export const adminProductCreateSchema = z.object({
  ...productBase,
  variants: z.array(variantInputSchema).min(1, 'Agrega al menos una opción del mueble.'),
});

export const adminProductUpdateSchema = z.object({
  ...productBase,
  category: objectId.optional(),
  variants: z.array(variantInputSchema).min(1).optional(),
}).partial();

export const reorderSchema = z.object({
  scope: z.enum(['all', 'category']).default('all'),
  categoryId: objectId.optional(),
  orderedIds: z.array(objectId).min(1),
});

export const imageAttachSchema = z.object({
  url: z.string().url(),
  publicId: z.string().min(1),
  alt: z.string().trim().max(200).optional(),
});

export const imageReorderSchema = z.object({
  orderedIds: z.array(objectId).min(1),
});

export const idParamSchema = z.object({ id: objectId });
export const imageParamSchema = z.object({ id: objectId, imageId: objectId });
export const variantParamSchema = z.object({ id: objectId, variantId: objectId });

export const listQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().optional(),
  status: z.enum(PRODUCT_STATUS).optional(),
  active: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(20),
});

export type AdminProductCreate = z.infer<typeof adminProductCreateSchema>;
export type AdminProductUpdate = z.infer<typeof adminProductUpdateSchema>;
