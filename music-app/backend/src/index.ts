import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { config } from "./config.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import trackRoutes from "./routes/tracks.js";
import uploadRoutes from "./routes/uploads.js";
import playbackRoutes from "./routes/playback.js";
import chartRoutes from "./routes/charts.js";
import searchRoutes from "./routes/search.js";
import socialRoutes from "./routes/social.js";
import playlistRoutes from "./routes/playlists.js";
import beatRoutes from "./routes/beats.js";
import albumRoutes from "./routes/albums.js";
import reportRoutes from "./routes/reports.js";
import adminRoutes from "./routes/admin.js";
import commentRoutes from "./routes/comments.js";

async function main() {
  const app = Fastify({ logger: true, trustProxy: true });

  await app.register(cors, { origin: true });
  await app.register(multipart, {
    limits: { fileSize: config.uploads.maxAudioBytes },
  });

  app.get("/health", async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(trackRoutes);
  await app.register(uploadRoutes);
  await app.register(playbackRoutes);
  await app.register(chartRoutes);
  await app.register(searchRoutes);
  await app.register(socialRoutes);
  await app.register(playlistRoutes);
  await app.register(beatRoutes);
  await app.register(albumRoutes);
  await app.register(reportRoutes);
  await app.register(adminRoutes);
  await app.register(commentRoutes);

  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);
    const status = err.statusCode ?? 500;
    reply.code(status).send({ error: status === 500 ? "internal_error" : err.message });
  });

  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(`music-app backend listening on :${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
