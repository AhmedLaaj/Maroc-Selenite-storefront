import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { z } from "zod";
import { pool } from "@workspace/db";
import { clearAdminCookie, passwordsMatch, requireAdmin, setAdminCookie } from "../lib/auth";
import { loadMessages, loadOrders, loadStore } from "../lib/catalog";
import { publicUrl, readUpload, writePlainImage, writeProductImages } from "../lib/images";
import { rebuildWatermarks } from "../lib/bootstrap";

const router: IRouter = Router();
const localized = z.object({ fr: z.string(), en: z.string(), ar: z.string() });
const corners = z.enum(["bottom-right", "bottom-left", "top-right", "top-left", "center"]);

router.post("/login", (req, res) => {
  if (!process.env.ADMIN_PASSWORD) {
    res.status(503).json({ message: "ADMIN_PASSWORD n'est pas défini" });
    return;
  }
  const password = z.object({ password: z.string() }).safeParse(req.body);
  if (!password.success || !passwordsMatch(password.data.password)) {
    res.status(401).json({ message: "Mot de passe incorrect" });
    return;
  }
  setAdminCookie(res);
  res.json({ ok: true });
});

router.post("/logout", (_req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

router.use(requireAdmin);

router.get("/session", (_req, res) => {
  res.json({ ok: true });
});

router.get("/store", async (_req, res) => {
  res.json(await loadStore());
});

router.put("/settings", async (req, res) => {
  const parsed = z.object({
    previewNotice: z.boolean(),
    watermarkCorner: corners,
    watermarkOpacity: z.number().min(0.15).max(1),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Réglages invalides" });
    return;
  }
  await pool.query(
    "UPDATE settings SET preview_notice = $1, watermark_corner = $2, watermark_opacity = $3 WHERE id = 1",
    [parsed.data.previewNotice, parsed.data.watermarkCorner, parsed.data.watermarkOpacity],
  );
  const current = await pool.query("SELECT watermark_path FROM settings WHERE id = 1");
  await rebuildWatermarks(current.rows[0]?.watermark_path || null, parsed.data.watermarkCorner, parsed.data.watermarkOpacity);
  res.json(await loadStore());
});

router.put("/home", async (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    res.status(400).json({ message: "Page d'accueil invalide" });
    return;
  }
  await pool.query("UPDATE home_content SET document = $1 WHERE id = 1", [JSON.stringify(req.body)]);
  res.json((await loadStore()).home);
});

router.post("/media", async (req, res) => {
  try {
    const file = await readUpload(req);
    const relative = await writePlainImage(file.buffer, "home");
    res.status(201).json({ url: publicUrl(relative) });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Téléversement impossible" });
  }
});

router.post("/watermark", async (req, res) => {
  try {
    const file = await readUpload(req);
    const relative = await writePlainImage(file.buffer, "brand");
    const settings = await pool.query("SELECT watermark_corner, watermark_opacity FROM settings WHERE id = 1");
    await pool.query("UPDATE settings SET watermark_path = $1 WHERE id = 1", [relative]);
    await rebuildWatermarks(relative, settings.rows[0].watermark_corner, Number(settings.rows[0].watermark_opacity));
    res.json(await loadStore());
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Filigrane impossible" });
  }
});

router.post("/categories", async (req, res) => {
  const parsed = z.object({
    parentId: z.string().nullable().optional(),
    slug: z.string().trim().min(1),
    name: localized,
    sortOrder: z.number().int().default(0),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Catégorie invalide" });
    return;
  }
  const id = randomUUID();
  await pool.query(
    "INSERT INTO categories (id, parent_id, slug, name, sort_order) VALUES ($1,$2,$3,$4,$5)",
    [id, parsed.data.parentId || null, parsed.data.slug, JSON.stringify(parsed.data.name), parsed.data.sortOrder],
  );
  res.status(201).json({ id });
});

router.put("/categories/:id", async (req, res) => {
  const parsed = z.object({
    parentId: z.string().nullable().optional(),
    slug: z.string().trim().min(1),
    name: localized,
    sortOrder: z.number().int(),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Catégorie invalide" });
    return;
  }
  if (parsed.data.parentId === req.params.id) {
    res.status(400).json({ message: "Une catégorie ne peut pas être son propre parent" });
    return;
  }
  await pool.query(
    "UPDATE categories SET parent_id = $1, slug = $2, name = $3, sort_order = $4 WHERE id = $5",
    [parsed.data.parentId || null, parsed.data.slug, JSON.stringify(parsed.data.name), parsed.data.sortOrder, req.params.id],
  );
  res.json({ ok: true });
});

router.delete("/categories/:id", async (req, res) => {
  await pool.query("UPDATE categories SET parent_id = NULL WHERE parent_id = $1", [req.params.id]);
  await pool.query("UPDATE products SET category_id = NULL WHERE category_id = $1", [req.params.id]);
  await pool.query("DELETE FROM categories WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

const productBody = z.object({
  slug: z.string().trim().min(1),
  categoryId: z.string().nullable().optional(),
  price: z.number().int().nonnegative(),
  published: z.boolean(),
  sortOrder: z.number().int().default(0),
  tone: z.string().default("mineral"),
  title: localized,
  subtitle: localized,
  description: localized,
});

router.post("/products", async (req, res) => {
  const parsed = productBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Produit invalide" });
    return;
  }
  const id = randomUUID();
  const data = parsed.data;
  await pool.query(
    `INSERT INTO products (id, slug, category_id, price, published, sort_order, tone, title, subtitle, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, data.slug, data.categoryId || null, data.price, data.published, data.sortOrder, data.tone, JSON.stringify(data.title), JSON.stringify(data.subtitle), JSON.stringify(data.description)],
  );
  res.status(201).json({ id });
});

router.put("/products/:id", async (req, res) => {
  const parsed = productBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Produit invalide" });
    return;
  }
  const data = parsed.data;
  await pool.query(
    `UPDATE products SET slug=$1, category_id=$2, price=$3, published=$4, sort_order=$5, tone=$6, title=$7, subtitle=$8, description=$9 WHERE id=$10`,
    [data.slug, data.categoryId || null, data.price, data.published, data.sortOrder, data.tone, JSON.stringify(data.title), JSON.stringify(data.subtitle), JSON.stringify(data.description), req.params.id],
  );
  res.json({ ok: true });
});

router.delete("/products/:id", async (req, res) => {
  await pool.query("DELETE FROM product_images WHERE product_id = $1", [req.params.id]);
  await pool.query("DELETE FROM products WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

router.post("/products/:id/images", async (req, res) => {
  try {
    const file = await readUpload(req);
    const settings = await pool.query("SELECT watermark_path, watermark_corner, watermark_opacity FROM settings WHERE id = 1");
    const stored = await writeProductImages(
      file.buffer,
      settings.rows[0]?.watermark_path || null,
      settings.rows[0]?.watermark_corner || "bottom-right",
      Number(settings.rows[0]?.watermark_opacity ?? 0.72),
    );
    const id = randomUUID();
    await pool.query(
      "INSERT INTO product_images (id, product_id, original_path, public_path, sort_order) VALUES ($1,$2,$3,$4,0)",
      [id, req.params.id, stored.original, stored.published],
    );
    res.status(201).json({ id, url: publicUrl(stored.published) });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Image impossible" });
  }
});

router.delete("/images/:id", async (req, res) => {
  await pool.query("DELETE FROM product_images WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

router.get("/orders", async (_req, res) => {
  res.json(await loadOrders());
});

router.get("/messages", async (_req, res) => {
  res.json(await loadMessages());
});

router.patch("/messages/:id", async (req, res) => {
  const parsed = z.object({ status: z.enum(["new", "contacted", "closed"]) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Statut invalide" });
    return;
  }
  await pool.query("UPDATE contact_messages SET status = $1 WHERE id = $2", [parsed.data.status, req.params.id]);
  res.json({ ok: true });
});

router.patch("/orders/:id", async (req, res) => {
  const parsed = z.object({ status: z.enum(["new", "contacted", "closed"]) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Statut invalide" });
    return;
  }
  await pool.query("UPDATE order_requests SET status = $1 WHERE id = $2", [parsed.data.status, req.params.id]);
  res.json({ ok: true });
});

export default router;
