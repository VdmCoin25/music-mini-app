import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const reportSchema = z.object({
  targetType: z.enum(["TRACK", "USER", "BEAT"]),
  trackId: z.string().uuid().optional(),
  reason: z.enum(["COPYRIGHT", "SPAM", "HATE", "ILLEGAL", "NSFW", "OTHER"]),
  details: z.string().max(1000).optional(),
});

export default async function reportRoutes(app: FastifyInstance) {
  app.post("/reports", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });
    const report = await prisma.report.create({
      data: { ...parsed.data, reporterId: req.currentUser!.id },
    });
    return reply.code(201).send(report);
  });
}
