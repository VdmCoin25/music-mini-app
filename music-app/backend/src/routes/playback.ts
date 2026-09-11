import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config.js";
import { recomputeTrendingScore } from "../services/trending.js";

const playbackSchema = z.object({
  trackId: z.string().uuid(),
  playedSeconds: z.number().min(0),
});

export default async function playbackRoutes(app: FastifyInstance) {
  // Called by the client when playback stops/pauses/track ends, reporting
  // how many seconds were actually played in that session.
  app.post("/playback/report", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = playbackSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });
    const { trackId, playedSeconds } = parsed.data;

    const track = await prisma.track.findUnique({ where: { id: trackId } });
    if (!track || track.isHidden) return reply.code(404).send({ error: "not_found" });

    // Rate-limit: ignore reports for the same track from the same user more
    // than once every 10 seconds to blunt simple Play/Pause spam scripts.
    const tenSecondsAgo = new Date(Date.now() - 10_000);
    const recentReport = await prisma.playbackEvent.findFirst({
      where: { userId: req.currentUser!.id, trackId, createdAt: { gte: tenSecondsAgo } },
      orderBy: { createdAt: "desc" },
    });
    if (recentReport) {
      return reply.send({ counted: false, reason: "rate_limited" });
    }

    const percent = track.durationSec > 0 ? playedSeconds / track.durationSec : 0;
    const completedThreshold =
      playedSeconds >= config.playback.minSecondsToCount || percent >= config.playback.minPercentToCount;

    await prisma.playbackEvent.create({
      data: { userId: req.currentUser!.id, trackId, playedSeconds, completedThreshold },
    });

    if (completedThreshold) {
      const hasHistory = await prisma.listeningHistory.findUnique({
        where: { userId_trackId: { userId: req.currentUser!.id, trackId } },
      });

      await prisma.listeningHistory.upsert({
        where: { userId_trackId: { userId: req.currentUser!.id, trackId } },
        create: { userId: req.currentUser!.id, trackId },
        update: { lastPlayedAt: new Date() },
      });

      await prisma.track.update({
        where: { id: trackId },
        data: {
          totalPlays: { increment: 1 },
          playsToday: { increment: 1 },
          playsWeek: { increment: 1 },
          playsMonth: { increment: 1 },
          playsYear: { increment: 1 },
          uniqueListeners: hasHistory ? undefined : { increment: 1 },
        },
      });

      await recomputeTrendingScore(trackId);
    }

    return reply.send({ counted: completedThreshold });
  });

  app.get("/library/history", { preHandler: requireAuth }, async (req, reply) => {
    const history = await prisma.listeningHistory.findMany({
      where: { userId: req.currentUser!.id },
      include: { track: true },
      orderBy: { lastPlayedAt: "desc" },
      take: 50,
    });
    return reply.send(history.map((h) => h.track));
  });
}
