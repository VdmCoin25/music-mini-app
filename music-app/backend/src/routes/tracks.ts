import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export default async function trackRoutes(app: FastifyInstance) {
  app.get("/tracks/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const track = await prisma.track.findUnique({
      where: { id },
      include: { artist: true, genre: true, album: true },
    });
    if (!track || track.isHidden) return reply.code(404).send({ error: "not_found" });
    return reply.send(track);
  });

  app.get("/tracks/:id/similar", async (req, reply) => {
    const { id } = req.params as { id: string };
    const track = await prisma.track.findUnique({ where: { id } });
    if (!track) return reply.code(404).send({ error: "not_found" });

    // Simple "radio" seed: same genre, excluding the seed track, ordered by trending.
    const similar = await prisma.track.findMany({
      where: { genreId: track.genreId ?? undefined, id: { not: id }, isHidden: false },
      orderBy: { trendingScore: "desc" },
      take: 30,
    });
    return reply.send(similar);
  });

  app.delete("/tracks/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const track = await prisma.track.findUnique({ where: { id } });
    if (!track) return reply.code(404).send({ error: "not_found" });
    if (track.artistId !== req.currentUser!.id && !req.currentUser!.isAdmin) {
      return reply.code(403).send({ error: "forbidden" });
    }
    await prisma.track.delete({ where: { id } });
    return reply.send({ ok: true });
  });

  app.get("/genres", async (_req, reply) => {
    const genres = await prisma.genre.findMany({ orderBy: { name: "asc" } });
    return reply.send(genres);
  });

  app.get("/genres/:id/tracks", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sort = "popular" } = req.query as { sort?: string };
    const orderBy = sort === "new" ? { createdAt: "desc" as const } : sort === "trending" ? { trendingScore: "desc" as const } : { totalPlays: "desc" as const };
    const tracks = await prisma.track.findMany({ where: { genreId: id, isHidden: false }, orderBy, take: 50 });
    return reply.send(tracks);
  });
}
