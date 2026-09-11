import type { FastifyInstance, FastifyRequest } from "fastify";
import { parseBuffer } from "music-metadata";
import { requireAuth } from "../middleware/auth.js";
import { uploadBuffer } from "../services/storage.js";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { recomputeTrendingScore } from "../services/trending.js";

interface ParsedFields {
  title?: string;
  featuring?: string;
  albumId?: string;
  genreId?: string;
  description?: string;
  tags?: string;
  explicit?: string;
  // beat-only
  bpm?: string;
  key?: string;
  genre?: string;
  mood?: string;
  licenseType?: string;
  priceCents?: string;
  kind?: "track" | "beat";
}

async function readMultipart(req: FastifyRequest) {
  const parts = req.parts();
  const fields: ParsedFields = {};
  let audioBuffer: Buffer | null = null;
  let audioMime = "";
  let coverBuffer: Buffer | null = null;
  let coverMime = "";

  for await (const part of parts) {
    if (part.type === "file") {
      const buf = await part.toBuffer();
      if (part.fieldname === "audio") {
        if (buf.length > config.uploads.maxAudioBytes) throw new Error("audio_too_large");
        if (!config.uploads.allowedAudioMime.includes(part.mimetype)) throw new Error("audio_invalid_type");
        audioBuffer = buf;
        audioMime = part.mimetype;
      } else if (part.fieldname === "cover") {
        if (buf.length > config.uploads.maxImageBytes) throw new Error("cover_too_large");
        if (!config.uploads.allowedImageMime.includes(part.mimetype)) throw new Error("cover_invalid_type");
        coverBuffer = buf;
        coverMime = part.mimetype;
      }
    } else {
      (fields as Record<string, string>)[part.fieldname] = String(part.value);
    }
  }

  if (!audioBuffer) throw new Error("audio_missing");
  return { fields, audioBuffer, audioMime, coverBuffer, coverMime };
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
    "audio/mp4": "m4a",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };
  return map[mime] ?? "bin";
}

export default async function uploadRoutes(app: FastifyInstance) {
  app.post("/uploads/track", { preHandler: requireAuth }, async (req, reply) => {
    let parsed;
    try {
      parsed = await readMultipart(req);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
    const { fields, audioBuffer, audioMime, coverBuffer, coverMime } = parsed;
    if (!fields.title) return reply.code(400).send({ error: "title_required" });

    let durationSec = 0;
    try {
      const meta = await parseBuffer(audioBuffer, audioMime);
      durationSec = Math.round(meta.format.duration ?? 0);
    } catch {
      durationSec = 0;
    }

    const audioUrl = await uploadBuffer({
      buffer: audioBuffer,
      contentType: audioMime,
      keyPrefix: "audio",
      extension: extFromMime(audioMime),
    });

    let coverUrl: string | undefined;
    if (coverBuffer) {
      coverUrl = await uploadBuffer({
        buffer: coverBuffer,
        contentType: coverMime,
        keyPrefix: "covers",
        extension: extFromMime(coverMime),
      });
    }

    const track = await prisma.track.create({
      data: {
        title: fields.title,
        artistId: req.currentUser!.id,
        featuring: fields.featuring,
        albumId: fields.albumId || undefined,
        genreId: fields.genreId || undefined,
        description: fields.description,
        tags: fields.tags ? fields.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        explicit: fields.explicit === "true",
        audioUrl,
        coverUrl,
        durationSec,
      },
    });
    await recomputeTrendingScore(track.id);

    return reply.code(201).send(track);
  });

  app.post("/uploads/beat", { preHandler: requireAuth }, async (req, reply) => {
    let parsed;
    try {
      parsed = await readMultipart(req);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
    const { fields, audioBuffer, audioMime, coverBuffer, coverMime } = parsed;
    if (!fields.title || !fields.bpm) return reply.code(400).send({ error: "title_and_bpm_required" });

    let durationSec = 0;
    try {
      const meta = await parseBuffer(audioBuffer, audioMime);
      durationSec = Math.round(meta.format.duration ?? 0);
    } catch {
      durationSec = 0;
    }

    const audioUrl = await uploadBuffer({ buffer: audioBuffer, contentType: audioMime, keyPrefix: "audio", extension: extFromMime(audioMime) });
    let coverUrl: string | undefined;
    if (coverBuffer) {
      coverUrl = await uploadBuffer({ buffer: coverBuffer, contentType: coverMime, keyPrefix: "covers", extension: extFromMime(coverMime) });
    }

    const beat = await prisma.beat.create({
      data: {
        title: fields.title,
        producerId: req.currentUser!.id,
        audioUrl,
        coverUrl,
        bpm: parseInt(fields.bpm, 10),
        key: fields.key,
        genre: fields.genre,
        mood: fields.mood,
        durationSec,
        tags: fields.tags ? fields.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        description: fields.description,
        licenseType: fields.licenseType === "PAID" ? "PAID" : "FREE",
        priceCents: fields.priceCents ? parseInt(fields.priceCents, 10) : undefined,
      },
    });

    return reply.code(201).send(beat);
  });
}
