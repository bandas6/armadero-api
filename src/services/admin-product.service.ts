import mongoose, { Types } from 'mongoose';
import { Product } from '../models/product.model.js';
import { ensureUniqueSlug, slugify } from '../lib/slug.js';
import { NotFoundError, UnprocessableError } from '../lib/errors.js';
import { deleteProductImage } from './upload.service.js';
import type {
  AdminProductCreate,
  AdminProductUpdate,
} from '../schemas/admin-product.schema.js';

const FEATURED_LIMIT = 8;

function notFound(): never {
  throw new NotFoundError('No encontramos este mueble.');
}

// Mensajes de las reglas de integridad del hook pre('validate') de product.model.ts.
// El hook los lanza como Error suelto (no ValidationError), asi que se traducen aca a
// un 422 legible para el panel.
const HOOK_RULE_MESSAGES = [
  'El producto necesita al menos una variante.',
  'Hay SKU repetidos dentro del mismo producto.',
  'Una imagen apunta a una variante inexistente.',
  'Un producto no personalizable necesita precio en al menos una variante.',
];

/** Guarda el producto normalizando los errores de validacion/hook a 4xx. */
async function saveProduct(product: InstanceType<typeof Product>) {
  try {
    await product.save();
  } catch (err) {
    if (err instanceof mongoose.Error.ValidationError) throw err; // el handler lo formatea
    if (err instanceof Error && HOOK_RULE_MESSAGES.includes(err.message)) {
      throw new UnprocessableError(err.message);
    }
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code: number }).code === 11000
    ) {
      throw new UnprocessableError('Ya existe un mueble con ese nombre o referencia.');
    }
    throw err;
  }
}

