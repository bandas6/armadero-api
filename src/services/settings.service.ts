import { SiteSetting } from '../models/catalog.model.js';
import { resolveWhatsapp } from '../lib/whatsapp.js';

// Valores por defecto: los del mockup aprobado. Vanessa los cambia desde el panel.
export const DEFAULT_HOURS_WEEKDAY = '8:30 a. m. – 5:30 p. m.';
export const DEFAULT_HOURS_SATURDAY = '7:30 a. m. – 3:00 p. m.';

export const DEFAULT_FAQS: { q: string; a: string }[] = [
  {
    q: '¿Fabrican a la medida?',
    a: 'Sí, casi todo. Nos dices el espacio que tienes y ajustamos el mueble. El precio depende de las medidas finales.',
  },
  {
    q: '¿En cuánto tiempo entregan?',
    a: 'Entre 2 y 5 semanas según la pieza y la medida. Al cotizar te damos la fecha concreta.',
  },
  {
    q: '¿Envían fuera de Cali?',
    a: 'Sí. El flete se cotiza aparte según la ciudad y el tamaño del mueble.',
  },
  {
    q: '¿El tejido aguanta el exterior?',
    a: 'Bajo techo sí, en terraza o corredor. A sol y lluvia directos la fibra se resiente; para eso te recomendamos madera o guadua.',
  },
  {
    q: '¿Dan garantía?',
    a: '12 meses en estructura y tejido. Si algo se suelta, lo reparamos en el taller.',
  },
  {
    q: '¿Puedo ir al local?',
    a: 'Claro. Ahí ves los tejidos, las maderas y los acabados en vivo antes de encargar.',
  },
];

const CONTACT_TEXT = 'Hola, quiero pedir asesoría sobre un mueble.';

export type PublicSettings = {
  hoursWeekday: string;
  hoursSaturday: string;
  /** Una frase para poner debajo de un boton: "de lunes a viernes de …, y sábados de …". */
  businessHours: string;
  announcement: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  storeAddress: string | null;
  foundingYear: number | null;
  faqs: { q: string; a: string }[];
  whatsappConfigured: boolean;
  /** wa.me de contacto general (no es una cotizacion, no requiere persistencia). */
  whatsappContactUrl: string | null;
};

/** "8:30 a. m. – 5:30 p. m." -> "8:30 a. m. a 5:30 p. m.", para leerla dentro de una frase. */
function asRange(hours: string): string {
  return hours.replace(/\s[–-]\s/, ' a ');
}

export function hoursSentence(weekday: string, saturday: string): string {
  return `de lunes a viernes de ${asRange(weekday)}, y sábados de ${asRange(saturday)}`;
}

/** Faqs guardadas si son 6 completas; si no, las por defecto (nunca un hueco en el home). */
export function effectiveFaqs(saved?: readonly { q?: string | null; a?: string | null }[] | null) {
  const ok = saved?.length === DEFAULT_FAQS.length && saved.every((f) => f.q && f.a);
  return ok ? saved.map((f) => ({ q: f.q!, a: f.a! })) : DEFAULT_FAQS;
}

/**
 * Ajustes publicos del sitio para el home, la ficha y el pie de pagina. Lee SiteSetting si
 * existe y cae a valores por defecto. Nunca devuelve el numero de WhatsApp crudo: la URL
 * de cotizacion se arma en POST /api/quotes.
 */
export async function getPublicSettings(): Promise<PublicSettings> {
  const [doc, whatsapp] = await Promise.all([
    SiteSetting.findOne({ key: 'main' }).lean(),
    resolveWhatsapp(),
  ]);

  const hoursWeekday = doc?.hoursWeekday?.trim() || DEFAULT_HOURS_WEEKDAY;
  const hoursSaturday = doc?.hoursSaturday?.trim() || DEFAULT_HOURS_SATURDAY;

  return {
    hoursWeekday,
    hoursSaturday,
    businessHours: hoursSentence(hoursWeekday, hoursSaturday),
    announcement: doc?.announcement?.trim() || null,
    instagramUrl: doc?.instagramUrl?.trim() || null,
    facebookUrl: doc?.facebookUrl?.trim() || null,
    storeAddress: doc?.storeAddress?.trim() || null,
    foundingYear: doc?.foundingYear ?? null,
    faqs: effectiveFaqs(doc?.faqs),
    whatsappConfigured: Boolean(whatsapp.number),
    whatsappContactUrl: whatsapp.number
      ? `https://wa.me/${whatsapp.number}?text=${encodeURIComponent(CONTACT_TEXT)}`
      : null,
  };
}
