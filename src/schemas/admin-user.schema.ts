import { z } from 'zod';
import { passwordSchema } from './auth.schema.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Id inválido.');

export const adminUserCreateSchema = z.object({
  name: z.string().trim().min(2, 'El nombre es obligatorio.').max(80),
  email: z.string().trim().email('Correo inválido.'),
  password: passwordSchema,
  role: z.enum(['ADMIN', 'EDITOR']).default('EDITOR'),
});

export const adminUserUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email('Correo inválido.'),
    // Reponer la contraseña de otra persona no pide la actual: lo hace el ADMIN.
    password: passwordSchema,
    role: z.enum(['ADMIN', 'EDITOR']),
    active: z.boolean(),
  })
  .partial();

export const adminUserIdParam = z.object({ id: objectId });

export type AdminUserCreate = z.infer<typeof adminUserCreateSchema>;
export type AdminUserUpdate = z.infer<typeof adminUserUpdateSchema>;
