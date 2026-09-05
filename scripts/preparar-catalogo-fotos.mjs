#!/usr/bin/env node
/**
 * Renombra y optimiza TODAS las fotos de la clienta para la carga inicial (Fase 5).
 *
 *   node scripts/preparar-catalogo-fotos.mjs "imagenes y documentos"
 *
 * Toma cada carpeta de categoría (con nombres de archivo tipo "WhatsApp Image ….jpeg"),
 * produce nombres limpios y ordenados en `assets/catalogo/<slug>/<slug>-NN.webp`, y genera
 * dos índices:
 *   - assets/catalogo/indice.json  -> { "<slug>": ["<slug>-01.webp", ...] }  (lo usa el importador)
 *   - assets/catalogo/indice.html  -> hoja de contactos para elegir fotos al llenar la plantilla
 *
 * `assets/catalogo/` está en .gitignore: pesa, es regenerable y su destino final es Cloudinary.
 */

import { readdir, mkdir, stat, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import sharp from 'sharp';

const ORIGEN = process.argv[2];
const DESTINO = 'assets/catalogo';
const ANCHO_MAX = 1600;
const CALIDAD = 80;

if (!ORIGEN) {
  console.error('Uso: node scripts/preparar-catalogo-fotos.mjs "<carpeta de fotos>"');
  process.exit(1);
}

/** "comedores rusticos" -> "comedores-rusticos" */
const RANGO_ACENTOS = new RegExp('[\\u0300-\\u036f]', 'g');
const slug = (s) =>
  s
    .normalize('NFD')
    .replace(RANGO_ACENTOS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const IGNORAR = new Set([
  'node_modules', 'assets', 'design', 'docs', 'scripts', 'api', 'web', 'dist',
  'notas whatsapp audio',
]);

const entradas = await readdir(ORIGEN, { withFileTypes: true });
const categorias = entradas.filter(
  (e) => e.isDirectory() && !e.name.startsWith('.') && !IGNORAR.has(e.name),
);

const indice = {};
let total = 0;

for (const cat of categorias) {
  const dirOrigen = join(ORIGEN, cat.name);
  const s = slug(cat.name);
  const archivos = (await readdir(dirOrigen))
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();
  if (!archivos.length) continue;

  const dirDestino = join(DESTINO, s);
  await mkdir(dirDestino, { recursive: true });
  indice[s] = [];

  for (const [i, f] of archivos.entries()) {
    const nombre = `${s}-${String(i + 1).padStart(2, '0')}.webp`;
    try {
      await sharp(join(dirOrigen, f))
        .rotate()
        .resize({ width: ANCHO_MAX, withoutEnlargement: true })
        .webp({ quality: CALIDAD })
        .toFile(join(dirDestino, nombre));
      indice[s].push(nombre);
      total++;
    } catch (err) {
      console.warn(`  ! ${cat.name}/${f}: ${err.message}`);
    }
  }
  console.log(`${cat.name} -> ${indice[s].length} fotos (${s})`);
}

await writeFile(join(DESTINO, 'indice.json'), JSON.stringify(indice, null, 2));

const html = [
  '<!doctype html><meta charset="utf-8"><title>Índice de fotos — Artemadero</title>',
  '<style>body{font:14px system-ui;margin:24px;background:#f1ede4}h2{margin:32px 0 8px}',
  '.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}',
  'figure{margin:0;background:#fff;border:1px solid #ccc;border-radius:4px;padding:6px}',
  'img{width:100%;height:120px;object-fit:cover;border-radius:2px}',
  'figcaption{font:12px monospace;margin-top:4px;word-break:break-all}</style>',
  '<h1>Índice de fotos para la plantilla</h1>',
  '<p>Copia el nombre que aparece bajo cada foto en la columna <b>fotos</b> de la plantilla. Varias fotos: sepáralas con <code>;</code></p>',
];
for (const [s, files] of Object.entries(indice)) {
  html.push(`<h2>${s} <small>(${files.length})</small></h2><div class="g">`);
  for (const f of files) {
    html.push(`<figure><img loading="lazy" src="${s}/${f}"><figcaption>${f}</figcaption></figure>`);
  }
  html.push('</div>');
}
await writeFile(join(DESTINO, 'indice.html'), html.join('\n'));

console.log(`\n${total} fotos en ${DESTINO}/`);
console.log(`Índice visual: ${join(DESTINO, 'indice.html')}`);
console.log(`Índice para el importador: ${join(DESTINO, 'indice.json')}`);
