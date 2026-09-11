import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

export default async function adminRoutes(app: FastifyInstance) {
  app.get("/admin/overview", { preHandler: requireAdmin }, async (_req, reply) => {
    const [users, tracks, beats, albums, openReports, playsAgg] = await Promise.all([
      prisma.user.count(),
      prisma.track.count(),
      prisma.beat.count(),
      prisma.album.count(),
      prisma.report.count({ where: { resolved: false } }),
      prisma.track.aggregate({ _sum: { totalPlays: true } }),
    ]);
    return reply.send({
      users,
      tracks,
      beats,
      albums,
      openReports,
      totalPlays: playsAgg._sum.totalPlays ?? 0,
    });
  });

  app.get("/admin/users", { preHandler: requireAdmin }, async (req, reply) => {
    const { search = "", page = "1" } = req.query as { search?: string; page?: string };
    const users = await prisma.user.findMany({
      where: search ? { OR: [{ nickname: { contains: search, mode: "insensitive" } }, { telegramUsername: { contains: search, mode: "insensitive" } }] } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      skip: (parseInt(page, 10) - 1) * 50,
    });
    return reply.send(users);
  });

  app.post("/admin/users/:id/block", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await prisma.user.update({ where: { id }, data: { isBlocked: true } });
    return reply.send(user);
  });

  app.post("/admin/users/:id/unblock", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await prisma.user.update({ where: { id }, data: { isBlocked: false } });
    return reply.send(user);
  });

  app.delete("/admin/users/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.user.delete({ where: { id } });
    return reply.send({ ok: true });
  });

  app.get("/admin/tracks", { preHandler: requireAdmin }, async (req, reply) => {
    const { search = "" } = req.query as { search?: string };
    const tracks = await prisma.track.findMany({
      where: search ? { title: { contains: search, mode: "insensitive" } } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { artist: true },
    });
    return reply.send(tracks);
  });

  app.post("/admin/tracks/:id/hide", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const track = await prisma.track.update({ where: { id }, data: { isHidden: true } });
    return reply.send(track);
  });

  app.post("/admin/tracks/:id/unhide", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const track = await prisma.track.update({ where: { id }, data: { isHidden: false } });
    return reply.send(track);
  });

  app.delete("/admin/tracks/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.track.delete({ where: { id } });
    return reply.send({ ok: true });
  });

  app.get("/admin/reports", { preHandler: requireAdmin }, async (req, reply) => {
    const { resolved = "false" } = req.query as { resolved?: string };
    const reports = await prisma.report.findMany({
      where: { resolved: resolved === "true" },
      orderBy: { createdAt: "desc" },
      include: { reporter: true, track: true },
      take: 100,
    });
    return reply.send(reports);
  });

  app.post("/admin/reports/:id/resolve", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const report = await prisma.report.update({ where: { id }, data: { resolved: true } });
    return reply.send(report);
  });
}
