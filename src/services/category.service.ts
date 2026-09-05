import { Category } from '../models/catalog.model.js';
import { Product } from '../models/product.model.js';

export type CategoryMaterial = 'tejido' | 'madera';

export type CategoryNode = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  material?: CategoryMaterial;
  position: number;
  /** Productos activos: en una hoja es directo, en un padre es la suma de sus hijos. */
  productCount: number;
  children: CategoryNode[];
};

/**
 * Arbol de categorias activas, dos niveles (tipo -> material). Una categoria "de
 * madera" sin fotos todavia sigue apareciendo aqui: el arbol no se filtra por si tiene
 * productos o no, eso lo decide la capa visual (ver docs/cliente.md). Cada nodo trae
 * `productCount` justamente para que el front muestre el estado "Pronto" en las vacias.
 */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  const categories = await Category.find({ active: true })
    .sort({ position: 1, name: 1 })
    .lean();

  // Conteo de productos activos por categoria hoja, en una sola agregacion.
  const counts = await Product.aggregate<{ _id: unknown; count: number }>([
    { $match: { active: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const countByCategory = new Map<string, number>();
  for (const c of counts) countByCategory.set(String(c._id), c.count);

  const byId = new Map<string, CategoryNode>();
  for (const c of categories) {
    byId.set(String(c._id), {
      _id: String(c._id),
      name: c.name,
      slug: c.slug,
      description: c.description ?? undefined,
      imageUrl: c.imageUrl ?? undefined,
      material: (c.material as CategoryMaterial | undefined) ?? undefined,
      position: c.position ?? 0,
      productCount: countByCategory.get(String(c._id)) ?? 0,
      children: [],
    });
  }

  const roots: CategoryNode[] = [];
  for (const c of categories) {
    const node = byId.get(String(c._id))!;
    if (c.parent) {
      const parent = byId.get(String(c.parent));
      if (parent) parent.children.push(node);
      else roots.push(node); // padre inactivo o inexistente: no se pierde el nodo
    } else {
      roots.push(node);
    }
  }

  // Un padre sin conteo propio suma el de sus hijos (los productos cuelgan de la hoja).
  for (const node of roots) {
    if (node.children.length) {
      node.productCount = node.children.reduce((sum, child) => sum + child.productCount, 0);
    }
  }

  return roots;
}
