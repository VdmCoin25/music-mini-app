import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const updateProfileSchema = z.object({
  nickname: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/).optional(),
  bio: z.string().max(280).optional(),
  favoriteGenreIds: z.array(z.string()).optional(),
});

export default async function userRoutes(app: FastifyInstance) {
  app.get("/users/me", { preHandler: requireAuth }, async (req, reply) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser!.id } });
    return reply.send(publicProfile(user));
  });

  app.patch("/users/me", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });

    if (parsed.data.nickname) {
      const existing = await prisma.user.findUnique({ where: { nickname: parsed.data.nickname } });
      if (existing && existing.id !== req.currentUser!.id) {
        return reply.code(409).send({ error: "nickname_taken" });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.currentUser!.id },
      data: { nickname: parsed.data.nickname, bio: parsed.data.bio },
    });
    return reply.send(publicProfile(user));
  });

  app.get("/users/:idOrNickname", async (req, reply) => {
    const { idOrNickname } = req.params as { idOrNickname: string };
    const user = await prisma.user.findFirst({
      where: { OR: [{ id: idOrNickname }, { nickname: idOrNickname }] },
    });
    if (!user) return reply.code(404).send({ error: "not_found" });

    const [tracksCount, followersCount, followingCount, likesReceived] = await Promise.all([
      prisma.track.count({ where: { artistId: user.id, isHidden: false } }),
      prisma.follow.count({ where: { followingId: user.id } }),
      prisma.follow.count({ where: { followerId: user.id } }),
      prisma.like.count({ where: { track: { artistId: user.id } } }),
    ]);

    return reply.send({
      ...publicProfile(user),
      stats: { tracksCount, followersCount, followingCount, likesReceived },
    });
  });

  app.get("/users/:id/tracks", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tracks = await prisma.track.findMany({
      where: { artistId: id, isHidden: false },
      orderBy: { createdAt: "desc" },
    });
    return reply.send(tracks);
  });
}

function publicProfile(user: {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  telegramUsername: string | null;
  isVerified: boolean;
}) {
  return {
    id: user.id,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    telegramUsername: user.telegramUsername,
    isVerified: user.isVerified,
  };
}
