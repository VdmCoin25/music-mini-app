import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const createSchema = z.object({ title: z.string().min(1).max(100), isPublic: z.boolean().default(true) });
const renameSchema = z.object({ title: z.string().min(1).max(100) });
const addTrackSchema = z.object({ trackId: z.string().uuid() });
const reorderSchema = z.object({ trackIds: z.array(z.string().uuid()) });

export default async function playlistRoutes(app: FastifyInstance) {
  app.post("/playlists", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });
    const playlist = await prisma.playlist.create({
      data: { title: parsed.data.title, isPublic: parsed.data.isPublic, ownerId: req.currentUser!.id },
    });
    return reply.code(201).send(playlist);
  });

  app.get("/playlists/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const playlist = await prisma.playlist.findUnique({
      where: { id },
      include: { tracks: { include: { track: true }, orderBy: { position: "asc" } }, owner: true },
    });
    if (!playlist) return reply.code(404).send({ error: "not_found" });
    return reply.send(playlist);
  });

  app.get("/library/playlists", { preHandler: requireAuth }, async (req, reply) => {
    const playlists = await prisma.playlist.findMany({ where: { ownerId: req.currentUser!.id }, orderBy: { createdAt: "desc" } });
    return reply.send(playlists);
  });

  async function assertOwner(req: any, reply: any, playlistId: string) {
    const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist) {
      reply.code(404).send({ error: "not_found" });
      return null;
    }
    if (playlist.ownerId !== req.currentUser!.id) {
      reply.code(403).send({ error: "forbidden" });
      return null;
    }
    return playlist;
  }

  app.patch("/playlists/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const playlist = await assertOwner(req, reply, id);
    if (!playlist) return;
    const parsed = renameSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });
    const updated = await prisma.playlist.update({ where: { id }, data: { title: parsed.data.title } });
    return reply.send(updated);
  });

  app.delete("/playlists/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const playlist = await assertOwner(req, reply, id);
    if (!playlist) return;
    await prisma.playlist.delete({ where: { id } });
    return reply.send({ ok: true });
  });

  app.post("/playlists/:id/tracks", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const playlist = await assertOwner(req, reply, id);
    if (!playlist) return;
    const parsed = addTrackSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });

    const count = await prisma.playlistTrack.count({ where: { playlistId: id } });
    const added = await prisma.playlistTrack.upsert({
      where: { playlistId_trackId: { playlistId: id, trackId: parsed.data.trackId } },
      create: { playlistId: id, trackId: parsed.data.trackId, position: count },
      update: {},
    });
    return reply.code(201).send(added);
  });

  app.delete("/playlists/:id/tracks/:trackId", { preHandler: requireAuth }, async (req, reply) => {
    const { id, trackId } = req.params as { id: string; trackId: string };
    const playlist = await assertOwner(req, reply, id);
    if (!playlist) return;
    await prisma.playlistTrack.deleteMany({ where: { playlistId: id, trackId } });
    return reply.send({ ok: true });
  });

  app.put("/playlists/:id/order", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const playlist = await assertOwner(req, reply, id);
    if (!playlist) return;
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });

    await prisma.$transaction(
      parsed.data.trackIds.map((trackId, position) =>
        prisma.playlistTrack.update({
          where: { playlistId_trackId: { playlistId: id, trackId } },
          data: { position },
        }),
      ),
    );
    return reply.send({ ok: true });
  });
}
