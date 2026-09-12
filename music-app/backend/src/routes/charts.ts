import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { playsFieldForPeriod, type ChartPeriod } from "../services/trending.js";
import { normalizeLocalTrack, normalizeExternalTrack } from "../services/catalog.js";

async function getExternalTracks(take: number) {
  return prisma.externalTrack.findMany({
    orderBy: { popularity: "desc" },
    take,
    include: { artist: true },
  });
}

export default async function chartRoutes(app: FastifyInstance) {
  app.get("/charts/tracks", async (req, reply) => {
    const { period = "week" } = req.query as { period?: ChartPeriod };
    const field = playsFieldForPeriod(period);
    const [tracks, externalTracks] = await Promise.all([
      prisma.track.findMany({
        where: { isHidden: false },
        orderBy: { [field]: "desc" },
        take: 50,
        include: { artist: true, genre: true },
      }),
      getExternalTracks(50),
    ]);

    const merged = [
      ...tracks.map(normalizeLocalTrack),
      ...externalTracks.map(normalizeExternalTrack),
    ].sort((a, b) => (b.totalPlays ?? 0) - (a.totalPlays ?? 0));

    return reply.send(merged.slice(0, 50));
  });

  app.get("/charts/artists", async (req, reply) => {
    const { period = "week" } = req.query as { period?: ChartPeriod };
    const field = playsFieldForPeriod(period);
    const grouped = await prisma.track.groupBy({
      by: ["artistId"],
      where: { isHidden: false },
      _sum: { [field]: true },
      orderBy: { _sum: { [field]: "desc" } },
      take: 30,
    });
    const artistIds = grouped.map((g) => g.artistId);
    const artists = await prisma.user.findMany({ where: { id: { in: artistIds } } });
    const byId = new Map(artists.map((a) => [a.id, a]));
    const localArtists = grouped.map((g) => ({
      artist: byId.get(g.artistId),
      plays: (g._sum as Record<string, number | null>)[field] ?? 0,
      isExternal: false,
    }));

    const externalArtists = await prisma.externalArtist.findMany({
      orderBy: { popularity: "desc" },
      take: 20,
    });
    const externalMapped = externalArtists.map((a) => ({
      artist: { id: a.id, nickname: a.name, avatarUrl: a.imageUrl, isExternal: true },
      plays: a.popularity * 100,
      isExternal: true,
    }));

    const merged = [...localArtists, ...externalMapped].sort((a, b) => b.plays - a.plays);
    return reply.send(merged.slice(0, 50));
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
    const [tracks, externalTracks] = await Promise.all([
      prisma.track.findMany({
        where: { isHidden: false },
        orderBy: { trendingScore: "desc" },
        take: 50,
        include: { artist: true, genre: true },
      }),
      getExternalTracks(50),
    ]);

    const merged = [
      ...tracks.map(normalizeLocalTrack),
      ...externalTracks.map(normalizeExternalTrack),
    ].sort((a, b) => (b.trendingScore ?? 0) - (a.trendingScore ?? 0));

    return reply.send(merged.slice(0, 50));
  });
}
