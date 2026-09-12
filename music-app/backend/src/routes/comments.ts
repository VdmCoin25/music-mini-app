import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const createSchema = z.object({ text: z.string().min(1).max(500) });

export default async function commentRoutes(app: FastifyInstance) {
  app.get("/tracks/:id/comments", async (req, reply) => {
    const { id } = req.params as { id: string };
    const comments = await prisma.comment.findMany({
      where: { trackId: id },
      include: { user: { select: { id: true, nickname: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return reply.send(comments);
  });

  app.post("/tracks/:id/comments", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });

    const track = await prisma.track.findUnique({ where: { id } });
    if (!track) return reply.code(404).send({ error: "not_found" });

    const comment = await prisma.comment.create({
      data: { text: parsed.data.text, trackId: id, userId: req.currentUser!.id },
      include: { user: { select: { id: true, nickname: true, avatarUrl: true } } },
    });
    return reply.code(201).send(comment);
  });

  app.delete("/comments/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) return reply.code(404).send({ error: "not_found" });
    if (comment.userId !== req.currentUser!.id && !req.currentUser!.isAdmin) {
      return reply.code(403).send({ error: "forbidden" });
    }
    await prisma.comment.delete({ where: { id } });
    return reply.send({ ok: true });
  });
}
