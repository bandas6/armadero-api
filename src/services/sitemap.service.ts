import { Product } from '../models/product.model.js';
import { Category, Collection } from '../models/catalog.model.js';
import { env } from '../lib/env.js';

type UrlEntry = { loc: string; lastmod?: string; changefreq?: string; priority?: string };

let cache: { xml: string; at: number } | null = null;
const TTL_MS = 60 * 60 * 1000; // 1 h

function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!),
  );
}

function renderUrlset(entries: UrlEntry[]): string {
  const body = entries
    .map((e) => {
      const parts = [`    <loc>${xmlEscape(e.loc)}</loc>`];
      if (e.lastmod) parts.push(`    <lastmod>${e.lastmod}</lastmod>`);
      if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
      if (e.priority) parts.push(`    <priority>${e.priority}</priority>`);
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export async function buildSitemap(): Promise<string> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.xml;

  const base = env.PUBLIC_SITE_URL.replace(/\/$/, '');

  const [products, categories, collections] = await Promise.all([
    Product.find({ active: true }).select('slug updatedAt').sort({ updatedAt: -1 }).lean(),
    Category.find({ active: true }).select('slug parent updatedAt').lean(),
    Collection.find({ active: true }).select('slug updatedAt').lean(),
  ]);

  const isParent = new Set(categories.filter((c) => c.parent).map((c) => String(c.parent)));

  const entries: UrlEntry[] = [
    { loc: `${base}/`, changefreq: 'weekly', priority: '1.0' },
    { loc: `${base}/catalogo`, changefreq: 'daily', priority: '0.9' },
  ];

  for (const c of categories) {
    // Los padres agrupan; las hojas son las que filtran productos. Ambas son navegables.
    entries.push({
      loc: `${base}/catalogo?categoria=${encodeURIComponent(c.slug)}`,
      lastmod: c.updatedAt ? new Date(c.updatedAt).toISOString().slice(0, 10) : undefined,
      changefreq: 'weekly',
      priority: isParent.has(String(c._id)) ? '0.7' : '0.6',
    });
  }

  for (const c of collections) {
    entries.push({
      loc: `${base}/coleccion/${encodeURIComponent(c.slug)}`,
      lastmod: c.updatedAt ? new Date(c.updatedAt).toISOString().slice(0, 10) : undefined,
      changefreq: 'weekly',
      priority: '0.7',
    });
  }

  for (const p of products) {
    entries.push({
      loc: `${base}/producto/${encodeURIComponent(p.slug)}`,
      lastmod: p.updatedAt ? new Date(p.updatedAt).toISOString().slice(0, 10) : undefined,
      changefreq: 'weekly',
      priority: '0.8',
    });
  }

  const xml = renderUrlset(entries);
  cache = { xml, at: Date.now() };
  return xml;
}
