import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export default async function beatRoutes(app: FastifyInstance) {
  app.get("/beats", async (req, reply) => {
    const { genre, minBpm, maxBpm, key, mood, license, sort = "new" } = req.query as Record<string, string | undefined>;

    const where: any = {};
    if (genre) where.genre = genre;
    if (key) where.key = key;
    if (mood) where.mood = mood;
    if (license) where.licenseType = license.toUpperCase();
    if (minBpm || maxBpm) {
      where.bpm = {};
      if (minBpm) where.bpm.gte = parseInt(minBpm, 10);
      if (maxBpm) where.bpm.lte = parseInt(maxBpm, 10);
    }

    const orderBy = sort === "popular" ? { totalPlays: "desc" as const } : { createdAt: "desc" as const };

    const beats = await prisma.beat.findMany({ where, orderBy, take: 50, include: { producer: true } });
    return reply.send(beats);
  });

  app.get("/beats/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const beat = await prisma.beat.findUnique({ where: { id }, include: { producer: true } });
    if (!beat) return reply.code(404).send({ error: "not_found" });
    return reply.send(beat);
  });
}
