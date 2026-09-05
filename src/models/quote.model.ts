import { Schema, model, InferSchemaType } from 'mongoose';

/**
 * Cotizacion generada justo antes de redirigir a WhatsApp.
 * Los items van embebidos: nunca se consultan por fuera de su cotizacion.
 * Los datos de producto se COPIAN, no se referencian, para que el historico
 * sobreviva a cambios de precio o a la baja del producto.
 */

export const QUOTE_STATUS = ['NEW', 'CONTACTED', 'WON', 'LOST'] as const;

// Sin vocales (no forma palabras) y sin 0/O/1/I (no se confunden al dictarlo)
const CODE_ALPHABET = '23456789BCDFGHJKLMNPQRSTVWXYZ';

export function generateQuoteCode(length = 5): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

const quoteItemSchema = new Schema(
  {
    // referencias debiles: sirven para estadisticas, no para leer el precio
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    variantId: { type: Schema.Types.ObjectId },
    // copias congeladas al momento de cotizar
    productName: { type: String, required: true },
    variantName: { type: String, required: true },
    sku: { type: String, required: true },
    // Opcional: los productos personalizables no tienen precio de lista.
    unitPrice: { type: Number, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    imageUrl: { type: String },
    productUrl: { type: String },
    // Respuestas del cliente a los customizationFields del producto (medidas, color…).
    // Ya saneadas contra los campos reales del producto en quote.service.ts.
    customization: {
      type: [new Schema({ label: String, value: String }, { _id: false })],
      default: [],
    },
  },
  { _id: true },
);

const quoteSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    customerName: { type: String, required: true, trim: true },
    customerCity: { type: String, required: true, trim: true },
    customerPhone: { type: String, trim: true }, // opcional: WhatsApp ya lo entrega
    notes: { type: String, trim: true, maxlength: 500 },
    // La muebleria fabrica a la medida: este campo suele ser el mas importante del formulario.
    customizationRequest: { type: String, trim: true, maxlength: 800 },
    items: {
      type: [quoteItemSchema],
      validate: {
        validator: (v: unknown[]) => v.length > 0,
        message: 'La cotizacion necesita al menos un item.',
      },
    },
    // Suma de los items con precio. Puede ser 0 si todo es "segun medidas".
    total: { type: Number, required: true, min: 0 }, // recalculado en el servidor
    hasCustomItems: { type: Boolean, default: false }, // hay items sin precio de lista
    status: { type: String, enum: QUOTE_STATUS, default: 'NEW', index: true },
    adminNotes: { type: String },
    // para medir el embudo
    source: { type: String, default: 'web' }, // web | product-page | cart
    userAgent: { type: String },
  },
  { timestamps: true },
);

quoteSchema.index({ status: 1, createdAt: -1 });
quoteSchema.index({ createdAt: -1 });
quoteSchema.index({ 'items.sku': 1 }); // productos mas cotizados

export type QuoteDoc = InferSchemaType<typeof quoteSchema>;
export const Quote = model('Quote', quoteSchema);
