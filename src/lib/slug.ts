import type { Model } from 'mongoose';

/** "Mecedora Buga (miel)" -> "mecedora-buga-miel". Sin acentos, sin simbolos. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // quita acentos (combinaciones de la forma NFD)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Slug unico en la coleccion. Si `base` ya existe, agrega -2, -3, ... El `excludeId`
 * evita chocar con el propio documento al editar.
 */
export async function ensureUniqueSlug(
  base: string,
  model: Model<any>,
  excludeId?: string,
): Promise<string> {
  const root = slugify(base) || 'mueble';
  let candidate = root;
  let n = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await model
      .findOne({ slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })
      .select('_id')
      .lean();
    if (!clash) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}
