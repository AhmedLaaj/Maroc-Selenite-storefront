import { boolean, integer, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";

export type Localized = { fr: string; en: string; ar: string };

export const settingsTable = pgTable("settings", {
  id: integer("id").primaryKey(),
  previewNotice: boolean("preview_notice").notNull().default(true),
  watermarkPath: text("watermark_path"),
  watermarkCorner: text("watermark_corner").notNull().default("bottom-right"),
  watermarkOpacity: real("watermark_opacity").notNull().default(0.72),
});

export const homeContentTable = pgTable("home_content", {
  id: integer("id").primaryKey(),
  document: jsonb("document").notNull(),
});

export const categoriesTable = pgTable("categories", {
  id: text("id").primaryKey(),
  parentId: text("parent_id"),
  slug: text("slug").notNull().unique(),
  name: jsonb("name").$type<Localized>().notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const productsTable = pgTable("products", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  categoryId: text("category_id"),
  price: integer("price").notNull(),
  published: boolean("published").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  tone: text("tone").notNull().default("mineral"),
  title: jsonb("title").$type<Localized>().notNull(),
  subtitle: jsonb("subtitle").$type<Localized>().notNull(),
  description: jsonb("description").$type<Localized>().notNull(),
});

export const productImagesTable = pgTable("product_images", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  originalPath: text("original_path").notNull(),
  publicPath: text("public_path").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const orderRequestsTable = pgTable("order_requests", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  city: text("city").notNull(),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contactMessagesTable = pgTable("contact_messages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderLinesTable = pgTable("order_lines", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull(),
  productId: text("product_id"),
  title: text("title").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
});
