import type { FilterQuery } from 'mongoose';
import { Category } from '../models/catalog.model.js';
import { Product } from '../models/product.model.js';
import type { ProductListQuery } from '../schemas/product-list.schema.js';

export class ProductNotFoundError extends Error {
  constructor(slug: string) {
    super(`No existe un producto activo con slug "${slug}".`);
    this.name = 'ProductNotFoundError';
  }
}

/**
 * Ficha completa de un producto: una sola lectura, variantes e imagenes ya embebidas.
 * Trae ademas la pieza gemela en el otro material, resumida como tarjeta: la ficha la
 * muestra en su propio bloque y es una de las tres apariciones del corte tejido/madera
 * (design/PROMPT-4-ficha.md). Si no hay gemela, el campo viene en null y la ficha omite
 * el bloque.
 */
export async function getProductBySlug(slug: string) {
  const product = await Product.findOne({ slug, active: true })
    .populate('category', 'name slug parent material')
    .populate({
      path: 'twinProduct',
      match: { active: true },
      select: TWIN_FIELDS,
      populate: { path: 'category', select: 'name slug parent material' },
    })
    .lean();

  if (!product) throw new ProductNotFoundError(slug);

  // `twinProduct` viene poblado (o null si la gemela quedo inactiva o no existe): el
  // tipo de Mongoose sigue siendo el del ref sin poblar, de ahi el paso por unknown.
  const { twinProduct, ...rest } = product as typeof product & { twinProduct?: unknown };
  return { ...rest, twin: twinProduct ? toCard(twinProduct as unknown as RawCard) : null };
}

/**
 * Resuelve el filtro por categoria y/o material a un conjunto de ids de categorias HOJA.
 * Los productos apuntan siempre a la hoja (docs/modelo-datos.md), asi que el listado de
 * un padre consulta por todos sus hijos.
 *
 * Devuelve `null` cuando no hay ningun filtro de categoria ni de material (no hace falta
 * restringir por `category`), o un arreglo (posiblemente vacio) de ids cuando si.
 */
async function resolveLeafCategoryIds(
  categorySlug: string | undefined,
  material: 'tejido' | 'madera' | undefined,
): Promise<string[] | null> {
  if (!categorySlug && !material) return null;

  const categories = await Category.find({ active: true })
    .select('slug parent material')
    .lean();

  const byId = new Map(categories.map((c) => [String(c._id), c]));
  const childrenOf = new Map<string, string[]>();
  for (const c of categories) {
    if (c.parent) {
      const key = String(c.parent);
      childrenOf.set(key, [...(childrenOf.get(key) ?? []), String(c._id)]);
    }
  }

  // Punto de partida: la categoria pedida y toda su descendencia, o todo el arbol.
  let scopeIds: string[];
  if (categorySlug) {
    const root = categories.find((c) => c.slug === categorySlug);
    if (!root) return []; // slug inexistente: no hay productos
    scopeIds = [];
    const stack = [String(root._id)];
    while (stack.length) {
      const id = stack.pop()!;
      scopeIds.push(id);
      for (const child of childrenOf.get(id) ?? []) stack.push(child);
    }
  } else {
    scopeIds = categories.map((c) => String(c._id));
  }

  // Solo hojas (sin hijos). Los productos nunca cuelgan de un padre.
  const leafIds = scopeIds.filter((id) => !(childrenOf.get(id)?.length));

  if (!material) return leafIds;
  return leafIds.filter((id) => byId.get(id)?.material === material);
}

/**
 * Campos de tarjeta. Las medidas entran aqui a proposito: en esta direccion de diseno la
 * cedula de medidas va en TODAS las tarjetas, no solo en la ficha, y sin ellas el
 * catalogo pierde lo que la clienta considera el dato principal (design/PROMPT-3-catalogo.md).
 * Se proyectan solo los subcampos de medida de las variantes, no el arreglo entero.
 */
const CARD_FIELDS =
  'name slug shortDescription primaryImageUrl priceFrom priceTo hasPrice personalizable status category position featured createdAt' +
  ' variants.seats variants.widthCm variants.heightCm variants.depthCm variants.sizeLabel variants.isDefault variants.active';

/** Igual que la tarjeta, para la pieza gemela que muestra la ficha. */
const TWIN_FIELDS = CARD_FIELDS;

