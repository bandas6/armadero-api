import { Category } from '../models/catalog.model.js';
import { Product } from '../models/product.model.js';
import { ensureUniqueSlug } from '../lib/slug.js';
import { NotFoundError, UnprocessableError } from '../lib/errors.js';
import { deleteImage } from './upload.service.js';
import type {
  AdminCategoryCreate,
  AdminCategoryUpdate,
} from '../schemas/admin-category.schema.js';

export type AdminCategoryRow = {
  _id: string;
  name: string;
  slug: string;
  parent: string | null;
  parentName: string | null;
  material: 'tejido' | 'madera' | null;
  description: string | null;
  imageUrl: string | null;
  position: number;
  active: boolean;
  productCount: number;
  isLeaf: boolean;
};

/** Conteo de productos activos por categoria hoja, en una sola agregacion. */
async function productCountByCategory(): Promise<Map<string, number>> {
  const rows = await Product.aggregate<{ _id: unknown; count: number }>([
    { $match: { active: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

export async function listAdminCategories(): Promise<AdminCategoryRow[]> {
  const [cats, counts] = await Promise.all([
    Category.find().sort({ position: 1, name: 1 }).lean(),
    productCountByCategory(),
  ]);

  const byId = new Map(cats.map((c) => [String(c._id), c]));
  const hasChildren = new Set(cats.filter((c) => c.parent).map((c) => String(c.parent)));

  return cats.map((c) => {
    const id = String(c._id);
    const isLeaf = !hasChildren.has(id);
    const direct = counts.get(id) ?? 0;
    const childrenSum = cats
      .filter((x) => String(x.parent) === id)
      .reduce((sum, x) => sum + (counts.get(String(x._id)) ?? 0), 0);
    return {
      _id: id,
      name: c.name,
      slug: c.slug,
      parent: c.parent ? String(c.parent) : null,
      parentName: c.parent ? byId.get(String(c.parent))?.name ?? null : null,
      material: (c.material as 'tejido' | 'madera' | undefined) ?? null,
      description: c.description ?? null,
      imageUrl: c.imageUrl ?? null,
      position: c.position ?? 0,
      active: c.active,
      productCount: isLeaf ? direct : childrenSum,
      isLeaf,
    };
  });
}

/** Ids de la categoria y toda su descendencia (2 niveles como maximo). */
async function subtreeIds(rootId: string): Promise<string[]> {
  const children = await Category.find({ parent: rootId }).select('_id').lean();
  return [rootId, ...children.map((c) => String(c._id))];
}

async function hiddenProductCount(categoryId: string): Promise<number> {
  const ids = await subtreeIds(categoryId);
  return Product.countDocuments({ category: { $in: ids }, active: true });
}

export async function createCategory(input: AdminCategoryCreate) {
  let parent: string | null = null;
  if (input.parentId) {
    const p = await Category.findById(input.parentId).lean();
    if (!p) throw new NotFoundError('La categoría padre no existe.');
    if (p.parent) {
      throw new UnprocessableError('El catálogo tiene solo dos niveles: no puedes anidar más.');
    }
    parent = String(p._id);
  }

  if (input.material && !parent) {
    throw new UnprocessableError('El material (tejido / madera) solo aplica a una subcategoría.');
  }

  const last = await Category.findOne({ parent }).sort({ position: -1 }).select('position').lean();

  const doc = await Category.create({
    name: input.name,
    slug: await ensureUniqueSlug(input.name, Category),
    parent,
    material: input.material ?? undefined,
    description: input.description,
    imageUrl: input.imageUrl || undefined,
    imagePublicId: input.imagePublicId || undefined,
    position: input.position ?? (last ? (last.position ?? 0) + 1 : 0),
    active: true,
  });
  return doc;
}

export async function updateCategory(id: string, patch: AdminCategoryUpdate) {
  const cat = await Category.findById(id);
  if (!cat) throw new NotFoundError('No encontramos esta categoría.');

  // Cambiar de padre: revalida los dos niveles.
  if (patch.parentId !== undefined) {
    if (patch.parentId === null) {
      cat.parent = null;
    } else {
      const p = await Category.findById(patch.parentId).lean();
      if (!p) throw new NotFoundError('La categoría padre no existe.');
      if (p.parent) throw new UnprocessableError('El catálogo tiene solo dos niveles.');
      const hasChildren = await Category.exists({ parent: id });
      if (hasChildren) {
        throw new UnprocessableError('Esta categoría ya tiene subcategorías: no puede volverse hija.');
      }
      cat.parent = p._id;
    }
  }

  if (patch.name !== undefined) cat.name = patch.name;
  if (patch.description !== undefined) cat.description = patch.description;
  if (patch.material !== undefined) {
    if (patch.material && !cat.parent) {
      throw new UnprocessableError('El material solo aplica a una subcategoría.');
    }
    cat.material = patch.material ?? undefined;
  }
  if (patch.position !== undefined) cat.position = patch.position;

  // El nombre no arrastra el slug ya publicado; el slug solo cambia si viene explicito.
  if (patch.slug !== undefined && patch.slug !== cat.slug) {
    cat.slug = await ensureUniqueSlug(patch.slug, Category, id);
  }

  // Reemplazo de imagen: borra la anterior en Cloudinary.
  if (patch.imageUrl !== undefined && patch.imageUrl !== cat.imageUrl) {
    const previousPublicId = cat.imagePublicId;
    cat.imageUrl = patch.imageUrl || undefined;
    cat.imagePublicId = patch.imageUrl ? patch.imagePublicId || undefined : undefined;
    if (previousPublicId && previousPublicId !== cat.imagePublicId) {
      try {
        await deleteImage(previousPublicId);
      } catch (err) {
        console.error('[admin] no se pudo borrar la imagen de categoria:', previousPublicId, err);
      }
    }
  }

  await cat.save();
  return cat;
}

export async function setCategoryActive(id: string, active: boolean) {
  const cat = await Category.findById(id);
  if (!cat) throw new NotFoundError('No encontramos esta categoría.');

  const affected = active ? 0 : await hiddenProductCount(id);

  cat.active = active;
  await cat.save();

  // Ocultar un padre oculta también sus hijas (para que la navegación quede coherente).
  if (!active && !cat.parent) {
    await Category.updateMany({ parent: id }, { active: false });
  }

  return { category: cat, hiddenProductCount: affected };
}

export async function reorderCategories(orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, index) => Category.updateOne({ _id: id }, { position: index })),
  );
}
