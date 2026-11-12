import { pool } from "@workspace/db";
import { publicUrl } from "./images";

type Localized = { fr: string; en: string; ar: string };

function text(value: unknown): Localized {
  const record = (value && typeof value === "object" ? value : {}) as Partial<Localized>;
  return { fr: record.fr || "", en: record.en || "", ar: record.ar || "" };
}

export async function loadStore() {
  const [settings, home, categories, products, images] = await Promise.all([
    pool.query("SELECT * FROM settings WHERE id = 1"),
    pool.query("SELECT document FROM home_content WHERE id = 1"),
    pool.query("SELECT * FROM categories ORDER BY sort_order, slug"),
    pool.query("SELECT * FROM products ORDER BY sort_order, slug"),
    pool.query("SELECT * FROM product_images ORDER BY sort_order"),
  ]);
  const setting = settings.rows[0];
  const imageByProduct = new Map<string, { id: string; original: string; published: string }[]>();
  for (const image of images.rows) {
    const list = imageByProduct.get(image.product_id) || [];
    list.push({
      id: image.id as string,
      original: publicUrl(image.original_path),
      published: publicUrl(image.public_path),
    });
    imageByProduct.set(image.product_id, list);
  }
  return {
    settings: {
      previewNotice: Boolean(setting?.preview_notice),
      watermarkUrl: setting?.watermark_path ? publicUrl(setting.watermark_path) : null,
      watermarkCorner: setting?.watermark_corner || "bottom-right",
      watermarkOpacity: Number(setting?.watermark_opacity ?? 0.72),
    },
    home: home.rows[0]?.document ?? null,
    categories: categories.rows.map((row) => ({
      id: row.id,
      parentId: row.parent_id,
      slug: row.slug,
      name: text(row.name),
      sortOrder: row.sort_order,
    })),
    products: products.rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      categoryId: row.category_id,
      price: row.price,
      published: row.published,
      sortOrder: row.sort_order,
      tone: row.tone,
      title: text(row.title),
      subtitle: text(row.subtitle),
      description: text(row.description),
      images: imageByProduct.get(row.id) || [],
    })),
  };
}

export async function loadMessages() {
  const messages = await pool.query("SELECT * FROM contact_messages ORDER BY created_at DESC");
  return messages.rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function loadOrders() {
  const requests = await pool.query("SELECT * FROM order_requests ORDER BY created_at DESC");
  const lines = await pool.query("SELECT * FROM order_lines");
  return requests.rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    city: row.city,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
    lines: lines.rows
      .filter((line) => line.request_id === row.id)
      .map((line) => ({
        id: line.id,
        productId: line.product_id,
        title: line.title,
        quantity: line.quantity,
        unitPrice: line.unit_price,
      })),
  }));
}
