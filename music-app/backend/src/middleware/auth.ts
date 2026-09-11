import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";
import { prisma } from "../db.js";

interface SessionPayload {
  userId: string;
  telegramId: string;
  isAdmin: boolean;
  exp: number;
}

function sign(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", config.jwtSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function createSessionToken(userId: string, telegramId: string, isAdmin: boolean): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 30 days
  return sign({ userId, telegramId, isAdmin, exp });
}

function verify(token: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expectedSig = createHmac("sha256", config.jwtSecret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: { id: string; telegramId: string; isAdmin: boolean };
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const payload = token ? verify(token) : null;
  if (!payload) {
    reply.code(401).send({ error: "unauthorized" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.isBlocked) {
    reply.code(401).send({ error: "unauthorized" });
    return;
  }
  req.currentUser = { id: user.id, telegramId: user.telegramId, isAdmin: user.isAdmin };
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(req, reply);
  if (reply.sent) return;
  if (!req.currentUser?.isAdmin) {
    reply.code(403).send({ error: "forbidden" });
  }
}
