import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { recomputeTrendingScore } from "../services/trending.js";

export default async function socialRoutes(app: FastifyInstance) {
  // ---- Likes ----
  app.post("/tracks/:id/like", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.like.upsert({
      where: { userId_trackId: { userId: req.currentUser!.id, trackId: id } },
      create: { userId: req.currentUser!.id, trackId: id },
      update: {},
    });
    await recomputeTrendingScore(id);
    return reply.send({ liked: true });
  });

  app.delete("/tracks/:id/like", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.like.deleteMany({ where: { userId: req.currentUser!.id, trackId: id } });
    await recomputeTrendingScore(id);
    return reply.send({ liked: false });
  });

  app.get("/library/liked", { preHandler: requireAuth }, async (req, reply) => {
    const likes = await prisma.like.findMany({
      where: { userId: req.currentUser!.id },
      include: { track: true },
      orderBy: { createdAt: "desc" },
    });
    return reply.send(likes.map((l) => l.track));
  });

  // ---- Favorites / saves ----
  app.post("/tracks/:id/favorite", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.favorite.upsert({
      where: { userId_trackId: { userId: req.currentUser!.id, trackId: id } },
      create: { userId: req.currentUser!.id, trackId: id },
      update: {},
    });
    await recomputeTrendingScore(id);
    return reply.send({ saved: true });
  });

  app.delete("/tracks/:id/favorite", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.favorite.deleteMany({ where: { userId: req.currentUser!.id, trackId: id } });
    await recomputeTrendingScore(id);
    return reply.send({ saved: false });
  });

  app.get("/library/saved", { preHandler: requireAuth }, async (req, reply) => {
    const favs = await prisma.favorite.findMany({
      where: { userId: req.currentUser!.id },
      include: { track: true },
      orderBy: { createdAt: "desc" },
    });
    return reply.send(favs.map((f) => f.track));
  });

  // ---- Follows ----
  app.post("/users/:id/follow", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (id === req.currentUser!.id) return reply.code(400).send({ error: "cannot_follow_self" });
    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: req.currentUser!.id, followingId: id } },
      create: { followerId: req.currentUser!.id, followingId: id },
      update: {},
    });
    return reply.send({ following: true });
  });

  app.delete("/users/:id/follow", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.follow.deleteMany({ where: { followerId: req.currentUser!.id, followingId: id } });
    return reply.send({ following: false });
  });

  app.get("/library/following-feed", { preHandler: requireAuth }, async (req, reply) => {
    const follows = await prisma.follow.findMany({ where: { followerId: req.currentUser!.id } });
    const artistIds = follows.map((f) => f.followingId);
    const tracks = await prisma.track.findMany({
      where: { artistId: { in: artistIds }, isHidden: false },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { artist: true },
    });
    return reply.send(tracks);
  });
}
