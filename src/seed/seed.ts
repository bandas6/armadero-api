import { connectDb, disconnectDb } from '../lib/db.js';
import { Category } from '../models/catalog.model.js';
import { Product } from '../models/product.model.js';

/**
 * Semilla del catalogo: el arbol de categorias real (dos niveles, tipo -> material,
 * segun docs/cliente.md) y un set de productos de ejemplo que cubre los casos que el
 * catalogo tiene que saber mostrar: tejido y madera, con precio y "segun medidas",
 * destacados y no destacados.
 *
 * Idempotente: usa upsert por slug, se puede correr varias veces sin duplicar.
 *
 * No siembra SiteSetting: el numero de WhatsApp sale de la variable de entorno
 * WHATSAPP_NUMBER, nunca de un dato inventado en la base. GET /api/settings funciona
 * con puros valores por defecto mientras no exista el documento.
 */

type Material = 'tejido' | 'madera';
type CategorySeed = { name: string; slug: string; material?: Material; children?: CategorySeed[] };

const CATEGORY_TREE: CategorySeed[] = [
  {
    name: 'Sala',
    slug: 'sala',
    children: [
      { name: 'Salas tejidas', slug: 'salas-tejidas', material: 'tejido' },
      { name: 'Salas rústicas', slug: 'salas-rusticas', material: 'madera' },
      { name: 'Mesas de centro', slug: 'mesas-de-centro' },
    ],
  },
  {
    name: 'Mecedoras',
    slug: 'mecedoras',
    children: [
      { name: 'Mecedoras tejidas', slug: 'mecedoras-tejidas', material: 'tejido' },
      { name: 'Mecedoras de madera', slug: 'mecedoras-de-madera', material: 'madera' },
    ],
  },
  {
    name: 'Comedor',
    slug: 'comedor',
    children: [
      { name: 'Comedores tejidos', slug: 'comedores-tejidos', material: 'tejido' },
      { name: 'Comedores rústicos', slug: 'comedores-rusticos', material: 'madera' },
    ],
  },
  {
    name: 'Butacos',
    slug: 'butacos',
    children: [
      { name: 'Butacos tejidos', slug: 'butacos-tejidos', material: 'tejido' },
      { name: 'Butacos de madera', slug: 'butacos-de-madera', material: 'madera' },
    ],
  },
  {
    name: 'Alcoba',
    slug: 'alcoba',
    children: [
      { name: 'Camas', slug: 'camas' },
      { name: 'Camarotes', slug: 'camarotes' },
      { name: 'Nocheros', slug: 'nocheros' },
    ],
  },
  {
    name: 'Decoración',
    slug: 'decoracion',
    children: [
      { name: 'Lámparas tejidas', slug: 'lamparas-tejidas', material: 'tejido' },
      { name: 'Espejos tejidos', slug: 'espejos-tejidos', material: 'tejido' },
      { name: 'Espejos de madera', slug: 'espejos-de-madera', material: 'madera' },
    ],
  },
  // Guadua es linea transversal, sin corte tejido/madera: no lleva hijos, los
  // productos se cuelgan directamente de ella.
  { name: 'Guadua', slug: 'guadua' },
];

async function upsertCategory(seed: CategorySeed, parentId: string | null, position: number) {
  const doc = await Category.findOneAndUpdate(
    { slug: seed.slug },
    {
      name: seed.name,
      slug: seed.slug,
      parent: parentId,
      position,
      active: true,
      material: seed.material ?? null,
    },
    { upsert: true, new: true },
  );

  const slugToId = new Map<string, string>();
  slugToId.set(seed.slug, String(doc._id));

  if (seed.children) {
    for (let i = 0; i < seed.children.length; i++) {
      const childMap = await upsertCategory(seed.children[i], String(doc._id), i);
      for (const [s, id] of childMap) slugToId.set(s, id);
    }
  }

  return slugToId;
}

function fotoUrl(categoria: string, archivo: string) {
  const port = process.env.PORT ?? '3000';
  return `http://localhost:${port}/fotos/${categoria}/${archivo}`;
}

type VariantSeed = {
  sku: string;
  name: string;
  price?: number;
  seats?: number;
  fabric?: string;
  colorName?: string;
  sizeLabel?: string;
  widthCm?: number;
  heightCm?: number;
  depthCm?: number;
  seatHeightCm?: number;
  isDefault?: boolean;
};