/** SKU auto para variantes sin uno explicito: prefijo del nombre + sufijo corto. */
function autoSku(productName: string, index: number): string {
  const base = slugify(productName).replace(/-/g, '').slice(0, 6).toUpperCase() || 'MUEBLE';
  return `${base}-${index + 1}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function listAdminProducts(query: {
  q?: string;
  category?: string;
  status?: string;
  active?: 'true' | 'false';
  page: number;
  pageSize: number;
}) {
  const filter: Record<string, unknown> = {};
  if (query.q) filter.name = { $regex: query.q, $options: 'i' };
  if (query.category && Types.ObjectId.isValid(query.category)) filter.category = query.category;
  if (query.status) filter.status = query.status;
  if (query.active) filter.active = query.active === 'true';

  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await Promise.all([
    Product.find(filter)
      .select('name slug status active featured position priceFrom priceTo hasPrice personalizable primaryImageUrl category images')
      .populate('category', 'name slug')
      .sort({ position: 1, createdAt: -1 })
      .skip(skip)
      .limit(query.pageSize)
      .lean(),
    Product.countDocuments(filter),
  ]);

  return {
    items: items.map((p) => ({
      _id: String(p._id),
      name: p.name,
      slug: p.slug,
      status: p.status,
      active: p.active,
      featured: p.featured,
      position: p.position,
      priceFrom: p.priceFrom,
      priceTo: p.priceTo,
      hasPrice: p.hasPrice,
      personalizable: p.personalizable,
      primaryImageUrl: p.primaryImageUrl,
      imageCount: p.images?.length ?? 0,
      category: p.category,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getAdminProduct(id: string) {
  const product = await Product.findById(id).populate('category', 'name slug parent material');
  if (!product) notFound();
  return product;
}

async function assertFeaturedLimit(excludeId?: string) {
  const count = await Product.countDocuments({
    featured: true,
    active: true,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (count >= FEATURED_LIMIT) {
    throw new UnprocessableError(
      `Ya tienes ${FEATURED_LIMIT} muebles destacados en el inicio. Quita uno antes de agregar otro.`,
    );
  }
}

export async function createProduct(input: AdminProductCreate) {
  if (input.featured) await assertFeaturedLimit();

  const product = new Product();
  product.set({
    ...input,
    slug: input.slug
      ? await ensureUniqueSlug(input.slug, Product)
      : await ensureUniqueSlug(input.name, Product),
    // Un mueble nuevo nace oculto: no se puede publicar sin foto (docs/panel-admin.md).
    active: false,
    variants: input.variants.map((v, i) => ({
      ...v,
      sku: v.sku ?? autoSku(input.name, i),
      position: i,
      active: v.active ?? true,
    })),
  });
  await saveProduct(product);
  return product;
}

export async function updateProduct(id: string, patch: AdminProductUpdate) {
  const product = await Product.findById(id);
  if (!product) notFound();

  if (patch.featured && !product.featured) await assertFeaturedLimit(id);

  const { slug, variants, name, ...rest } = patch;
  product.set(rest);
  if (name !== undefined) product.name = name;

  // El nombre cambia sin arrastrar el slug ya publicado (rompe URLs indexadas). El slug
  // solo se toca si lo mandan explicito.
  if (slug !== undefined && slug !== product.slug) {
    product.slug = await ensureUniqueSlug(slug, Product, id);
  }

  if (variants !== undefined) {
    product.set(
      'variants',
      variants.map((v, i) => ({
        ...v,
        sku: v.sku ?? autoSku(product.name, i),
        position: i,
        active: v.active ?? true,
      })),
    );
  }

  await saveProduct(product);
  return product;
}

export async function setActive(id: string, active: boolean) {
  const product = await Product.findById(id);
  if (!product) notFound();
  if (active && (!product.images || product.images.length === 0)) {
    throw new UnprocessableError('Agrega al menos una foto antes de publicar este mueble.');
  }
  product.active = active;
  await saveProduct(product);
  return product;
}

export async function setFeatured(id: string, featured: boolean) {
  if (featured) await assertFeaturedLimit(id);
  const product = await Product.findById(id);
  if (!product) notFound();
  product.featured = featured;
  await saveProduct(product);
  return product;
}

export async function reorderProducts(orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, index) => Product.updateOne({ _id: id }, { position: index })),
  );
}

// --- Imagenes ---

export async function attachImage(
  productId: string,
  image: { url: string; publicId: string; alt?: string },
) {
  const product = await Product.findById(productId);
  if (!product) notFound();
  const isFirst = product.images.length === 0;
  product.images.push({
    url: image.url,
    publicId: image.publicId,
    alt: image.alt,
    position: product.images.length,
    isPrimary: isFirst,
  });
  await saveProduct(product);
  return product;
}

export async function reorderImages(productId: string, orderedIds: string[]) {
  const product = await Product.findById(productId);
  if (!product) notFound();
  const order = new Map(orderedIds.map((id, i) => [id, i]));
  product.images.sort(
    (a, b) => (order.get(String(a._id)) ?? 99) - (order.get(String(b._id)) ?? 99),
  );
  product.images.forEach((img, i) => {
    img.position = i;
  });
  await saveProduct(product);
  return product;
}

export async function setPrimaryImage(productId: string, imageId: string) {
  const product = await Product.findById(productId);
  if (!product) notFound();
  let found = false;
  for (const img of product.images) {
    img.isPrimary = String(img._id) === imageId;
    if (img.isPrimary) found = true;
  }
  if (!found) throw new NotFoundError('No encontramos esa foto.');
  await saveProduct(product);
  return product;
}

export async function removeImage(productId: string, imageId: string) {
  const product = await Product.findById(productId);
  if (!product) notFound();
  const image = product.images.find((i) => String(i._id) === imageId);
  if (!image) throw new NotFoundError('No encontramos esa foto.');

  if (product.active && product.images.length === 1) {
    throw new UnprocessableError(
      'Este mueble está publicado y esta es su única foto. Oculta el mueble o agrega otra foto primero.',
    );
  }

  const publicId = image.publicId;
  product.images.pull({ _id: imageId });
  product.images.forEach((img, i) => {
    img.position = i;
  });
  await saveProduct(product);

  // Borrado fisico en el CDN: el modelo guarda publicId justo para esto.
  if (publicId) {
    try {
      await deleteProductImage(publicId);
    } catch (err) {
      console.error('[admin] no se pudo borrar la imagen en Cloudinary:', publicId, err);
    }
  }
  return product;
}
