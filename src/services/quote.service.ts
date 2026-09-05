import { Product, type VariantDoc } from '../models/product.model.js';
import { Quote, generateQuoteCode } from '../models/quote.model.js';
import { SiteSetting } from '../models/catalog.model.js';
import { env } from '../lib/env.js';
import { resolveWhatsappNumber } from '../lib/whatsapp.js';
import { formatCOP } from '../lib/format.js';
import { buildQuoteMessage, type MessageItem } from './quote-message.js';
import type { CreateQuoteInput } from '../schemas/quote.schema.js';

export class QuoteItemInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuoteItemInvalidError';
  }
}

export class QuoteNotFoundError extends Error {
  constructor(code: string) {
    super(`No existe una cotizacion con codigo "${code}".`);
    this.name = 'QuoteNotFoundError';
  }
}

/**
 * Detalle publico de solo lectura de una cotizacion. Es la pagina que se abre desde el
 * mensaje de WhatsApp cuando la cotizacion tiene mas de 3 items. No expone datos internos
 * (status, adminNotes, userAgent).
 */
export async function getQuoteByCode(code: string) {
  const quote = await Quote.findOne({ code: code.toUpperCase() })
    .select('code customerName customerCity items total hasCustomItems createdAt')
    .lean();

  if (!quote) throw new QuoteNotFoundError(code);
  return quote;
}

function measureLabel(personalizable: boolean, variant: VariantDoc): string {
  if (personalizable) return 'Se fabrica a la medida';

  const dims =
    variant.widthCm && variant.heightCm && variant.depthCm
      ? `${variant.widthCm} × ${variant.heightCm} × ${variant.depthCm} cm`
      : undefined;

  if (variant.seats && dims) return `${variant.seats} puestos, ${dims}`;
  if (variant.seats) return `${variant.seats} puestos`;
  if (dims) return dims;
  return 'Medidas a confirmar';
}

function priceLabel(price: number | undefined): string {
  return typeof price === 'number' ? formatCOP(price) : 'Precio según medidas';
}

/**
 * Crea la cotizacion. Orden que exige docs/modelo-datos.md: validar entrada (ya hecho
 * por Zod antes de llegar aca), leer los productos reales, RECALCULAR el total en el
 * servidor -nunca confiar en lo que manda el navegador-, copiar nombre/sku/precio a
 * cada item, generar el codigo, guardar, y recien ahi construir la URL de WhatsApp.
 */
export async function createQuote(input: CreateQuoteInput) {
  const quoteItems: {
    product: string;
    variantId: string;
    productName: string;
    variantName: string;
    sku: string;
    unitPrice?: number;
    quantity: number;
    imageUrl?: string;
    productUrl: string;
    customization: { label: string; value: string }[];
  }[] = [];
  const messageItems: MessageItem[] = [];

  let total = 0;
  let hasCustomItems = false;

  for (const line of input.items) {
    const product = await Product.findOne({ _id: line.productId, active: true }).lean();
    if (!product) {
      throw new QuoteItemInvalidError(`El producto ${line.productId} no existe o no esta activo.`);
    }

    const variant = product.variants.find(
      (v) => String(v._id) === line.variantId && v.active,
    );
    if (!variant) {
      throw new QuoteItemInvalidError(
        `La variante seleccionada de "${product.name}" no existe o no esta activa.`,
      );
    }

    const unitPrice = typeof variant.price === 'number' ? variant.price : undefined;
    if (unitPrice === undefined) hasCustomItems = true;
    else total += unitPrice * line.quantity;

    const productUrl = `${env.PUBLIC_SITE_URL}/producto/${product.slug}`;

    // Sanea las respuestas de personalizacion: solo se conservan las que corresponden a
    // un campo realmente configurado en el producto (nunca se confia en el navegador).
    // "Otros detalles" (campo libre que agrega la ficha) se acepta siempre.
    const validLabels = new Set(
      (product.customizationFields ?? []).map((f) => f.label.trim()),
    );
    const customization = (line.customization ?? [])
      .map((a) => ({ label: a.label.trim(), value: a.value.trim().slice(0, 300) }))
      .filter((a) => a.value && (validLabels.has(a.label) || a.label === 'Otros detalles'));

    quoteItems.push({
      product: String(product._id),
      variantId: String(variant._id),
      productName: product.name,
      variantName: variant.name,
      sku: variant.sku,
      unitPrice,
      quantity: line.quantity,
      imageUrl: product.primaryImageUrl ?? undefined,
      productUrl,
      customization,
    });

    messageItems.push({
      productName: product.name,
      sku: variant.sku,
      measureLabel: measureLabel(product.personalizable, variant),
      priceLabel: priceLabel(unitPrice),
      productUrl,
      customization,
    });
  }

  // Genera un codigo corto y reintenta ante colision (indice unico -> error 11000).
  let quote;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateQuoteCode();
    try {
      quote = await Quote.create({
        code,
        customerName: input.customerName,
        customerCity: input.customerCity,
        customerPhone: input.customerPhone,
        notes: input.notes,
        customizationRequest: input.customizationRequest,
        items: quoteItems,
        total,
        hasCustomItems,
        source: input.source,
      });
      break;
    } catch (err) {
      const isDuplicateCode =
        typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000;
      if (!isDuplicateCode || attempt === 4) throw err;
    }
  }
  if (!quote) throw new Error('No se pudo generar un codigo de cotizacion unico.');

  const settings = await SiteSetting.findOne({ key: 'main' }).lean();

  const message = buildQuoteMessage(
    {
      items: messageItems,
      customerName: input.customerName,
      customerCity: input.customerCity,
      customizationRequest: input.customizationRequest,
      notes: input.notes,
      code: quote.code,
      total,
      publicQuoteUrl: `${env.PUBLIC_SITE_URL}/cot/${quote.code}`,
    },
    settings?.quoteMessageTemplate ?? undefined,
  );

  // Numero efectivo: el del panel (SiteSetting) gana sobre el del env. Si no hay ninguno
  // no hay a donde enviar el mensaje; la cotizacion ya quedo guardada igual, que es lo
  // que importa para no perder el lead.
  const whatsappNumber = await resolveWhatsappNumber();
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
    : null;

  return { code: quote.code, whatsappUrl, whatsappConfigured: Boolean(whatsappNumber) };
}
