import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "@workspace/db";
import { ensureUploadDirs, uploadRoot, writePlainImage, writeProductImages } from "./images";
import type { Corner } from "./images";

const localized = (fr: string, en: string, ar: string) => ({ fr, en, ar });

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id integer PRIMARY KEY,
      preview_notice boolean NOT NULL DEFAULT true,
      watermark_path text,
      watermark_corner text NOT NULL DEFAULT 'bottom-right',
      watermark_opacity real NOT NULL DEFAULT 0.72
    );
    CREATE TABLE IF NOT EXISTS home_content (
      id integer PRIMARY KEY,
      document jsonb NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id text PRIMARY KEY,
      parent_id text,
      slug text NOT NULL UNIQUE,
      name jsonb NOT NULL,
      sort_order integer NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS products (
      id text PRIMARY KEY,
      slug text NOT NULL UNIQUE,
      category_id text,
      price integer NOT NULL,
      published boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      tone text NOT NULL DEFAULT 'mineral',
      title jsonb NOT NULL,
      subtitle jsonb NOT NULL,
      description jsonb NOT NULL
    );
    CREATE TABLE IF NOT EXISTS product_images (
      id text PRIMARY KEY,
      product_id text NOT NULL,
      original_path text NOT NULL,
      public_path text NOT NULL,
      sort_order integer NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS order_requests (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL,
      phone text NOT NULL,
      city text NOT NULL,
      note text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'new',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS contact_messages (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL,
      message text NOT NULL,
      status text NOT NULL DEFAULT 'new',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS order_lines (
      id text PRIMARY KEY,
      request_id text NOT NULL,
      product_id text,
      title text NOT NULL,
      quantity integer NOT NULL,
      unit_price integer NOT NULL
    );
  `);
}

function assetDirs() {
  return [
    process.env.SEED_ASSETS,
    process.env.STATIC_DIR,
    path.resolve(process.cwd(), "artifacts/maroc-selenite-storefront/public"),
    path.resolve(process.cwd(), "public"),
  ].filter((value): value is string => Boolean(value));
}

async function seedAsset(name: string, folder: "home" | "originals") {
  for (const dir of assetDirs()) {
    try {
      const buffer = await readFile(path.join(dir, name));
      return writePlainImage(buffer, folder);
    } catch {
      continue;
    }
  }
  return "";
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(481516)");
    const existing = await client.query("SELECT id FROM settings WHERE id = 1");
    if (existing.rowCount) return;

    const bowl = await seedAsset("selenite-bowl.png", "originals");
    const atelier = await seedAsset("atelier-hero.png", "originals");
    const hero = await seedAsset("selenite-lifestyle-hero.png", "home");
    const tileBowl = await seedAsset("selenite-bowl.png", "home");
    const tileAtelier = await seedAsset("atelier-hero.png", "home");
    const editorial = await seedAsset("atelier-hero.png", "home");

    const categories = [
      ["selenite", null, "selenite", localized("Sélénite", "Selenite", "سيلينيت"), 1],
      ["vessels", null, "vessels", localized("Vases & coupes", "Vessels & bowls", "أوانٍ وأوعية"), 2],
      ["objects", null, "objects", localized("Objets décoratifs", "Decorative objects", "أغراض للزينة"), 3],
      ["sculptures", null, "sculptures", localized("Sculptures", "Sculptures", "منحوتات"), 4],
    ] as const;

    const products = [
      ["sel-bowl", "coupe-selenite", "selenite", 680, "mineral", localized("Coupe sélénite", "Selenite bowl", "وعاء سيلينيت"), localized("Minéral · pièce de démonstration", "Mineral · demonstration piece", "معدن · قطعة توضيحية"), localized("Une forme douce imaginée autour de la translucidité et des strates minérales.", "A quiet form imagined around translucency and mineral striations.", "شكل هادئ مستوحى من الشفافية والطبقات المعدنية."), bowl || atelier, 1],
      ["sel-tower", "forme-minerale", "selenite", 420, "sand", localized("Forme minérale", "Mineral form", "تشكيل معدني"), localized("Minéral · étude visuelle", "Mineral · visual study", "معدن · دراسة بصرية"), localized("Une silhouette sculpturale qui capte la lumière, présentée comme une étude de matière.", "A sculptural silhouette that catches the light, shown as a material study.", "هيئة نحتية تلتقط الضوء، معروضة كدراسة للمواد."), atelier || bowl, 2],
      ["vase-argile", "vase-argile", "vessels", 560, "clay", localized("Vase aux lignes libres", "Vase, free lines", "مزهرية بخطوط حرة"), localized("Objet de maison · illustration", "Home object · illustration", "غرض منزلي · رسم توضيحي"), localized("Un volume aux contours simples, imaginé dans une palette pierre et ivoire.", "A simple outlined volume, imagined in a palette of stone and ivory.", "حجم بخطوط بسيطة، متخيّل بألوان الحجر والعاج."), atelier || bowl, 3],
      ["bol-ivoire", "bol-ivoire", "vessels", 390, "ivory", localized("Bol ivoire", "Ivory bowl", "وعاء عاجي"), localized("Objet de maison · aperçu", "Home object · preview", "غرض منزلي · معاينة"), localized("Un objet de table aux courbes épurées, proposé ici comme aperçu éditorial.", "A tabletop object with pared-back curves, offered here as an editorial preview.", "غرض للطاولة بمنحنيات هادئة، معروض كمعاينة تحريرية."), bowl || atelier, 4],
      ["objet-ligne", "objet-ligne", "objects", 310, "stone", localized("Objet ligne", "Line object", "قطعة خطية"), localized("Objet décoratif · visuel généré", "Decorative object · generated visual", "غرض زخرفي · صورة مولّدة"), localized("Une composition abstraite autour de la ligne, du rythme et de la lumière.", "An abstract composition around line, rhythm and light.", "تكوين تجريدي حول الخط والإيقاع والضوء."), atelier || bowl, 5],
      ["sculpture-stele", "stele-minerale", "sculptures", 450, "navy", localized("Stèle minérale", "Mineral stele", "مسلة معدنية"), localized("Sculpture · étude visuelle", "Sculpture · visual study", "منحوتة · دراسة بصرية"), localized("Une étude imaginaire de hauteur, de ligne et de lumière, présentée uniquement comme aperçu.", "An imagined study in height, line and light, shown only as a preview.", "دراسة تخيلية للارتفاع والخط والضوء، معروضة للمعاينة فقط."), atelier || bowl, 6],
    ] as const;

    const storedImages: { productId: string; original: string; published: string }[] = [];
    for (const product of products) {
      const source = product[8];
      if (!source) continue;
      const stored = await writeProductImages(await readFile(path.join(uploadRoot(), source)), null, "bottom-right", 0.72);
      storedImages.push({ productId: product[0], original: stored.original, published: stored.published });
    }

    const home = {
      announcement: localized(
        "Aperçu de la boutique — contenus, visuels et prix présentés à titre illustratif. Aucun stock ni offre réelle n’est confirmé.",
        "Store preview — content, imagery and prices are illustrative. No stock or real offer is confirmed.",
        "معاينة المتجر — المحتوى والصور والأسعار توضيحية. لا يوجد مخزون أو عرض حقيقي مؤكد.",
      ),
      heroKicker: localized("MARRAKECH · OBJETS & MATIÈRES", "MARRAKECH · OBJECTS & MATERIALS", "مراكش · أغراض ومواد"),
      heroTitle: localized("La lumière,\nen matière.", "Light,\nmade tangible.", "السيلينيت،\nفي الضوء."),
      heroIntro: localized(
        "Objets de maison et minéraux choisis pour leur présence, leur texture et leur calme.",
        "Home objects and minerals selected for their presence, texture and quiet.",
        "قطع منزلية ومعادن مختارة لحضورها وملمسها وهدوئها.",
      ),
      heroImage: hero ? `/uploads/${hero}` : "/selenite-lifestyle-hero.png",
      tiles: [
        { label: localized("MATIÈRES", "MATERIALS", "مواد"), title: localized("Minéraux & matières", "Minerals & materials", "معادن ومواد"), image: tileBowl ? `/uploads/${tileBowl}` : "/selenite-bowl.png", href: "/collections/selenite" },
        { label: localized("MAISON", "HOME", "المنزل"), title: localized("Objets de maison", "Objects for home", "أغراض للمنزل"), image: tileAtelier ? `/uploads/${tileAtelier}` : "/atelier-hero.png", href: "/collections/maison" },
        { label: localized("SCULPTURES", "SCULPTURE", "منحوتات"), title: localized("Formes sculptées", "Sculptural forms", "أشكال منحوتة"), image: editorial ? `/uploads/${editorial}` : "/atelier-hero.png", href: "/collections/sculptures" },
      ],
      editorialKicker: localized("MAROC SÉLÉNITE · NOTE 01", "MAROC SÉLÉNITE · NOTE 01", "ماروك سيلينيت · ملاحظة 01"),
      editorialTitle: localized("Une invitation à regarder autrement", "An invitation to look again", "دعوة إلى النظر من جديد"),
      editorialText: localized(
        "Textures naturelles, lignes sobres, lumière changeante. Une proposition éditoriale autour de la maison et des matières — conçue comme un premier regard.",
        "Natural textures, unhurried lines, shifting light. An editorial thought about home and material — offered as a first glimpse.",
        "ملامس طبيعية وخطوط هادئة وضوء متغير. تصور تحريري للمنزل والمواد — لمحة أولى فحسب.",
      ),
      editorialImage: editorial ? `/uploads/${editorial}` : "/atelier-hero.png",
      featuredProductIds: ["sel-bowl", "sel-tower", "vase-argile", "bol-ivoire"],
    };

    await client.query("BEGIN");
    for (const [id, parent, slug, name, sort] of categories) {
      await client.query(
        "INSERT INTO categories (id, parent_id, slug, name, sort_order) VALUES ($1, $2, $3, $4, $5)",
        [id, parent, slug, JSON.stringify(name), sort],
      );
    }
    for (const product of products) {
      const [id, slug, categoryId, price, tone, title, subtitle, description, , sort] = product;
      await client.query(
        `INSERT INTO products (id, slug, category_id, price, published, sort_order, tone, title, subtitle, description)
         VALUES ($1,$2,$3,$4,true,$5,$6,$7,$8,$9)`,
        [id, slug, categoryId, price, sort, tone, JSON.stringify(title), JSON.stringify(subtitle), JSON.stringify(description)],
      );
    }
    for (const image of storedImages) {
      await client.query(
        "INSERT INTO product_images (id, product_id, original_path, public_path, sort_order) VALUES ($1,$2,$3,$4,0)",
        [randomUUID(), image.productId, image.original, image.published],
      );
    }
    await client.query("INSERT INTO home_content (id, document) VALUES (1, $1)", [JSON.stringify(home)]);
    await client.query(
      "INSERT INTO settings (id, preview_notice, watermark_path, watermark_corner, watermark_opacity) VALUES (1, true, NULL, 'bottom-right', 0.72)",
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.query("SELECT pg_advisory_unlock(481516)").catch(() => undefined);
    client.release();
  }
}

export async function bootstrap() {
  await ensureUploadDirs();
  await ensureSchema();
  await seed();
}

export async function rebuildWatermarks(watermarkPath: string | null, corner: Corner, opacity: number) {
  const images = await pool.query("SELECT original_path, public_path FROM product_images");
  const { renderPublic } = await import("./images");
  for (const image of images.rows) {
    await renderPublic(
      path.join(uploadRoot(), image.original_path as string),
      image.public_path as string,
      watermarkPath,
      corner,
      opacity,
    );
  }
}
