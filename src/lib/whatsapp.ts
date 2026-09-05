import { SiteSetting } from '../models/catalog.model.js';
import { env } from './env.js';

const VALID = /^\d{10,15}$/;

export type WhatsappSource = 'panel' | 'env' | 'none';

/**
 * Numero de WhatsApp efectivo del negocio. Prioridad: SiteSetting.whatsappNumber (lo
 * edita el panel) > env.WHATSAPP_NUMBER > null. Formato internacional sin el signo +.
 */
export async function resolveWhatsapp(): Promise<{ number: string | null; source: WhatsappSource }> {
  const doc = await SiteSetting.findOne({ key: 'main' }).select('whatsappNumber').lean();
  const fromPanel = doc?.whatsappNumber?.trim();
  if (fromPanel && VALID.test(fromPanel)) return { number: fromPanel, source: 'panel' };
  if (env.WHATSAPP_NUMBER && VALID.test(env.WHATSAPP_NUMBER)) {
    return { number: env.WHATSAPP_NUMBER, source: 'env' };
  }
  return { number: null, source: 'none' };
}

export async function resolveWhatsappNumber(): Promise<string | null> {
  return (await resolveWhatsapp()).number;
}
