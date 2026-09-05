import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Id inválido.');

export const adminCategoryCreateSchema = z.object({
  name: z.string().trim().min(2, 'El nombre es obligatorio.').max(80),
  parentId: objectId.nullable().optional(),
  material: z.enum(['tejido', 'madera']).nullable().optional(),
  description: z.string().trim().max(400).optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  imagePublicId: z.string().optional(),
  position: z.number().int().min(0).optional(),
});

export const adminCategoryUpdateSchema = adminCategoryCreateSchema.partial().extend({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'La dirección solo lleva minúsculas, números y guiones.')
    .max(90)
    .optional(),
});

export const categoryReorderSchema = z.object({
  orderedIds: z.array(objectId).min(1),
});

export const categoryActiveSchema = z.object({ active: z.boolean() });
export const categoryIdParam = z.object({ id: objectId });

export type AdminCategoryCreate = z.infer<typeof adminCategoryCreateSchema>;
export type AdminCategoryUpdate = z.infer<typeof adminCategoryUpdateSchema>;