type RawVariant = {
  seats?: number;
  widthCm?: number;
  heightCm?: number;
  depthCm?: number;
  sizeLabel?: string;
  isDefault?: boolean;
  active?: boolean;
};

type RawCard = Record<string, unknown> & { variants?: RawVariant[] };

/**
 * Medidas que la tarjeta muestra: las de la variante por defecto (la que el comprador ve
 * primero). Un mueble con varias medidas se explora entrando a la ficha.
 */
function cardMeasures(variants: RawVariant[] | undefined) {
  if (!variants?.length) return null;
  const actives = variants.filter((v) => v.active !== false);
  const pool = actives.length ? actives : variants;
  const v = pool.find((x) => x.isDefault) ?? pool[0];
  if (!v) return null;
  if (
    v.seats === undefined &&
    v.widthCm === undefined &&
    v.heightCm === undefined &&
    v.depthCm === undefined &&
    !v.sizeLabel
  ) {
    return null;
  }
  return {
    seats: v.seats,
    widthCm: v.widthCm,
    heightCm: v.heightCm,
    depthCm: v.depthCm,
    sizeLabel: v.sizeLabel,
  };
}

/** Cambia el arreglo de variantes proyectado por las medidas ya resueltas. */
function toCard(doc: RawCard) {
  const { variants, ...rest } = doc;
  return { ...rest, measures: cardMeasures(variants) };
}

const SORT_MAP: Record<ProductListQuery['sort'], Record<string, 1 | -1>> = {
  destacados: { featured: -1, position: 1, createdAt: -1 },
  'precio-asc': { hasPrice: -1, priceFrom: 1 },
  'precio-desc': { hasPrice: -1, priceFrom: -1 },
  recientes: { createdAt: -1 },
};

/** Listado del catalogo: campos planos denormalizados, sin abrir variantes ni imagenes. */
export async function listProducts(query: ProductListQuery) {
  const filter: FilterQuery<typeof Product> = { active: true };

  const leafIds = await resolveLeafCategoryIds(query.category, query.material);
  if (leafIds !== null) {
    if (leafIds.length === 0) {
      return { items: [], total: 0, page: query.page, pageSize: query.pageSize };
    }
    filter.category = { $in: leafIds };
  }

  // El filtro de precio solo aplica a productos con precio de lista: los "segun medidas"
  // (hasPrice: false) se excluyen, no se tratan como si valieran cero (docs/modelo-datos.md).
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.hasPrice = true;
    filter.priceFrom = {};
    if (query.minPrice !== undefined) filter.priceFrom.$gte = query.minPrice;
    if (query.maxPrice !== undefined) filter.priceFrom.$lte = query.maxPrice;
  }

  // "Se fabrica a la medida": un caso de primera clase del catalogo, no un adorno.
  if (query.personalizable !== undefined) filter.personalizable = query.personalizable;

  // "Entrega inmediata": lo que ya esta hecho en el local, sin esperar fabricacion.
  if (query.disponible) filter.status = 'AVAILABLE';

  // Puestos: consulta directa sobre el arreglo embebido (indice multikey de variantes).
  if (query.seats !== undefined) filter['variants.seats'] = query.seats;

  if (query.q) filter.$text = { $search: query.q };

  const skip = (query.page - 1) * query.pageSize;

  const [items, total] = await Promise.all([
    Product.find(filter)
      .select(CARD_FIELDS)
      .populate('category', 'name slug parent material')
      .sort(SORT_MAP[query.sort])
      .skip(skip)
      .limit(query.pageSize)
      .lean(),
    Product.countDocuments(filter),
  ]);

  return { items: items.map((i) => toCard(i as RawCard)), total, page: query.page, pageSize: query.pageSize };
}

/**
 * Tarjetas de un conjunto de productos, en el orden de `ids` (el orden del arreglo de una
 * coleccion manda). Los inactivos se omiten sin dejar hueco.
 */
export async function listProductCardsByIds(ids: unknown[]) {
  if (!ids.length) return [];
  const docs = await Product.find({ _id: { $in: ids }, active: true })
    .select(CARD_FIELDS)
    .populate('category', 'name slug parent material')
    .lean();
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  return ids
    .map((id) => byId.get(String(id)))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .map((d) => toCard(d as RawCard));
}
