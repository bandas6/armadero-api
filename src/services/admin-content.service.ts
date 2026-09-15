import { Banner, Collection, ShippingZone } from '../models/catalog.model.js';
import { ensureUniqueSlug } from '../lib/slug.js';
import { NotFoundError, UnprocessableError } from '../lib/errors.js';
import { deleteImage } from './upload.service.js';
import { listProductCardsByIds } from './product.service.js';
import type {
  BannerCreate,
  BannerUpdate,
  CollectionCreate,
  CollectionUpdate,
  ShippingZoneCreate,
  ShippingZoneUpdate,
} from '../schemas/admin-content.schema.js';

/**
 * Banners, colecciones y zonas de envio. Los tres siguen las mismas reglas del resto del
 * panel: nada se borra fisicamente (`active: false`), las fotos si se borran de Cloudinary
 * al reemplazarlas, y el orden se guarda como `position`.
 */

async function nextPosition(model: { findOne: () => any }): Promise<number> {
  const last = (await model.findOne().sort({ position: -1 }).select('position').lean()) as
    | { position?: number }
    | null;
  return (last?.position ?? -1) + 1;
}

/** Al cambiar la foto, la anterior sale de Cloudinary para no pagar huerfanas. */
async function dropReplacedImage(oldId: string | undefined, newUrl: string | undefined) {
  if (oldId && newUrl !== undefined) await deleteImage(oldId).catch(() => undefined);
}

// ---------------------------------------------------------------- Banners

export async function listBanners() {
  return Banner.find().sort({ position: 1, createdAt: 1 }).lean();
}

/** Los que se ven hoy: activos y dentro de su ventana de fechas, si la tienen. */
export async function listPublicBanners() {
  const now = new Date();
  return Banner.find({
    active: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gte: now } }] },
    ],
  })
    .sort({ position: 1 })
    .select('title subtitle imageUrl linkUrl')
    .lean();
}

export async function createBanner(input: BannerCreate) {
  return Banner.create({ ...input, position: await nextPosition(Banner) });
}

export async function updateBanner(id: string, patch: BannerUpdate) {
  const banner = await Banner.findById(id);
  if (!banner) throw new NotFoundError('Banner no encontrado.');
  if (patch.imageUrl && patch.imageUrl !== banner.imageUrl) {
    await dropReplacedImage(banner.imagePublicId ?? undefined, patch.imageUrl);
  }
  banner.set(patch);
  await banner.save();
  return banner;
}

export async function setBannerActive(id: string, active: boolean) {
  const banner = await Banner.findByIdAndUpdate(id, { active }, { new: true });
  if (!banner) throw new NotFoundError('Banner no encontrado.');
  return banner;
}

export async function reorderBanners(orderedIds: string[]) {
  await Promise.all(orderedIds.map((id, i) => Banner.updateOne({ _id: id }, { position: i })));
}

// ------------------------------------------------------------ Colecciones

export async function listCollections() {
  return Collection.find().sort({ position: 1, name: 1 }).lean();
}

export async function listPublicCollections() {
  return Collection.find({ active: true })
    .sort({ position: 1, name: 1 })
    .select('name slug description imageUrl products')
    .lean()
    .then((rows) =>
      rows.map(({ products, ...c }) => ({ ...c, productCount: products?.length ?? 0 })),
    );
}

export async function getPublicCollection(slug: string) {
  const col = await Collection.findOne({ slug, active: true }).lean();
  if (!col) throw new NotFoundError('Colección no encontrada.');
  const { products, ...rest } = col;
  return { ...rest, products: await listProductCardsByIds(products ?? []) };
}

export async function createCollection(input: CollectionCreate) {
  const slug = await ensureUniqueSlug(input.name, Collection);
  return Collection.create({ ...input, slug, position: await nextPosition(Collection) });
}

export async function updateCollection(id: string, patch: CollectionUpdate) {
  const col = await Collection.findById(id);
  if (!col) throw new NotFoundError('Colección no encontrada.');

  // Renombrar no mueve el slug (ya puede estar indexado); cambiarlo es explicito.
  if (patch.slug && patch.slug !== col.slug) {
    const free = await ensureUniqueSlug(patch.slug, Collection, id);
    if (free !== patch.slug) throw new UnprocessableError('Esa dirección ya está en uso.');
  }
  if (patch.imageUrl !== undefined && patch.imageUrl !== col.imageUrl) {
    await dropReplacedImage(col.imagePublicId ?? undefined, patch.imageUrl);
  }
  col.set(patch);
  await col.save();
  return col;
}

export async function setCollectionActive(id: string, active: boolean) {
  const col = await Collection.findByIdAndUpdate(id, { active }, { new: true });
  if (!col) throw new NotFoundError('Colección no encontrada.');
  return col;
}

export async function reorderCollections(orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, i) => Collection.updateOne({ _id: id }, { position: i })),
  );
}

// --------------------------------------------------------- Zonas de envio

export async function listShippingZones() {
  return ShippingZone.find().sort({ city: 1 }).lean();
}

/** Flete informativo: el valor final se acuerda por WhatsApp. */
export async function listPublicShippingZones() {
  return ShippingZone.find({ active: true })
    .sort({ city: 1 })
    .select('city cost estimatedDays notes')
    .lean();
}

export async function createShippingZone(input: ShippingZoneCreate) {
  const clash = await ShippingZone.findOne({ city: input.city }).select('_id').lean();
  if (clash) throw new UnprocessableError('Esa ciudad ya está en la lista.');
  return ShippingZone.create(input);
}

export async function updateShippingZone(id: string, patch: ShippingZoneUpdate) {
  if (patch.city) {
    const clash = await ShippingZone.findOne({ city: patch.city, _id: { $ne: id } })
      .select('_id')
      .lean();
    if (clash) throw new UnprocessableError('Esa ciudad ya está en la lista.');
  }
  const zone = await ShippingZone.findByIdAndUpdate(id, patch, {
    new: true,
    runValidators: true,
  });
  if (!zone) throw new NotFoundError('Zona no encontrada.');
  return zone;
}

export async function setShippingZoneActive(id: string, active: boolean) {
  const zone = await ShippingZone.findByIdAndUpdate(id, { active }, { new: true });
  if (!zone) throw new NotFoundError('Zona no encontrada.');
  return zone;
}
