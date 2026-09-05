import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { connectDb, disconnectDb } from '../lib/db.js';
import { Category } from '../models/catalog.model.js';

/**
 * Genera docs/plantilla-catalogo.xlsx: la hoja que se llena para la carga inicial
 * (Fase 5), con listas desplegables y hojas de referencia.
 *
 *   cd apiArtemadero && npm run plantilla
 *
 * Regenera el archivo con los datos actuales de la base (categorías) y del índice de
 * fotos (apiArtemadero/assets/catalogo/indice.json, si existe).
 */

const API_ROOT = process.cwd(); // se corre desde apiArtemadero/
const OUT = join(API_ROOT, '..', 'docs', 'plantilla-catalogo.xlsx');
const INDICE = join(API_ROOT, 'assets', 'catalogo', 'indice.json');

const PRODUCT_COLUMNS = [
  { header: 'nombre', key: 'nombre', width: 28 },
  { header: 'categoria', key: 'categoria', width: 22 },
  { header: 'material', key: 'material', width: 12 },
  { header: 'descripcion_corta', key: 'descripcion_corta', width: 40 },
  { header: 'descripcion', key: 'descripcion', width: 50 },
  { header: 'precio', key: 'precio', width: 12 },
  { header: 'puestos', key: 'puestos', width: 9 },
  { header: 'ancho_cm', key: 'ancho_cm', width: 9 },
  { header: 'alto_cm', key: 'alto_cm', width: 9 },
  { header: 'fondo_cm', key: 'fondo_cm', width: 9 },
  { header: 'acabado', key: 'acabado', width: 18 },
  { header: 'personalizable', key: 'personalizable', width: 13 },
  { header: 'destacado', key: 'destacado', width: 11 },
  { header: 'fotos', key: 'fotos', width: 40 },
];

const EJEMPLOS = [
  {
    nombre: 'Mecedora Buga',
    categoria: 'mecedoras-tejidas',
    material: 'tejido',
    descripcion_corta: 'Tejido en mimbre con cojín en lino.',
    descripcion: 'Mecedora tejida a mano en mimbre, con cojín en lino incluido.',
    precio: 1150000,
    puestos: '',
    ancho_cm: 70,
    alto_cm: 105,
    fondo_cm: 90,
    acabado: 'Natural',
    personalizable: 'no',
    destacado: 'si',
    fotos: 'mesedoras-01.webp;mesedoras-02.webp',
  },
  {
    nombre: 'Comedor Sevilla',
    categoria: 'comedores-rusticos',
    material: '',
    descripcion_corta: 'Madera maciza, 8 puestos, se fabrica a la medida.',
    descripcion: 'Comedor en madera maciza con tapa de una sola pieza. Define el largo y las sillas.',
    precio: '',
    puestos: 8,
    ancho_cm: '',
    alto_cm: '',
    fondo_cm: '',
    acabado: 'Sellado mate',
    personalizable: 'si',
    destacado: 'no',
    fotos: 'comedores-rusticos-01.webp',
  },
];

