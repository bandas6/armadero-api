import { SiteSetting } from '../models/catalog.model.js';
import { env } from '../lib/env.js';
import { resolveWhatsapp } from '../lib/whatsapp.js';

const DEFAULT_BUSINESS_HOURS =
  'Lunes a viernes 8:30 a. m. – 5:30 p. m. · Sábado 7:30 a. m. – 3:00 p. m.';

const CONTACT_TEXT = 'Hola, quiero pedir asesoría sobre un mueble.';

export type PublicSettings = {
  businessHours: string;
  announcement: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  whatsappConfigured: boolean;
  /** wa.me de contacto general (no es una cotizacion, no requiere persistencia). */
  whatsappContactUrl: string | null;
};

/**
 * Ajustes publicos del sitio para el home y el pie de pagina. Lee SiteSetting si existe
 * y cae a variables de entorno / valores por defecto. Nunca devuelve el numero de
 * WhatsApp crudo: la URL de cotizacion se arma en POST /api/quotes.
 */
export async function getPublicSettings(): Promise<PublicSettings> {
  const [doc, whatsapp] = await Promise.all([
    SiteSetting.findOne({ key: 'main' }).lean(),
    resolveWhatsapp(),
  ]);

  return {
    businessHours: doc?.businessHours || env.BUSINESS_HOURS || DEFAULT_BUSINESS_HOURS,
    announcement: doc?.announcement?.trim() || null,
    instagramUrl: doc?.instagramUrl?.trim() || null,
    facebookUrl: doc?.facebookUrl?.trim() || null,
    whatsappConfigured: Boolean(whatsapp.number),
    whatsappContactUrl: whatsapp.number
      ? `https://wa.me/${whatsapp.number}?text=${encodeURIComponent(CONTACT_TEXT)}`
      : null,
  };
}
