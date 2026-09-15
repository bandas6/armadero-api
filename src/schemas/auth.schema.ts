import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Correo inválido.'),
  password: z.string().min(1, 'Escribe tu contraseña.'),
});

export const passwordSchema = z
  .string()
  .min(8, 'La contraseña nueva necesita al menos 8 caracteres.')
  .max(128);

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Escribe tu contraseña actual.'),
  newPassword: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
