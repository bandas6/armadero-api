import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, isAbsolute, resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { connectDb, disconnectDb } from '../lib/db.js';
import { Category } from '../models/catalog.model.js';
import { Product } from '../models/product.model.js';
import { slugify, ensureUniqueSlug } from '../lib/slug.js';
import { assertCloudinary } from '../lib/cloudinary.js';
import { uploadProductImage, deleteImage } from '../services/upload.service.js';

/**
 * Carga inicial del catálogo desde la plantilla xlsx (Fase 5).
 *
 *   cd apiArtemadero && npm run importar -- ../docs/plantilla-catalogo.xlsx [--dry-run] [--refotos]
 *
 * Idempotente: upsert por slug. Re-correr actualiza texto y precio sin duplicar y, salvo
 * --refotos, sin volver a subir fotos.
 */

const FOTOS_DIR = join(process.cwd(), 'assets', 'catalogo'); // se corre desde apiArtemadero/

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const REFOTOS = args.includes('--refotos');
const xlsxArg = args.find((a) => !a.startsWith('--'));

type Row = {
  fila: number;
  nombre: string;
  categoria: string;
  material?: 'tejido' | 'madera';
  descripcionCorta?: string;
  descripcion?: string;
  precio?: number;
  puestos?: number;
  anchoCm?: number;
  altoCm?: number;
  fondoCm?: number;
  acabado?: string;
  personalizable: boolean;
  destacado: boolean;
  fotos: string[];
};