type ProductSeed = {
  name: string;
  slug: string;
  categorySlug: string;
  shortDescription: string;
  description: string;
  material: string;
  finish?: string;
  /** El espacio que el mueble necesita alrededor, debajo de la cedula de medidas. */
  spaceNote?: string;
  personalizable?: boolean;
  customizationNotes?: string;
  customizationFields?: {
    label: string;
    type: 'number' | 'select' | 'text' | 'boolean';
    required?: boolean;
    unit?: string;
    min?: number;
    max?: number;
    options?: string[];
    hint?: string;
  }[];
  featured?: boolean;
  /** La misma pieza en el otro material. Se engancha en una segunda pasada. */
  twinSlug?: string;
  position?: number;
  variants: VariantSeed[];
  photoDir: string;
  photos: { file: string; alt: string }[];
};

const PRODUCTS: ProductSeed[] = [
  {
    name: 'Sala Guadalajara',
    slug: 'sala-guadalajara',
    categorySlug: 'salas-tejidas',
    shortDescription: 'Tejido en fibra natural, 5 puestos con mesa de centro.',
    description:
      'Sala tejida a mano en fibra natural. Se fabrica a la medida de tu espacio: ' +
      'cuéntanos las medidas y el color de tejido que buscas.',
    material: 'Fibra natural (mimbre)',
    finish: 'Tejido color miel',
    personalizable: true,
    customizationNotes: 'Color del tejido, número de puestos, medidas del espacio.',
    customizationFields: [
      { label: 'Ancho', type: 'number', unit: 'cm', min: 150, max: 400, hint: 'El estándar es 240 cm' },
      { label: 'Alto del respaldo', type: 'number', unit: 'cm', min: 60, max: 120 },
      { label: 'Color del tejido', type: 'select', options: ['Miel', 'Natural', 'Gris'], required: true },
      { label: '¿Con mesa de centro?', type: 'boolean' },
    ],
    featured: true,
    position: 0,
    twinSlug: 'sala-campestre-sevilla',
    spaceNote: 'Cuenta 45 cm entre la sala y la mesa de centro para pasar de frente.',
    variants: [
      {
        sku: 'SG-5P-NAT',
        name: 'Tejido fibra natural - 5 puestos',
        seats: 5,
        fabric: 'Fibra natural',
        colorName: 'Miel',
        isDefault: true,
      },
    ],
    photoDir: 'salas-tejidas',
    photos: [
      { file: 'salas-tejidas-03.webp', alt: 'Sala tejida en fibra natural sobre fondo de piedra, cojines crudos' },
      { file: 'salas-tejidas-01.webp', alt: 'Sala esquinera tejida en exteriores, cojines verdes' },
    ],
  },
  {
    name: 'Sala esquinera Pance',
    slug: 'sala-esquinera-pance',
    categorySlug: 'salas-tejidas',
    shortDescription: 'Modular en L con puf, tejido color miel, 5 puestos.',
    description: 'Sala modular en L con puf, tejida a mano en fibra color miel. Cojines en lino incluidos.',
    material: 'Fibra sintética',
    finish: 'Tejido color miel',
    featured: true,
    position: 1,
    variants: [
      {
        sku: 'SEP-5P-MIEL',
        name: 'Modular en L - 5 puestos',
        price: 4800000,
        seats: 5,
        widthCm: 260,
        heightCm: 75,
        depthCm: 160,
        isDefault: true,
      },
    ],
    photoDir: 'salas-tejidas',
    photos: [{ file: 'salas-tejidas-01.webp', alt: 'Sala esquinera modular tejida en color miel, junto a un mural al fondo' }],
  },
  {
    name: 'Sala campestre Sevilla',
    slug: 'sala-campestre-sevilla',
    categorySlug: 'salas-rusticas',
    shortDescription: 'Estructura en madera maciza con cojinería gruesa, 6 puestos.',
    description: 'Sala campestre con estructura en madera maciza y cojinería gruesa desenfundable. Acabado natural encerado.',
    material: 'Madera maciza',
    finish: 'Encerado natural',
    featured: false,
    position: 2,
    twinSlug: 'sala-guadalajara',
    variants: [
      {
        sku: 'SCS-6P-NAT',
        name: 'Madera maciza - 6 puestos',
        price: 5200000,
        seats: 6,
        widthCm: 300,
        heightCm: 80,
        depthCm: 170,
        isDefault: true,
      },
    ],
    photoDir: 'salas-rusticas',
    photos: [{ file: 'salas-rusticas-01.webp', alt: 'Sala campestre en madera maciza con cojines claros, en interior del local' }],
  },
  {
    name: 'Comedor Roldanillo',
    slug: 'comedor-roldanillo',
    categorySlug: 'comedores-tejidos',
    shortDescription: 'Redondo, 6 puestos, tejido sol en la cubierta.',
    description: 'Comedor redondo con cubierta tejida en patrón sol, base en madera.',
    material: 'Fibra natural y madera',
    finish: 'Tejido sol',
    featured: true,
    position: 0,
    twinSlug: 'comedor-sevilla',
    spaceNote: 'Para correr las sillas cómodamente, deja 90 cm libres alrededor de la mesa.',
    variants: [
      {
        sku: 'CR-RED-6P',
        name: 'Redondo tejido sol - 6 puestos',
        price: 3900000,
        seats: 6,
        widthCm: 140,
        heightCm: 76,
        depthCm: 140,
        isDefault: true,
      },
    ],
    photoDir: 'comedores-tejidos',
    photos: [{ file: 'comedores-tejidos-01.webp', alt: 'Comedor tejido redondo en un parque, señal de pare al fondo' }],
  },
  {
    name: 'Comedor Sevilla',
    slug: 'comedor-sevilla',
    categorySlug: 'comedores-rusticos',
    shortDescription: 'Madera maciza, 8 puestos, se fabrica a la medida.',
    description:
      'Comedor en madera maciza con tapa de una sola pieza. Se fabrica a la medida: ' +
      'define el largo, el número de puestos y el tipo de sillas.',
    material: 'Madera maciza (cedro)',
    finish: 'Sellado mate',
    personalizable: true,
    customizationNotes: 'Largo de la mesa, número de puestos, sillas tejidas o en madera.',
    customizationFields: [
      { label: 'Número de puestos', type: 'number', min: 4, max: 12, required: true },
      { label: 'Largo de la mesa', type: 'number', unit: 'cm', min: 120, max: 350, hint: 'Para 8 puestos: unos 240 cm' },
      { label: 'Tipo de sillas', type: 'select', options: ['Tejidas', 'En madera'], required: true },
      { label: '¿Incluir banca en un lado?', type: 'boolean' },
    ],
    featured: true,
    position: 1,
    twinSlug: 'comedor-roldanillo',
    spaceNote: 'Para correr las sillas cómodamente, deja 90 cm libres alrededor de la mesa.',
    variants: [
      { sku: 'CS-8P-CEDRO', name: 'Madera maciza - 8 puestos', seats: 8, isDefault: true },
    ],
    photoDir: 'comedores-rusticos',
    photos: [
      { file: 'comedores-rusticos-01.webp', alt: 'Comedor en madera maciza para 8 puestos, exhibido en el andén con carros al fondo' },
    ],
  },
  {
    name: 'Mecedora Buga',
    slug: 'mecedora-buga',
    categorySlug: 'mecedoras-tejidas',
    shortDescription: 'Tejido en mimbre con cojín en lino.',
    description: 'Mecedora tejida a mano en mimbre, con cojín en lino incluido.',
    material: 'Mimbre',
    finish: 'Natural',
    customizationFields: [
      { label: 'Color del cojín', type: 'select', options: ['Lino crudo', 'Verde oliva', 'Terracota'] },
    ],
    featured: true,
    position: 0,
    twinSlug: 'mecedora-palmira',
    spaceNote: 'Al mecerse necesita 20 cm libres por detrás. Cuenta 90 cm de pared.',
    variants: [
      {
        sku: 'MB-MIM-LIN',
        name: 'Tejido mimbre - cojín lino',
        price: 1150000,
        fabric: 'Mimbre',
        colorName: 'Natural',
        widthCm: 70,
        heightCm: 105,
        depthCm: 90,
        seatHeightCm: 44,
        isDefault: true,
      },
    ],
    photoDir: 'mesedoras',
    photos: [
      { file: 'mesedoras-01.webp', alt: 'Mecedora tejida en mimbre en un andén, parqueadero al fondo' },
      { file: 'mesedoras-02.webp', alt: 'Mecedora tejida frente a la vitrina del local' },
    ],
  },
  {
    name: 'Mecedora Palmira',
    slug: 'mecedora-palmira',
    categorySlug: 'mecedoras-de-madera',
    shortDescription: 'Madera de sajo curada, con brazos anchos.',
    description: 'Mecedora clásica en madera de sajo curada, con brazos anchos y espaldar alto. Acabado natural.',
    material: 'Madera de sajo',
    finish: 'Natural',
    featured: true,
    position: 1,
    twinSlug: 'mecedora-buga',
    spaceNote: 'Al mecerse necesita 20 cm libres por detrás. Cuenta 90 cm de pared.',
    variants: [
      {
        sku: 'MP-SAJO-NAT',
        name: 'Madera de sajo - natural',
        price: 890000,
        colorName: 'Natural',
        widthCm: 66,
        heightCm: 108,
        depthCm: 95,
        seatHeightCm: 42,
        isDefault: true,
      },
    ],
    photoDir: 'mesedoras',
    photos: [{ file: 'mesedoras-03.webp', alt: 'Mecedora en madera con brazos anchos, exhibida en el andén del local' }],
  },
  {
    name: 'Butaco Cartago',
    slug: 'butaco-cartago',
    categorySlug: 'butacos-tejidos',
    shortDescription: 'Asiento tejido sobre base en madera, dos alturas.',
    description: 'Butaco con asiento tejido a mano sobre base en madera torneada. Disponible en dos alturas.',
    material: 'Fibra natural y madera',
    finish: 'Tejido natural',
    featured: false,
    position: 0,
    variants: [
      {
        sku: 'BC-45-NAT',
        name: 'Altura barra baja - 45 cm',
        price: 320000,
        sizeLabel: 'Barra baja',
        widthCm: 35,
        heightCm: 45,
        depthCm: 35,
        isDefault: true,
      },
      {
        sku: 'BC-65-NAT',
        name: 'Altura barra alta - 65 cm',
        price: 380000,
        sizeLabel: 'Barra alta',
        widthCm: 35,
        heightCm: 65,
        depthCm: 35,
      },
    ],
    photoDir: 'butacos',
    photos: [{ file: 'butacos-01.webp', alt: 'Butacos con asiento tejido y base en madera, sobre el andén del local' }],
  },
  {
    name: 'Cama flotante Cañasgordas',
    slug: 'cama-flotante-canasgordas',
    categorySlug: 'camas',
    shortDescription: 'Cabecero en madera maciza sobre base flotante, doble.',
    description:
      'Cama con cabecero en madera maciza y base flotante, que deja el piso libre y hace ver '
      + 'la alcoba más amplia. Se fabrica a la medida del colchón que ya tienes.',
    material: 'Madera maciza',
    finish: 'Sellado mate',
    personalizable: true,
    customizationNotes: 'Ancho del colchón, alto del cabecero, acabado de la madera.',
    customizationFields: [
      { label: 'Ancho del colchón', type: 'number', unit: 'cm', min: 100, max: 200, required: true, hint: 'Doble: 140 cm. Queen: 160 cm' },
      { label: 'Alto del cabecero', type: 'number', unit: 'cm', min: 80, max: 140 },
      { label: 'Acabado', type: 'select', options: ['Natural', 'Miel', 'Nogal'], required: true },
    ],
    featured: true,
    position: 0,
    spaceNote: 'Deja 60 cm libres a cada lado para pasar sin rozar la base.',
    variants: [
      {
        sku: 'CFC-160-MAC',
        name: 'Base flotante - 160 cm',
        widthCm: 160,
        heightCm: 110,
        depthCm: 200,
        isDefault: true,
      },
    ],
    photoDir: 'camas',
    photos: [
      { file: 'camas-01.webp', alt: 'Cama con cabecero en madera maciza y base flotante, en la alcoba' },
      { file: 'camas-02.webp', alt: 'Detalle del cabecero en madera maciza de la cama flotante' },
    ],
  },
  {
    name: 'Lámpara Guacarí',
    slug: 'lampara-guacari',
    categorySlug: 'lamparas-tejidas',
    shortDescription: 'Pantalla colgante tejida en fibra natural, 45 cm.',
    description: 'Lámpara colgante con pantalla tejida a mano en fibra natural. Incluye roseta y 1 m de cable textil.',
    material: 'Fibra natural',
    finish: 'Natural',
    featured: true,
    position: 0,
    variants: [
      {
        sku: 'LG-45-NAT',
        name: 'Pantalla 45 cm - natural',
        price: 240000,
        widthCm: 45,
        heightCm: 35,
        depthCm: 45,
        isDefault: true,
      },
    ],
    photoDir: 'lamparas-tejidas',
    photos: [{ file: 'lamparas-tejidas-01.webp', alt: 'Lámpara colgante tejida en fibra natural, colgada en el taller' }],
  },
  {
    name: 'Espejo Sol de Buga',
    slug: 'espejo-sol-de-buga',
    categorySlug: 'espejos-tejidos',
    shortDescription: 'Marco tejido en rayos, 80 cm de diámetro.',
    description: 'Espejo redondo con marco tejido a mano en patrón de rayos de sol. 80 cm de diámetro.',
    material: 'Fibra natural',
    finish: 'Natural',
    featured: true,
    position: 0,
    variants: [
      {
        sku: 'ESB-80-NAT',
        name: 'Diámetro 80 cm - natural',
        price: 180000,
        widthCm: 80,
        heightCm: 80,
        depthCm: 4,
        isDefault: true,
      },
    ],
    photoDir: 'espejos-tejidos',
    photos: [{ file: 'espejos-tejidos-01.webp', alt: 'Espejo redondo con marco tejido en rayos de sol, sobre fondo claro' }],
  },
];

