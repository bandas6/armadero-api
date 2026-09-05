import { SiteSetting } from '../models/catalog.model.js';
import { resolveWhatsapp } from '../lib/whatsapp.js';
import type { AdminSettingsUpdate } from '../schemas/admin-settings.schema.js';

export async function getAdminSettings() {
  const [doc, whatsapp] = await Promise.all([
    SiteSetting.findOne({ key: 'main' }).lean(),
    resolveWhatsapp(),
  ]);

  return {
    whatsappNumber: doc?.whatsappNumber ?? '',
    businessHours: doc?.businessHours ?? '',
    announcement: doc?.announcement ?? '',
    instagramUrl: doc?.instagramUrl ?? '',
    facebookUrl: doc?.facebookUrl ?? '',
    quoteMessageTemplate: doc?.quoteMessageTemplate ?? '',
    // Cual numero esta activo hoy y de donde sale.
    effectiveWhatsapp: whatsapp.number,
    whatsappSource: whatsapp.source,
  };
}

export async function updateSettings(patch: AdminSettingsUpdate) {
  // $set con cada campo tal cual: '' limpia el valor (y hace que WhatsApp caiga al env).
  const set: Record<string, string> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) set[key] = value;
  }

  await SiteSetting.findOneAndUpdate(
    { key: 'main' },
    { $set: set },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  );

  return getAdminSettings();
}
