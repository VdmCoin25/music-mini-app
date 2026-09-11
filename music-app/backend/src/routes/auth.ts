import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { validateTelegramInitData, shortHash } from "../auth/telegramAuth.js";
import { createSessionToken } from "../middleware/auth.js";
import { prisma } from "../db.js";
import { config } from "../config.js";

const loginSchema = z.object({ initData: z.string().min(1) });

export default async function authRoutes(app: FastifyInstance) {
  app.post("/auth/telegram", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }

    let validated;
    try {
      validated = validateTelegramInitData(parsed.data.initData);
    } catch (err) {
      return reply.code(401).send({ error: "invalid_init_data", message: (err as Error).message });
    }

    const { user: tgUser } = validated;
    let user = await prisma.user.findUnique({ where: { telegramId: tgUser.id } });

    if (!user) {
      let nickname = tgUser.username ?? `user_${shortHash(tgUser.id)}`;
      // ensure uniqueness
      let attempt = 0;
      while (await prisma.user.findUnique({ where: { nickname } })) {
        attempt += 1;
        nickname = `${tgUser.username ?? "user"}_${shortHash(tgUser.id + attempt)}`;
      }

      user = await prisma.user.create({
        data: {
          telegramId: tgUser.id,
          telegramUsername: tgUser.username,
          telegramFirstName: tgUser.first_name,
          avatarUrl: tgUser.photo_url,
          nickname,
          isAdmin: config.admin.telegramIds.includes(tgUser.id),
        },
      });
    }

    if (user.isBlocked) {
      return reply.code(403).send({ error: "blocked" });
    }

    const token = createSessionToken(user.id, user.telegramId, user.isAdmin);
    return reply.send({
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        isAdmin: user.isAdmin,
        needsOnboarding: !user.telegramUsername || user.nickname.startsWith("user_"),
      },
    });
  });
}
