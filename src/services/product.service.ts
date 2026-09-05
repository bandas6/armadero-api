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

/** Ficha completa de un producto: una sola lectura, variantes e imagenes ya embebidas. */
export async function getProductBySlug(slug: string) {
  const product = await Product.findOne({ slug, active: true })
    .populate('category', 'name slug parent material')
    .lean();

  if (!product) throw new ProductNotFoundError(slug);
  return product;
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

const CARD_FIELDS =
  'name slug shortDescription primaryImageUrl priceFrom priceTo hasPrice personalizable status category position featured createdAt';

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

  return { items, total, page: query.page, pageSize: query.pageSize };
}