async function seed() {
  await connectDb();

  console.log('[seed] Creando arbol de categorias...');
  const slugToId = new Map<string, string>();
  for (let i = 0; i < CATEGORY_TREE.length; i++) {
    const map = await upsertCategory(CATEGORY_TREE[i], null, i);
    for (const [s, id] of map) slugToId.set(s, id);
  }
  console.log(`[seed] ${slugToId.size} categorias listas.`);

  console.log('[seed] Creando productos de ejemplo...');
  for (const p of PRODUCTS) {
    const categoryId = slugToId.get(p.categorySlug);
    if (!categoryId) throw new Error(`Categoria "${p.categorySlug}" no existe en el arbol.`);

    // Se usa save() (no findOneAndUpdate) a proposito: el hook pre('validate') de
    // product.model.ts recalcula los campos denormalizados (hasPrice, priceFrom,
    // primaryImageUrl, colorNames) de los que depende TODO el listado del catalogo, y
    // ese hook no corre en un update de query.
    const doc = (await Product.findOne({ slug: p.slug })) ?? new Product();
    doc.set({
      name: p.name,
      slug: p.slug,
      shortDescription: p.shortDescription,
      description: p.description,
      material: p.material,
      finish: p.finish,
      spaceNote: p.spaceNote,
      status: 'MADE_TO_ORDER',
      personalizable: p.personalizable ?? false,
      customizationNotes: p.customizationNotes,
      customizationFields: (p.customizationFields ?? []).map((f, i) => ({ ...f, position: i })),
      featured: p.featured ?? false,
      position: p.position ?? 0,
      active: true,
      category: categoryId,
      variants: p.variants.map((v, i) => ({ ...v, position: i, active: true })),
      images: p.photos.map((ph, i) => ({
        url: fotoUrl(p.photoDir, ph.file),
        alt: ph.alt,
        isPrimary: i === 0,
        position: i,
      })),
    });
    await doc.save();
  }

  // Segunda pasada: la pieza gemela se engancha cuando ya existen los dos productos.
  // updateOne y no save() a proposito: solo toca un ref, no hay denormalizado que
  // recalcular, y asi no se reescribe el documento entero.
  console.log('[seed] Enganchando las piezas gemelas...');
  const idBySlug = new Map<string, unknown>();
  for (const doc of await Product.find({}).select('slug').lean()) {
    idBySlug.set(doc.slug, doc._id);
  }
  let twins = 0;
  for (const p of PRODUCTS) {
    if (!p.twinSlug) continue;
    const twinId = idBySlug.get(p.twinSlug);
    if (!twinId) throw new Error(`La gemela "${p.twinSlug}" de "${p.slug}" no existe.`);
    await Product.updateOne({ slug: p.slug }, { $set: { twinProduct: twinId } });
    twins++;
  }
  console.log(`[seed] ${twins} enlaces tejido/madera listos.`);

  const personalizables = PRODUCTS.filter((p) => p.personalizable).map((p) => p.name);
  console.log(
    `[seed] ${PRODUCTS.length} productos listos (sin precio: ${personalizables.join(', ')}).`,
  );
  await disconnectDb();
  console.log('[seed] Listo.');
}

seed().catch((err) => {
  console.error('[seed] Fallo:', err);
  process.exit(1);
});
