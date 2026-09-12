import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

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

async function getAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are missing");
  }
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

async function spotifyGet(path: string, token: string) {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Spotify API error on ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function importArtist(name: string, token: string): Promise<string> {
  const searchResult = await spotifyGet(`/search?q=${encodeURIComponent(name)}&type=artist&limit=1`, token);
  const spotifyArtist = searchResult.artists?.items?.[0];
  if (!spotifyArtist) return `No Spotify artist found for "${name}", skipped.`;

  const artist = await prisma.externalArtist.upsert({
    where: { source_externalId: { source: "spotify", externalId: spotifyArtist.id } },
    create: {
      source: "spotify",
      externalId: spotifyArtist.id,
      name: spotifyArtist.name,
      imageUrl: spotifyArtist.images?.[0]?.url,
      genres: spotifyArtist.genres ?? [],
      popularity: spotifyArtist.popularity ?? 0,
      externalUrl: spotifyArtist.external_urls?.spotify ?? `https://open.spotify.com/artist/${spotifyArtist.id}`,
    },
    update: {
      name: spotifyArtist.name,
      imageUrl: spotifyArtist.images?.[0]?.url,
      genres: spotifyArtist.genres ?? [],
      popularity: spotifyArtist.popularity ?? 0,
    },
  });

  const topTracks = await spotifyGet(`/artists/${spotifyArtist.id}/top-tracks?market=US`, token);
  let previewCount = 0;
  for (const t of topTracks.tracks ?? []) {
    await prisma.externalTrack.upsert({
      where: { source_externalId: { source: "spotify", externalId: t.id } },
      create: {
        source: "spotify",
        externalId: t.id,
        title: t.name,
        artistId: artist.id,
        album: t.album?.name,
        coverUrl: t.album?.images?.[0]?.url,
        genre: spotifyArtist.genres?.[0] ?? null,
        releaseDate: t.album?.release_date ? new Date(t.album.release_date) : null,
        durationMs: t.duration_ms,
        popularity: t.popularity ?? 0,
        previewUrl: t.preview_url,
        externalUrl: t.external_urls?.spotify ?? `https://open.spotify.com/track/${t.id}`,
      },
      update: { popularity: t.popularity ?? 0, previewUrl: t.preview_url },
    });
    if (t.preview_url) previewCount += 1;
  }
  return `${artist.name}: imported ${topTracks.tracks?.length ?? 0} tracks (${previewCount} with previews)`;
}

export default async function internalImportRoutes(app: FastifyInstance) {
  app.get("/internal/import-spotify", async (req, reply) => {
    const { key, artists } = req.query as { key?: string; artists?: string };
    if (!key || key !== process.env.IMPORT_SECRET) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const targets = artists ? artists.split(",").map((a) => a.trim()) : DEFAULT_ARTISTS;
    const token = await getAccessToken();
    const results: string[] = [];
    for (const name of targets) {
      try {
        results.push(await importArtist(name, token));
      } catch (err) {
        results.push(`${name}: FAILED - ${(err as Error).message}`);
      }
    }
    return reply.send({ imported: targets.length, results });
  });
}
