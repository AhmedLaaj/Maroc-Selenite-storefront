import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const COOKIE = "maroc_admin";
const WEEK = 60 * 60 * 24 * 7;

function secret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "maroc-dev-session";
}

function sign(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function readAdmin(req: Request) {
  const raw = req.cookies?.[COOKIE];
  if (typeof raw !== "string" || !raw.includes(".")) return false;
  const [body, mac] = raw.split(".");
  if (!body || !mac) return false;
  const expected = sign(body);
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function setAdminCookie(res: Response) {
  const body = Buffer.from(JSON.stringify({ exp: Date.now() + WEEK * 1000, role: "admin" })).toString("base64url");
  const token = `${body}.${sign(body)}`;
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: WEEK * 1000,
  });
}

export function clearAdminCookie(res: Response) {
  res.clearCookie(COOKIE, { path: "/" });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!readAdmin(req)) {
    res.status(401).json({ message: "Connexion requise" });
    return;
  }
  next();
}

export function passwordsMatch(input: string) {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) return false;
  const left = Buffer.from(input);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
