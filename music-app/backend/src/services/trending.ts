import { prisma } from "../db.js";

/**
 * Trending Score = play_velocity + unique_listeners_weight + likes_weight
 *                  + saves_weight + freshness_factor
 *
 * play_velocity: plays in the last 48h, weighted higher than lifetime plays,
 * so a brand-new track can out-rank an old track with a big lifetime total.
 * freshness_factor decays linearly over 30 days to zero.
 */
export async function recomputeTrendingScore(trackId: string): Promise<number> {
  const track = await prisma.track.findUniqueOrThrow({ where: { id: trackId } });

  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const recentPlays = await prisma.playbackEvent.count({
    where: { trackId, completedThreshold: true, createdAt: { gte: twoDaysAgo } },
  });

  const likesCount = await prisma.like.count({ where: { trackId } });
  const savesCount = await prisma.favorite.count({ where: { trackId } });

  const ageDays = (Date.now() - track.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const freshnessFactor = Math.max(0, 30 - ageDays) / 30; // 1.0 fresh -> 0.0 after 30 days

  const playVelocity = recentPlays * 3;
  const uniqueListenersWeight = track.uniqueListeners * 1.5;
  const likesWeight = likesCount * 2;
  const savesWeight = savesCount * 2.5;
  const freshnessBonus = freshnessFactor * 20;

  const score = playVelocity + uniqueListenersWeight + likesWeight + savesWeight + freshnessBonus;

  await prisma.track.update({ where: { id: trackId }, data: { trendingScore: score } });
  return score;
}

export async function recomputeAllTrendingScores(): Promise<void> {
  const tracks = await prisma.track.findMany({ where: { isHidden: false }, select: { id: true } });
  for (const t of tracks) {
    await recomputeTrendingScore(t.id);
  }
}

export type ChartPeriod = "today" | "week" | "month" | "year" | "all";

export function playsFieldForPeriod(period: ChartPeriod): "playsToday" | "playsWeek" | "playsMonth" | "playsYear" | "totalPlays" {
  switch (period) {
    case "today":
      return "playsToday";
    case "week":
      return "playsWeek";
    case "month":
      return "playsMonth";
    case "year":
      return "playsYear";
    default:
      return "totalPlays";
  }
}
