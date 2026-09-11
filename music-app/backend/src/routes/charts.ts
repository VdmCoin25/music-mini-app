import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { playsFieldForPeriod, type ChartPeriod } from "../services/trending.js";

export default async function chartRoutes(app: FastifyInstance) {
  app.get("/charts/tracks", async (req, reply) => {
    const { period = "week" } = req.query as { period?: ChartPeriod };
    const field = playsFieldForPeriod(period);
    const tracks = await prisma.track.findMany({
      where: { isHidden: false },
      orderBy: { [field]: "desc" },
      take: 50,
      include: { artist: true },
    });
    return reply.send(tracks);
  });

  app.get("/charts/artists", async (req, reply) => {
    const { period = "week" } = req.query as { period?: ChartPeriod };
    const field = playsFieldForPeriod(period);
    // Aggregate plays per artist across their tracks.
    const grouped = await prisma.track.groupBy({
      by: ["artistId"],
      where: { isHidden: false },
      _sum: { [field]: true },
      orderBy: { _sum: { [field]: "desc" } },
      take: 50,
    });
    const artistIds = grouped.map((g) => g.artistId);
    const artists = await prisma.user.findMany({ where: { id: { in: artistIds } } });
    const byId = new Map(artists.map((a) => [a.id, a]));
    return reply.send(
      grouped.map((g) => ({
        artist: byId.get(g.artistId),
        plays: (g._sum as Record<string, number | null>)[field] ?? 0,
      })),
    );
  });

  app.get("/charts/albums", async (_req, reply) => {
    const albums = await prisma.album.findMany({
      include: { tracks: true, artist: true },
      take: 50,
    });
    const withPlays = albums
      .map((a) => ({ ...a, totalPlays: a.tracks.reduce((s, t) => s + t.totalPlays, 0) }))
      .sort((a, b) => b.totalPlays - a.totalPlays);
    return reply.send(withPlays);
  });

  app.get("/charts/beats", async (_req, reply) => {
    const beats = await prisma.beat.findMany({ orderBy: { totalPlays: "desc" }, take: 50, include: { producer: true } });
    return reply.send(beats);
  });

  app.get("/trending", async (_req, reply) => {
    const tracks = await prisma.track.findMany({
      where: { isHidden: false },
      orderBy: { trendingScore: "desc" },
      take: 50,
      include: { artist: true },
    });
    return reply.send(tracks);
  });
}
