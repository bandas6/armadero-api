import { SiteSetting } from '../models/catalog.model.js';
import { resolveWhatsapp } from '../lib/whatsapp.js';
import type { AdminSettingsUpdate } from '../schemas/admin-settings.schema.js';
import {
  DEFAULT_HOURS_SATURDAY,
  DEFAULT_HOURS_WEEKDAY,
  effectiveFaqs,
} from './settings.service.js';

export async function getAdminSettings() {
  const [doc, whatsapp] = await Promise.all([
    SiteSetting.findOne({ key: 'main' }).lean(),
    resolveWhatsapp(),
  ]);

  return {
    whatsappNumber: doc?.whatsappNumber ?? '',
    hoursWeekday: doc?.hoursWeekday ?? DEFAULT_HOURS_WEEKDAY,
    hoursSaturday: doc?.hoursSaturday ?? DEFAULT_HOURS_SATURDAY,
    announcement: doc?.announcement ?? '',
    instagramUrl: doc?.instagramUrl ?? '',
    facebookUrl: doc?.facebookUrl ?? '',
    storeAddress: doc?.storeAddress ?? '',
    foundingYear: doc?.foundingYear ?? null,
    // El panel siempre ve 6 preguntas: si no hay guardadas, las por defecto, para editarlas.
    faqs: effectiveFaqs(doc?.faqs),
    quoteMessageTemplate: doc?.quoteMessageTemplate ?? '',
    // Cual numero esta activo hoy y de donde sale.
    effectiveWhatsapp: whatsapp.number,
    whatsappSource: whatsapp.source,
  };
}

export async function updateSettings(patch: AdminSettingsUpdate) {
  // $set con cada campo tal cual: '' limpia el valor (y hace que WhatsApp caiga al env).
  const set: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) unset[key] = 1;
    else set[key] = value;
  }

  await SiteSetting.findOneAndUpdate(
    { key: 'main' },
    { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  );

  return getAdminSettings();
}
