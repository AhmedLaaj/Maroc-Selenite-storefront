import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Busboy from "busboy";
import type { Request } from "express";
import sharp from "sharp";

export type Corner = "bottom-right" | "bottom-left" | "top-right" | "top-left" | "center";

const GRAVITY: Record<Corner, string> = {
  "bottom-right": "southeast",
  "bottom-left": "southwest",
  "top-right": "northeast",
  "top-left": "northwest",
  center: "centre",
};

export function uploadRoot() {
  return process.env.UPLOAD_DIR || path.resolve(process.cwd(), "data", "uploads");
}

export async function ensureUploadDirs() {
  for (const folder of ["originals", "public", "home", "brand"]) {
    await mkdir(path.join(uploadRoot(), folder), { recursive: true });
  }
}

export function publicUrl(relativePath: string) {
  return `/uploads/${relativePath.replace(/^\/+/, "")}`;
}

export function readUpload(req: Request): Promise<{ buffer: Buffer; filename: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers, limits: { files: 1, fileSize: 8 * 1024 * 1024 } });
    const chunks: Buffer[] = [];
    let filename = "image";
    let mime = "application/octet-stream";
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    busboy.on("file", (_name, file, info) => {
      filename = info.filename || filename;
      mime = info.mimeType || mime;
      file.on("data", (chunk) => chunks.push(chunk as Buffer));
      file.on("limit", () => fail(new Error("Fichier trop volumineux")));
    });
    busboy.on("error", fail);
    busboy.on("finish", () => {
      if (settled) return;
      settled = true;
      if (!chunks.length) {
        reject(new Error("Aucun fichier"));
        return;
      }
      resolve({ buffer: Buffer.concat(chunks), filename, mime });
    });
    req.pipe(busboy);
  });
}

async function fade(input: Buffer, opacity: number) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  for (let index = 3; index < pixels.length; index += 4) {
    pixels[index] = Math.round(pixels[index]! * opacity);
  }
  return sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

export async function writePlainImage(buffer: Buffer, folder: "home" | "brand" | "originals") {
  const id = randomUUID();
  const relative = `${folder}/${id}.png`;
  await sharp(buffer).rotate().png().toFile(path.join(uploadRoot(), relative));
  return relative;
}

export async function writeProductImages(
  buffer: Buffer,
  watermarkPath: string | null,
  corner: Corner,
  opacity: number,
) {
  const id = randomUUID();
  const original = `originals/${id}.png`;
  const published = `public/${id}.jpg`;
  const originalFile = path.join(uploadRoot(), original);
  await sharp(buffer).rotate().png().toFile(originalFile);
  await renderPublic(originalFile, published, watermarkPath, corner, opacity);
  return { original, published };
}

export async function renderPublic(
  originalFile: string,
  publishedRelative: string,
  watermarkPath: string | null,
  corner: Corner,
  opacity: number,
) {
  const destination = path.join(uploadRoot(), publishedRelative);
  await mkdir(path.dirname(destination), { recursive: true });
  const meta = await sharp(originalFile).rotate().metadata();
  let image = sharp(originalFile).rotate();
  if (watermarkPath) {
    const width = meta.width || 1200;
    const mark = await fade(
      await sharp(path.join(uploadRoot(), watermarkPath)).resize({ width: Math.max(80, Math.round(width * 0.28)) }).png().toBuffer(),
      Math.min(1, Math.max(0.15, opacity)),
    );
    image = image.composite([{ input: mark, gravity: GRAVITY[corner] || "southeast" }]);
  }
  await image.jpeg({ quality: 86 }).toFile(destination);
}

export async function fileExists(relativePath: string) {
  try {
    await readFile(path.join(uploadRoot(), relativePath));
    return true;
  } catch {
    return false;
  }
}

export async function copySeedAsset(source: string, folder: "home" | "originals") {
  const buffer = await readFile(source);
  return writePlainImage(buffer, folder);
}
