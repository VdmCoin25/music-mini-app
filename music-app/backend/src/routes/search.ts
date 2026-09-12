import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { normalizeLocalTrack, normalizeExternalTrack } from "../services/catalog.js";

export default async function searchRoutes(app: FastifyInstance) {
  app.get("/search", async (req, reply) => {
    const { q = "" } = req.query as { q?: string };
    const query = q.trim();
    if (query.length < 1) return reply.send({ tracks: [], artists: [], albums: [], beats: [], playlists: [] });

    // Prisma's `contains` + `mode: insensitive` runs as ILIKE '%q%' on Postgres.
    // See prisma/README-search.md for upgrading this to real Postgres full-text
    // search (tsvector + GIN index) once catalog size grows.
    const [tracks, artists, albums, beats, playlists, externalTracks, externalArtists] = await Promise.all([
      prisma.track.findMany({
        where: { isHidden: false, OR: [{ title: { contains: query, mode: "insensitive" } }, { tags: { has: query } }] },
        take: 20,
        include: { artist: true, genre: true },
      }),
      prisma.user.findMany({
        where: { OR: [{ nickname: { contains: query, mode: "insensitive" } }, { telegramUsername: { contains: query, mode: "insensitive" } }] },
        take: 20,
      }),
      prisma.album.findMany({ where: { title: { contains: query, mode: "insensitive" } }, take: 20, include: { artist: true } }),
      prisma.beat.findMany({ where: { title: { contains: query, mode: "insensitive" } }, take: 20, include: { producer: true } }),
      prisma.playlist.findMany({ where: { isPublic: true, title: { contains: query, mode: "insensitive" } }, take: 20 }),
      prisma.externalTrack.findMany({
        where: { title: { contains: query, mode: "insensitive" } },
        take: 20,
        include: { artist: true },
      }),
      prisma.externalArtist.findMany({ where: { name: { contains: query, mode: "insensitive" } }, take: 20 }),
    ]);

    const mergedTracks = [
      ...tracks.map(normalizeLocalTrack),
      ...externalTracks.map(normalizeExternalTrack),
    ].sort((a, b) => (b.totalPlays ?? 0) - (a.totalPlays ?? 0));

    const mergedArtists = [
      ...artists.map((a) => ({ id: a.id, nickname: a.nickname, avatarUrl: a.avatarUrl, isExternal: false })),
      ...externalArtists.map((a) => ({ id: a.id, nickname: a.name, avatarUrl: a.imageUrl, isExternal: true })),
    ];

    return reply.send({ tracks: mergedTracks, artists: mergedArtists, albums, beats, playlists });
  });
}