async function run() {
  await connectDb();
  const cats = await Category.find({ active: true }).sort({ position: 1, name: 1 }).lean();
  await disconnectDb();

  const byId = new Map(cats.map((c) => [String(c._id), c]));
  const isParent = new Set(cats.filter((c) => c.parent).map((c) => String(c.parent)));
  const leaves = cats.filter((c) => !isParent.has(String(c._id)));

  let indice: Record<string, string[]> = {};
  try {
    indice = JSON.parse(await readFile(INDICE, 'utf8'));
  } catch {
    console.warn('[plantilla] assets/catalogo/indice.json no existe todavía. ' +
      'Corre `node scripts/preparar-catalogo-fotos.mjs "imagenes y documentos"` para la hoja Fotos.');
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Artemadero';
  wb.created = new Date();

  // --- Hoja Productos ---
  const ws = wb.addWorksheet('Productos', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = PRODUCT_COLUMNS;
  ws.getRow(1).font = { bold: true };
  for (const ej of EJEMPLOS) ws.addRow(ej);

  const lastRow = 400; // filas con validación listas para llenar
  const listCol = (col: string, values: string) => {
    for (let r = 2; r <= lastRow; r++) {
      ws.getCell(`${col}${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [values],
      };
    }
  };
  // categoria -> rango de la hoja Categorias
  for (let r = 2; r <= lastRow; r++) {
    ws.getCell(`B${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`Categorias!$A$2:$A$${leaves.length + 1}`],
    };
  }
  listCol('C', '"tejido,madera"');
  listCol('L', '"si,no"');
  listCol('M', '"si,no"');

  // --- Hoja Categorias (referencia) ---
  const wsCat = wb.addWorksheet('Categorias');
  wsCat.columns = [
    { header: 'slug', key: 'slug', width: 24 },
    { header: 'nombre', key: 'nombre', width: 24 },
    { header: 'padre', key: 'padre', width: 20 },
    { header: 'lleva_material', key: 'material', width: 14 },
  ];
  wsCat.getRow(1).font = { bold: true };
  for (const c of leaves) {
    wsCat.addRow({
      slug: c.slug,
      nombre: c.name,
      padre: c.parent ? byId.get(String(c.parent))?.name ?? '' : '(nivel principal)',
      material: c.parent ? 'tejido / madera' : 'no',
    });
  }

  // --- Hoja Fotos (referencia) ---
  const wsFotos = wb.addWorksheet('Fotos');
  wsFotos.columns = [
    { header: 'categoria', key: 'categoria', width: 22 },
    { header: 'archivos_disponibles', key: 'archivos', width: 120 },
  ];
  wsFotos.getRow(1).font = { bold: true };
  for (const [slug, files] of Object.entries(indice)) {
    wsFotos.addRow({ categoria: slug, archivos: files.join(';') });
  }

  // --- Hoja Instrucciones ---
  const wsHelp = wb.addWorksheet('Instrucciones');
  wsHelp.getColumn(1).width = 110;
  [
    'Cómo llenar la plantilla de Artemadero',
    '',
    '1. Una fila por mueble, en la hoja "Productos".',
    '2. "categoria": elige de la lista (son las subcategorías del catálogo). Si falta una, créala primero en el panel.',
    '3. "material": tejido o madera. Déjalo vacío si la categoría no se divide por material.',
    '4. "precio": el valor en pesos, sin puntos ni símbolos (1150000). Déjalo vacío si el mueble se cotiza según medidas...',
    '   ...pero entonces pon "personalizable" = si (un mueble sin precio tiene que ser a la medida).',
    '5. "puestos", "ancho_cm", "alto_cm", "fondo_cm": números o vacío. En salas y comedores el número de puestos es lo que más importa.',
    '6. "destacado" = si -> aparece en la página de inicio (máximo 8 en total).',
    '7. "fotos": nombres de archivo separados por ; (de la hoja "Fotos"). La primera es la principal.',
    '   Mira assets/catalogo/indice.html para ver las fotos y sus nombres.',
    '8. Un mueble sin fotos se importa oculto: no se puede publicar sin al menos una foto.',
    '',
    'Cuando termines: guarda el archivo y avisa. Se corre primero en modo prueba (--dry-run) para ver errores, y luego en firme.',
  ].forEach((line, i) => {
    wsHelp.getCell(`A${i + 1}`).value = line;
    if (i === 0) wsHelp.getCell('A1').font = { bold: true, size: 14 };
  });

  await wb.xlsx.writeFile(OUT);
  console.log(`[plantilla] Escrita: ${OUT}`);
  console.log(`[plantilla] ${leaves.length} categorías hoja, ${Object.keys(indice).length} categorías con fotos.`);
}

run().catch((err) => {
  console.error('[plantilla] Fallo:', err);
  process.exit(1);
});
