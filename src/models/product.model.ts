import { Schema, model, InferSchemaType, Types } from 'mongoose';

/**
 * Producto = el mueble como concepto.
 * Variantes e imagenes van EMBEBIDAS: la ficha de producto se resuelve con una
 * sola lectura, que es la consulta mas frecuente del sitio.
 * Precios en pesos colombianos, enteros. Medidas en centimetros.
 */

export const PRODUCT_STATUS = [
  'AVAILABLE',
  'MADE_TO_ORDER',
  'OUT_OF_STOCK',
  'DISCONTINUED',
] as const;

export const CUSTOMIZATION_TYPES = ['number', 'select', 'text', 'boolean'] as const;

/**
 * Campo que el administrador define por producto para que el cliente lo responda al
 * cotizar (ej. "Ancho" number/cm, "Color del tejido" select). Las respuestas quedan
 * estructuradas en la cotizacion (quote.model.ts -> items[].customization).
 */
const customizationFieldSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: CUSTOMIZATION_TYPES, required: true },
    required: { type: Boolean, default: false },
    hint: { type: String, trim: true },
    unit: { type: String, trim: true }, // "cm" (para number)
    min: { type: Number }, // (para number)
    max: { type: Number },
    options: { type: [String], default: undefined }, // (para select, >= 2)
    position: { type: Number, default: 0 },
  },
  { _id: true },
);

const variantSchema = new Schema(
  {
    sku: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true }, // "Tejido miel - 6 puestos"
    // Opcional a proposito: si el producto es personalizable, la interfaz muestra
    // "Precio segun medidas" en vez de un numero. Ver docs/cliente.md.
    price: { type: Number, min: 0 },
    compareAtPrice: { type: Number, min: 0 }, // precio tachado
    colorName: { type: String, trim: true },
    colorHex: { type: String, trim: true },
    fabric: { type: String, trim: true },
    sizeLabel: { type: String, trim: true },
    seats: { type: Number, min: 0 }, // puestos: la medida que el cliente entiende primero
    widthCm: { type: Number, min: 0 },
    heightCm: { type: Number, min: 0 },
    depthCm: { type: Number, min: 0 },
    weightKg: { type: Number, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    isDefault: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    position: { type: Number, default: 0 },
  },
  { _id: true },
);

const imageSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String }, // id en el CDN, necesario para borrar
    alt: { type: String, trim: true },
    // _id de una variante embebida, cuando la foto corresponde a un color puntual
    variantId: { type: Schema.Types.ObjectId, default: null },
    position: { type: Number, default: 0 },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: true },
);

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    shortDescription: { type: String, trim: true },
    description: { type: String },
    material: { type: String, trim: true },
    finish: { type: String, trim: true },
    careNotes: { type: String },
    warrantyMonths: { type: Number, min: 0 },
    leadTimeDays: { type: Number, min: 0 }, // dias de fabricacion si es MADE_TO_ORDER
    status: { type: String, enum: PRODUCT_STATUS, default: 'AVAILABLE' },
    // La muebleria fabrica por encargo: personalizable es el caso comun, no la excepcion.
    personalizable: { type: Boolean, default: false },
    customizationNotes: { type: String }, // que se puede cambiar: tejido, acabado, medidas
    featured: { type: Boolean, default: false },
    position: { type: Number, default: 0 },
    active: { type: Boolean, default: true },

    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },

    seo: {
      title: { type: String, trim: true },
      description: { type: String, trim: true },
    },

    variants: {
      type: [variantSchema],
      validate: {
        validator: (v: unknown[]) => v.length > 0,
        message: 'El producto necesita al menos una variante.',
      },
    },
    images: { type: [imageSchema], default: [] },

    // Qué puede pedir el cliente al cotizar este mueble (medidas, color, sí/no…).
    customizationFields: { type: [customizationFieldSchema], default: [] },

    // --- Campos denormalizados: se recalculan solos, no editar a mano ---
    // Permiten listar y filtrar el catalogo sin agregaciones sobre el arreglo.
    priceFrom: { type: Number, index: true }, // undefined si ninguna variante tiene precio
    priceTo: { type: Number },
    hasPrice: { type: Boolean, default: false, index: true }, // para filtrar y ordenar
    colorNames: { type: [String], default: [], index: true },
    sizeLabels: { type: [String], default: [] },
    primaryImageUrl: { type: String },
  },
  { timestamps: true },
);

/** Mantiene coherentes los denormalizados y las banderas unicas. */
productSchema.pre('validate', function (next) {
  const actives = this.variants.filter((v) => v.active);
  const pool = actives.length ? actives : this.variants;

  if (pool.length) {
    // Solo las variantes con precio cuentan: las personalizables pueden no tenerlo.
    const prices = pool.map((v) => v.price).filter((p): p is number => typeof p === 'number');
    this.hasPrice = prices.length > 0;
    this.priceFrom = prices.length ? Math.min(...prices) : undefined;
    this.priceTo = prices.length ? Math.max(...prices) : undefined;
    this.colorNames = [...new Set(pool.map((v) => v.colorName).filter(Boolean) as string[])];
    this.sizeLabels = [...new Set(pool.map((v) => v.sizeLabel).filter(Boolean) as string[])];

    // Exactamente una variante por defecto (la mas barata con precio, si hay)
    if (!pool.some((v) => v.isDefault)) {
      const withPrice = pool.filter((v) => typeof v.price === 'number');
      const target = withPrice.length
        ? withPrice.reduce((a, b) => ((a.price ?? 0) <= (b.price ?? 0) ? a : b))
        : pool[0];
      target.isDefault = true;
    } else {
      let seen = false;
      for (const v of this.variants) {
        if (v.isDefault && seen) v.isDefault = false;
        else if (v.isDefault) seen = true;
      }
    }

    // SKU unico dentro del documento (el indice multikey no lo garantiza)
    const skus = pool.map((v) => v.sku);
    if (new Set(skus).size !== skus.length) {
      return next(new Error('Hay SKU repetidos dentro del mismo producto.'));
    }
  }

  if (this.images.length) {
    // Exactamente una imagen principal
    let seen = false;
    for (const img of this.images) {
      if (img.isPrimary && seen) img.isPrimary = false;
      else if (img.isPrimary) seen = true;
    }
    if (!seen) this.images[0].isPrimary = true;

    const primary = this.images.find((i) => i.isPrimary) ?? this.images[0];
    this.primaryImageUrl = primary.url;

    // Una imagen no puede apuntar a una variante que no existe en este producto
    const variantIds = new Set(this.variants.map((v) => String(v._id)));
    for (const img of this.images) {
      if (img.variantId && !variantIds.has(String(img.variantId))) {
        return next(new Error('Una imagen apunta a una variante inexistente.'));
      }
    }
  } else {
    this.primaryImageUrl = undefined;
  }

  // Un producto no personalizable tiene que tener precio en alguna variante:
  // si no, el catalogo mostraria una tarjeta sin precio y sin explicacion.
  if (!this.personalizable && !this.hasPrice) {
    return next(
      new Error('Un producto no personalizable necesita precio en al menos una variante.'),
    );
  }

  next();
});

productSchema.index({ category: 1, active: 1, position: 1 });
productSchema.index({ featured: -1, position: 1 });
productSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true });
productSchema.index(
  { name: 'text', shortDescription: 'text', material: 'text' },
  { weights: { name: 10, material: 4, shortDescription: 1 }, default_language: 'spanish' },
);

export type ProductDoc = InferSchemaType<typeof productSchema>;
export type VariantDoc = InferSchemaType<typeof variantSchema> & { _id: Types.ObjectId };
export const Product = model('Product', productSchema);
