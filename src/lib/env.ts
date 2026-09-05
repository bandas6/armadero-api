import 'dotenv/config';
import { z } from 'zod';

/**
 * Variables de entorno, validadas al arrancar. Ver .env.example en la raiz del repo.
 *
 * WHATSAPP_NUMBER es el caso especial: un numero de WhatsApp faltante en produccion es
 * un error de despliegue, no algo que el comprador deba ver. Por eso la app NO arranca
 * en produccion sin el. En desarrollo se permite ausente: el boton de cotizar se
 * deshabilita en la web con un aviso para el desarrollador, no para la clienta.
 */

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI es obligatorio.'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:4200'),
  WHATSAPP_NUMBER: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, 'WHATSAPP_NUMBER debe ser solo digitos, formato internacional sin +.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  PUBLIC_SITE_URL: z.string().url().default('http://localhost:4200'),
  BUSINESS_HOURS: z.string().optional(),

  // --- Autenticacion del panel ---
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET necesita al menos 16 caracteres.'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET necesita al menos 16 caracteres.'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  // --- Cloudinary (imagenes de producto) ---
  // Opcionales en el schema: la app arranca sin ellas, pero el endpoint de subida
  // responde 503 con un mensaje claro hasta que se configuren.
  CLOUDINARY_CLOUD_NAME: z.string().optional().or(z.literal('').transform(() => undefined)),
  CLOUDINARY_API_KEY: z.string().optional().or(z.literal('').transform(() => undefined)),
  CLOUDINARY_API_SECRET: z.string().optional().or(z.literal('').transform(() => undefined)),

  // --- Bootstrap del primer administrador (solo lo usa el script create-admin) ---
  ADMIN_EMAIL: z.string().email().optional().or(z.literal('').transform(() => undefined)),
  ADMIN_PASSWORD: z.string().min(8).optional().or(z.literal('').transform(() => undefined)),
  ADMIN_NAME: z.string().optional().or(z.literal('').transform(() => undefined)),
  // Workaround de entorno, no de producto: en algunas maquinas Windows el resolutor
  // DNS que Node usa por defecto (c-ares) rechaza CUALQUIER consulta -incluida A-,
  // mientras que `nslookup`/`ping` si funcionan por otra ruta del sistema operativo.
  // Sin esto, mongodb+srv:// falla con "querySrv ECONNREFUSED" aunque la red ande
  // bien. Se deja vacio por defecto: no cambia el comportamiento en ninguna otra
  // maquina ni en produccion.
  DNS_SERVERS: z.string().optional(),
});

function loadEnv() {
  const parsed = baseSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('\n[env] Variables de entorno invalidas:\n');
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('\nRevisa tu archivo .env contra .env.example.\n');
    process.exit(1);
  }

  const env = parsed.data;

  // En produccion los secretos JWT no pueden quedarse en el placeholder del .env.example.
  const PLACEHOLDER = 'cambiar-en-produccion';
  if (
    env.NODE_ENV === 'production' &&
    (env.JWT_ACCESS_SECRET === PLACEHOLDER || env.JWT_REFRESH_SECRET === PLACEHOLDER)
  ) {
    console.error(
      '\n[env] JWT_ACCESS_SECRET / JWT_REFRESH_SECRET siguen con el valor de ejemplo. ' +
        'Genera secretos reales antes de desplegar.\n',
    );
    process.exit(1);
  }

  const cloudinaryVars = [
    env.CLOUDINARY_CLOUD_NAME,
    env.CLOUDINARY_API_KEY,
    env.CLOUDINARY_API_SECRET,
  ];
  if (cloudinaryVars.some(Boolean) && !cloudinaryVars.every(Boolean)) {
    console.error(
      '\n[env] Cloudinary a medias: define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y ' +
        'CLOUDINARY_API_SECRET juntas, o deja las tres vacias.\n',
    );
    process.exit(1);
  }
  if (!cloudinaryVars.every(Boolean)) {
    console.warn(
      '[env] Cloudinary sin configurar: la subida de fotos del panel respondera 503 ' +
        'hasta que agregues CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET.',
    );
  }

  // El numero de WhatsApp ya no bloquea el arranque: desde la Fase 4 se puede configurar
  // desde el panel (SiteSetting.whatsappNumber gana sobre este env). server.ts avisa
  // fuerte si en produccion no hay numero ni en el env ni en la base.
  if (!env.WHATSAPP_NUMBER) {
    console.warn(
      '[env] WHATSAPP_NUMBER no esta en el .env. Si tampoco esta configurado en el panel, ' +
        'el boton de cotizar se mostrara deshabilitado.',
    );
  }

  return env;
}

export const env = loadEnv();
export type Env = typeof env;