function cellStr(v: ExcelJS.CellValue): string {
  if (v == null) return '';
  if (typeof v === 'object' && 'text' in v) return String(v.text).trim();
  if (typeof v === 'object' && 'result' in v) return String(v.result ?? '').trim();
  return String(v).trim();
}
function cellNum(v: ExcelJS.CellValue): number | undefined {
  const s = cellStr(v).replace(/[.\s$]/g, '').replace(',', '.');
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
const yes = (v: ExcelJS.CellValue) => /^(si|sí|s|x|true|1)$/i.test(cellStr(v));

async function readRows(path: string): Promise<Row[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.getWorksheet('Productos') ?? wb.worksheets[0];
  if (!ws) throw new Error('El archivo no tiene una hoja "Productos".');

  const rows: Row[] = [];
  ws.eachRow((row, i) => {
    if (i === 1) return; // encabezado
    const nombre = cellStr(row.getCell(1).value);
    if (!nombre) return; // fila vacía
    const material = cellStr(row.getCell(3).value).toLowerCase();
    rows.push({
      fila: i,
      nombre,
      categoria: cellStr(row.getCell(2).value).toLowerCase(),
      material: material === 'tejido' || material === 'madera' ? material : undefined,
      descripcionCorta: cellStr(row.getCell(4).value) || undefined,
      descripcion: cellStr(row.getCell(5).value) || undefined,
      precio: cellNum(row.getCell(6).value),
      puestos: cellNum(row.getCell(7).value),
      anchoCm: cellNum(row.getCell(8).value),
      altoCm: cellNum(row.getCell(9).value),
      fondoCm: cellNum(row.getCell(10).value),
      acabado: cellStr(row.getCell(11).value) || undefined,
      personalizable: yes(row.getCell(12).value),
      destacado: yes(row.getCell(13).value),
      fotos: cellStr(row.getCell(14).value)
        .split(/[;,\n]/)
        .map((f) => f.trim())
        .filter(Boolean),
    });
  });
  return rows;
}

async function main() {
  if (!xlsxArg) {
    console.error('Uso: npm run importar -- <ruta.xlsx> [--dry-run] [--refotos]');
    process.exit(1);
  }
  const xlsxPath = isAbsolute(xlsxArg) ? xlsxArg : resolve(xlsxArg); // relativo al cwd (apiArtemadero/)
  if (!existsSync(xlsxPath)) {
    console.error(`No existe el archivo: ${xlsxPath}`);
    process.exit(1);
  }
  if (!DRY) assertCloudinary();

  await connectDb();

  const cats = await Category.find({ active: true }).select('slug name parent').lean();
  const isParent = new Set(cats.filter((c) => c.parent).map((c) => String(c.parent)));
  const leafBySlug = new Map(
    cats.filter((c) => !isParent.has(String(c._id))).map((c) => [c.slug, c]),
  );
  const leafByName = new Map(
    cats.filter((c) => !isParent.has(String(c._id))).map((c) => [slugify(c.name), c]),
  );

  // Mapa plano nombre-de-archivo -> ruta. Los nombres de las carpetas de fotos
  // (butacos, mesedoras, ...) no coinciden con los slugs de las subcategorías
  // (butacos-tejidos, mecedoras-tejidas), y una misma carpeta alimenta a varias
  // subcategorías. Como los nombres de archivo son únicos, se resuelve la foto por
  // nombre, sin acoplar carpeta y categoría.
  const fotoPorNombre = new Map<string, string>();
  try {
    const indice: Record<string, string[]> = JSON.parse(
      await readFile(join(FOTOS_DIR, 'indice.json'), 'utf8'),
    );
    for (const [carpeta, files] of Object.entries(indice)) {
      for (const f of files) fotoPorNombre.set(f, join(FOTOS_DIR, carpeta, f));
    }
  } catch {
    console.warn(
      '[importar] assets/catalogo/indice.json no existe. Corre `npm run fotos:catalogo` primero.',
    );
  }

  const rows = await readRows(xlsxPath);
  console.log(`[importar] ${rows.length} filas con datos en la hoja.\n`);

  // --- Validación ---
  const resolveCat = (r: Row) => leafBySlug.get(r.categoria) ?? leafByName.get(slugify(r.categoria));
  const problemas: string[] = [];
  const validas: Row[] = [];

  for (const r of rows) {
    const errs: string[] = [];
    const cat = resolveCat(r);
    if (!cat) errs.push(`categoría "${r.categoria}" no existe (créala en el panel primero)`);
    if (r.precio !== undefined && Number.isNaN(r.precio)) errs.push('precio no es un número');
    if ((r.precio === undefined || r.precio === 0) && !r.personalizable) {
      errs.push('sin precio: marca "personalizable" = si (un mueble sin precio va a la medida)');
    }
    for (const f of r.fotos) {
      if (!fotoPorNombre.has(f)) {
        errs.push(`la foto "${f}" no está en assets/catalogo/ (revisa el índice de fotos)`);
      }
    }
    if (errs.length) problemas.push(`  fila ${r.fila} (${r.nombre}): ${errs.join('; ')}`);
    else validas.push(r);
  }

  console.log(`${validas.length} válidas · ${problemas.length} con error`);
  if (problemas.length) console.log('\nErrores:\n' + problemas.join('\n'));

  if (DRY) {
    console.log('\n[importar] --dry-run: no se escribió nada.');
    await disconnectDb();
    return;
  }

  // --- Escritura ---
  let creados = 0;
  let actualizados = 0;
  let fotosSubidas = 0;

  for (const r of validas) {
    const cat = resolveCat(r)!;
    // Upsert por el slug natural del nombre.
    let doc = await Product.findOne({ slug: slugify(r.nombre) });
    const isNew = !doc;
    if (!doc) {
      doc = new Product();
      doc.slug = await ensureUniqueSlug(r.nombre, Product);
    }

    const variant = {
      sku:
        doc.variants?.[0]?.sku ??
        `${slugify(r.nombre).replace(/-/g, '').slice(0, 6).toUpperCase() || 'MUEBLE'}-1`,
      name: 'Estándar',
      price: r.precio && r.precio > 0 ? Math.round(r.precio) : undefined,
      seats: r.puestos || undefined,
      widthCm: r.anchoCm || undefined,
      heightCm: r.altoCm || undefined,
      depthCm: r.fondoCm || undefined,
      isDefault: true,
      active: true,
      position: 0,
    };

    doc.set({
      name: r.nombre,
      shortDescription: r.descripcionCorta,
      description: r.descripcion,
      material: r.material ? (r.material === 'tejido' ? 'Tejido' : 'Madera') : doc.material,
      finish: r.acabado,
      status: 'MADE_TO_ORDER',
      personalizable: r.personalizable,
      featured: r.destacado,
      category: cat._id,
      variants: [variant],
    });

    // Fotos: solo en alta, o con --refotos.
    if (isNew || REFOTOS) {
      if (REFOTOS && doc.images?.length) {
        for (const img of doc.images) {
          if (img.publicId) await deleteImage(img.publicId).catch(() => {});
        }
        doc.set('images', []);
      }
      for (const [i, file] of r.fotos.entries()) {
        const buf = await readFile(fotoPorNombre.get(file)!);
        const up = await uploadProductImage(buf);
        doc.images.push({
          url: up.url,
          publicId: up.publicId,
          alt: r.nombre,
          position: i,
          isPrimary: i === 0,
        });
        fotosSubidas++;
      }
    }

    doc.active = isNew ? doc.images.length > 0 : doc.active;
    await doc.save();

    if (isNew) {
      creados++;
      console.log(`  + ${doc.slug}  (${doc.images.length} fotos)`);
    } else {
      actualizados++;
      console.log(`  ~ ${doc.slug}`);
    }
  }

  console.log(
    `\n[importar] creados ${creados} · actualizados ${actualizados} · ` +
      `saltados ${problemas.length} · fotos subidas ${fotosSubidas}`,
  );
  await disconnectDb();
}

main().catch(async (err) => {
  console.error('[importar] Fallo:', err);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
