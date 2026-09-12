import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { normalizeLocalTrack, normalizeExternalTrack } from "../services/catalog.js";

export default async function trackRoutes(app: FastifyInstance) {
  app.get("/tracks/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const track = await prisma.track.findUnique({
      where: { id },
      include: { artist: true, genre: true, album: true },
    });
    if (track && !track.isHidden) return reply.send(normalizeLocalTrack(track));

    const externalTrack = await prisma.externalTrack.findUnique({
      where: { id },
      include: { artist: true },
    });
    if (externalTrack) return reply.send(normalizeExternalTrack(externalTrack));

    return reply.code(404).send({ error: "not_found" });
  });

  app.get("/tracks/:id/similar", async (req, reply) => {
    const { id } = req.params as { id: string };
    const track = await prisma.track.findUnique({ where: { id }, include: { genre: true } });

    if (track) {
      const similar = await prisma.track.findMany({
        where: { genreId: track.genreId ?? undefined, id: { not: id }, isHidden: false },
        orderBy: { trendingScore: "desc" },
        take: 30,
        include: { artist: true, genre: true },
      });
      return reply.send(similar.map(normalizeLocalTrack));
    }

    const externalTrack = await prisma.externalTrack.findUnique({ where: { id } });
    if (externalTrack) {
      const similar = await prisma.externalTrack.findMany({
        where: { genre: externalTrack.genre ?? undefined, id: { not: id } },
        orderBy: { popularity: "desc" },
        take: 30,
        include: { artist: true },
      });
      return reply.send(similar.map(normalizeExternalTrack));
    }

    return reply.code(404).send({ error: "not_found" });
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
    const genre = await prisma.genre.findUnique({ where: { id } });
    if (!genre) return reply.code(404).send({ error: "not_found" });

    const orderBy =
      sort === "new" ? { createdAt: "desc" as const } : sort === "trending" ? { trendingScore: "desc" as const } : { totalPlays: "desc" as const };
    const [tracks, externalTracks] = await Promise.all([
      prisma.track.findMany({ where: { genreId: id, isHidden: false }, orderBy, take: 40, include: { artist: true, genre: true } }),
      prisma.externalTrack.findMany({ where: { genre: genre.name }, orderBy: { popularity: "desc" }, take: 40, include: { artist: true } }),
    ]);

    const merged = [...tracks.map(normalizeLocalTrack), ...externalTracks.map(normalizeExternalTrack)];
    return reply.send(merged);
  });
}
