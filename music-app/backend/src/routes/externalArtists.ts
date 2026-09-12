import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { normalizeExternalTrack } from "../services/catalog.js";

export default async function externalArtistRoutes(app: FastifyInstance) {
  app.get("/external-artists/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const artist = await prisma.externalArtist.findUnique({ where: { id } });
    if (!artist) return reply.code(404).send({ error: "not_found" });

    const tracksCount = await prisma.externalTrack.count({ where: { artistId: id } });

    return reply.send({
      id: artist.id,
      nickname: artist.name,
      avatarUrl: artist.imageUrl,
      bio: null,
      isExternal: true,
      externalUrl: artist.externalUrl,
      genres: artist.genres,
      stats: { tracksCount, followersCount: 0, likesReceived: 0 },
    });
  });

  app.get("/external-artists/:id/tracks", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tracks = await prisma.externalTrack.findMany({
      where: { artistId: id },
      orderBy: { popularity: "desc" },
      include: { artist: true },
    });
    return reply.send(tracks.map(normalizeExternalTrack));
  });
}
