import { Schema, model, InferSchemaType } from 'mongoose';

/** Categorias: coleccion aparte porque se listan solas en la navegacion. */
const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true },
    imageUrl: { type: String },
    imagePublicId: { type: String }, // id en Cloudinary, para borrar al reemplazar
    // Corte grueso del catalogo: tejido o madera. Solo lo llevan las subcategorias hoja
    // que se dividen por material (Mecedoras tejidas / de madera). Los padres, Guadua y
    // las hojas sin corte (Mesas de centro, Camas) quedan sin material. Ver
    // docs/modelo-datos.md y docs/cliente.md: el filtro por material es de primer nivel.
    material: { type: String, enum: ['tejido', 'madera'], default: undefined },
    parent: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    position: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
categorySchema.index({ parent: 1, active: 1, position: 1 });
export const Category = model('Category', categorySchema);

/** Ambientes curados: "Sala nordica", "Comedor para 6". */
const collectionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String },
    imageUrl: { type: String },
    products: [{ type: Schema.Types.ObjectId, ref: 'Product' }], // el orden del arreglo manda
    position: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export const Collection = model('Collection', collectionSchema);

/** Documento unico de configuracion del sitio. */
const siteSettingSchema = new Schema(
  {
    key: { type: String, default: 'main', unique: true, immutable: true },
    // Internacional sin +, ej 573001234567. Opcional: si esta vacio, la API cae a
    // env.WHATSAPP_NUMBER (ver lib/whatsapp.ts). Cuando esta puesto, gana sobre el env.
    whatsappNumber: { type: String, trim: true },
    businessHours: { type: String },
    announcement: { type: String },
    instagramUrl: { type: String },
    facebookUrl: { type: String },
    quoteMessageTemplate: { type: String }, // editable sin desplegar
  },
  { timestamps: true },
);
export const SiteSetting = model('SiteSetting', siteSettingSchema);

/** Piezas editables del home. */
const bannerSchema = new Schema(
  {
    title: { type: String, trim: true },
    subtitle: { type: String, trim: true },
    imageUrl: { type: String, required: true },
    linkUrl: { type: String },
    position: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    startsAt: { type: Date },
    endsAt: { type: Date },
  },
  { timestamps: true },
);
export const Banner = model('Banner', bannerSchema);

/** Flete informativo por ciudad. El valor final se acuerda por WhatsApp. */
const shippingZoneSchema = new Schema(
  {
    city: { type: String, required: true, unique: true, trim: true },
    cost: { type: Number, required: true, min: 0 },
    estimatedDays: { type: Number, min: 0 },
    notes: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export const ShippingZone = model('ShippingZone', shippingZoneSchema);

/** Usuarios del panel. */
export const ADMIN_ROLES = ['ADMIN', 'EDITOR'] as const;

const adminUserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ADMIN_ROLES, default: 'EDITOR' },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);
export const AdminUser = model('AdminUser', adminUserSchema);

export type CategoryDoc = InferSchemaType<typeof categorySchema>;
export type CollectionDoc = InferSchemaType<typeof collectionSchema>;
export type SiteSettingDoc = InferSchemaType<typeof siteSettingSchema>;
export type AdminUserDoc = InferSchemaType<typeof adminUserSchema>;
