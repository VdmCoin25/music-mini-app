/**
 * Imports popular artists and their top tracks from the official Spotify
 * Web API using the Client Credentials flow (no user login needed — this
 * only reads public catalog data, same as visiting open.spotify.com).
 *
 * What this does and does NOT do:
 *  - Stores metadata: artist name/image, track title/cover/album/genre/
 *    release date/duration/popularity, and Spotify's own IDs + URLs.
 *  - Stores `previewUrl` when Spotify provides one — this points at a file
 *    hosted on Spotify's own CDN (p.scdn.co). We link to it; we never
 *    download or re-host it.
 *  - Never scrapes, downloads, or stores full-length audio from Spotify,
 *    YouTube, Apple Music, SoundCloud, or anywhere else.
 *
 * Setup:
 *  1. Go to https://developer.spotify.com/dashboard and log in.
 *  2. "Create app" — any name/description, redirect URI can be
 *     http://localhost:3000 since we don't use user login here.
 *  3. Copy the Client ID and Client Secret into your .env:
 *       SPOTIFY_CLIENT_ID=...
 *       SPOTIFY_CLIENT_SECRET=...
 *
 * Run:
 *   npm run import:spotify
 *   npm run import:spotify -- "Custom Artist Name" "Another Artist"
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
    throw new Error(
      "SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are missing. See the setup instructions at the top of this file.",
    );
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`Spotify auth failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function spotifyGet(path: string, token: string) {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Spotify API error on ${path}: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function importArtist(name: string, token: string) {
  console.log(`\nSearching for artist: ${name}`);
  const searchResult = await spotifyGet(`/search?q=${encodeURIComponent(name)}&type=artist&limit=1`, token);
  const spotifyArtist = searchResult.artists?.items?.[0];
  if (!spotifyArtist) {
    console.warn(`  No Spotify artist found for "${name}", skipping.`);
    return;
  }

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
  console.log(`  Upserted artist: ${artist.name} (${artist.id})`);

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
      update: {
        popularity: t.popularity ?? 0,
        previewUrl: t.preview_url,
      },
    });
    if (t.preview_url) previewCount += 1;
  }

  console.log(`  Imported ${topTracks.tracks?.length ?? 0} tracks (${previewCount} with playable previews)`);
}

async function main() {
  const artistNames = process.argv.slice(2);
  const targets = artistNames.length > 0 ? artistNames : DEFAULT_ARTISTS;

  console.log(`Importing ${targets.length} artist(s) from Spotify...`);
  const token = await getAccessToken();

  for (const name of targets) {
    try {
      await importArtist(name, token);
    } catch (err) {
      console.error(`  Failed to import "${name}":`, (err as Error).message);
    }
  }

  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
