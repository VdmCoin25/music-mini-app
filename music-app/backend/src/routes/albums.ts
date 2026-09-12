import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { normalizeLocalTrack, normalizeExternalTrack } from "../services/catalog.js";

const createSchema = z.object({
  title: z.string().min(1).max(120),
  releaseType: z.enum(["SINGLE", "EP", "ALBUM"]).default("ALBUM"),
  description: z.string().max(1000).optional(),
  coverUrl: z.string().url().optional(),
});

export default async function albumRoutes(app: FastifyInstance) {
  app.post("/albums", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });
    const album = await prisma.album.create({
      data: { ...parsed.data, artistId: req.currentUser!.id },
    });
    return reply.code(201).send(album);
  });

  app.get("/albums/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const album = await prisma.album.findUnique({
      where: { id },
      include: { artist: true, tracks: { where: { isHidden: false }, orderBy: { createdAt: "asc" } } },
    });
    if (!album) return reply.code(404).send({ error: "not_found" });
    return reply.send(album);
  });

  app.get("/releases/new", async (req, reply) => {
    const { type = "all" } = req.query as { type?: string };
    if (type === "albums") {
      const albums = await prisma.album.findMany({ orderBy: { releaseDate: "desc" }, take: 30, include: { artist: true } });
      return reply.send(albums);
    }
    if (type === "beats") {
      const beats = await prisma.beat.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { producer: true } });
      return reply.send(beats);
    }
    const tracks = await prisma.track.findMany({
      where: { isHidden: false },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { artist: true, genre: true },
    });
    const externalTracks = await prisma.externalTrack.findMany({
      orderBy: { releaseDate: "desc" },
      take: 30,
      include: { artist: true },
    });
    const merged = [
      ...tracks.map(normalizeLocalTrack),
      ...externalTracks.map(normalizeExternalTrack),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return reply.send(merged.slice(0, 40));
  });
}
