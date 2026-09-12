import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

/**
 * Imports popular artists and tracks from Apple's public iTunes Search API.
 * This is a free, official, no-auth-required endpoint (the same one that
 * powers "Search" in iTunes/Apple Music affiliate widgets) — no API key,
 * no login, no subscription required on either side.
 *
 * We store metadata only: title, cover art, album, genre, release date,
 * duration, and an official 30-60s preview clip URL hosted on Apple's own
 * CDN (never downloaded or re-hosted by us) plus a link to open the full
 * track in the Apple Music / iTunes app.
 */

const DEFAULT_ARTISTS = [
  "Drake",
  "Kendrick Lamar",
  "Travis Scott",
  "Future",
  "Playboi Carti",
  "21 Savage",
  "Central Cee",
  "Doja Cat",
  "The Weeknd",
  "Billie Eilish",
];

function upsizeArtwork(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/\d+x\d+bb\.(jpg|png)$/, "/600x600bb.$1");
}

async function importArtist(name: string): Promise<string> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=song&limit=15&media=music`;
  const res = await fetch(url);
  if (!res.ok) return `${name}: FAILED - iTunes API error ${res.status}`;
  const data = await res.json();
  const results: any[] = data.results ?? [];

  const matching = results.filter(
    (t) => t.artistName && t.artistName.toLowerCase() === name.toLowerCase(),
  );
  const tracks = matching.length > 0 ? matching : results;
  if (tracks.length === 0) return `${name}: no results found, skipped.`;

  const first = tracks[0];
  const artist = await prisma.externalArtist.upsert({
    where: { source_externalId: { source: "itunes", externalId: String(first.artistId) } },
    create: {
      source: "itunes",
      externalId: String(first.artistId),
      name: first.artistName,
      imageUrl: upsizeArtwork(first.artworkUrl100),
      genres: first.primaryGenreName ? [first.primaryGenreName] : [],
      popularity: 60,
      externalUrl: first.artistViewUrl ?? `https://music.apple.com/search?term=${encodeURIComponent(name)}`,
    },
    update: {
      imageUrl: upsizeArtwork(first.artworkUrl100),
      genres: first.primaryGenreName ? [first.primaryGenreName] : [],
    },
  });

  let previewCount = 0;
  const seen = new Set<string>();
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i];
    if (!t.trackId || seen.has(String(t.trackId))) continue;
    seen.add(String(t.trackId));

    await prisma.externalTrack.upsert({
      where: { source_externalId: { source: "itunes", externalId: String(t.trackId) } },
      create: {
        source: "itunes",
        externalId: String(t.trackId),
        title: t.trackName,
        artistId: artist.id,
        album: t.collectionName,
        coverUrl: upsizeArtwork(t.artworkUrl100),
        genre: t.primaryGenreName ?? null,
        releaseDate: t.releaseDate ? new Date(t.releaseDate) : null,
        durationMs: t.trackTimeMillis ?? 0,
        popularity: Math.max(10, 100 - i * 6),
        previewUrl: t.previewUrl,
        externalUrl: t.trackViewUrl ?? artist.externalUrl,
      },
      update: {
        previewUrl: t.previewUrl,
        popularity: Math.max(10, 100 - i * 6),
      },
    });
    if (t.previewUrl) previewCount += 1;
  }

  return `${artist.name}: imported ${seen.size} tracks (${previewCount} with playable previews)`;
}

export default async function internalImportRoutes(app: FastifyInstance) {
  app.get("/internal/import-spotify", async (req, reply) => {
    const { key, artists } = req.query as { key?: string; artists?: string };
    if (!key || key !== process.env.IMPORT_SECRET) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const targets = artists ? artists.split(",").map((a) => a.trim()) : DEFAULT_ARTISTS;
    const results: string[] = [];
    for (const name of targets) {
      try {
        results.push(await importArtist(name));
      } catch (err) {
        results.push(`${name}: FAILED - ${(err as Error).message}`);
      }
    }
    return reply.send({ imported: targets.length, results });
  });
}
