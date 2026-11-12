import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { z } from "zod";
import { pool } from "@workspace/db";
import { loadStore } from "../lib/catalog";

const router: IRouter = Router();

const orderSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().min(3),
  city: z.string().trim().min(1),
  note: z.string().trim().default(""),
  lines: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1),
});

router.get("/store", async (_req, res) => {
  const store = await loadStore();
  res.json({
    settings: { previewNotice: store.settings.previewNotice },
    home: store.home,
    categories: store.categories,
    products: store.products
      .filter((product) => product.published)
      .map((product) => ({
        ...product,
        images: product.images.map((image) => ({ url: image.published })),
      })),
  });
});

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(1).max(4000),
});

router.post("/contact-messages", async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Message incomplet" });
    return;
  }
  const id = randomUUID();
  await pool.query(
    "INSERT INTO contact_messages (id, name, email, message, status) VALUES ($1,$2,$3,$4,'new')",
    [id, parsed.data.name, parsed.data.email, parsed.data.message],
  );
  res.status(201).json({ id });
});

router.post("/order-requests", async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Demande incomplète" });
    return;
  }
  const store = await loadStore();
  const chosen = parsed.data.lines.flatMap((line) => {
    const product = store.products.find((item) => item.id === line.productId && item.published);
    if (!product) return [];
    return [{ product, quantity: line.quantity }];
  });
  if (!chosen.length) {
    res.status(400).json({ message: "Aucune pièce valide" });
    return;
  }
  const id = randomUUID();
  await pool.query(
    "INSERT INTO order_requests (id, name, email, phone, city, note, status) VALUES ($1,$2,$3,$4,$5,$6,'new')",
    [id, parsed.data.name, parsed.data.email, parsed.data.phone, parsed.data.city, parsed.data.note],
  );
  for (const line of chosen) {
    await pool.query(
      "INSERT INTO order_lines (id, request_id, product_id, title, quantity, unit_price) VALUES ($1,$2,$3,$4,$5,$6)",
      [randomUUID(), id, line.product.id, line.product.title.fr, line.quantity, line.product.price],
    );
  }
  res.status(201).json({ id });
});

export default router;
