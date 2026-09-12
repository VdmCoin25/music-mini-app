import { prisma } from "../db.js";

/**
 * Live search against Apple's public iTunes Search API (free, no auth) for
 * any term the user types — not just the artists we pre-imported. Results
 * are cached into ExternalArtist/ExternalTrack so repeat searches are fast
 * and so these tracks also show up in charts/genres/new-releases later.
 */

function upsizeArtwork(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/\d+x\d+bb\.(jpg|png)$/, "/600x600bb.$1");
}

export async function liveSearchAndCacheItunes(term: string, limit = 15) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=${limit}&media=music`;
  let results: any[] = [];
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    results = data.results ?? [];
  } catch {
    return [];
  }

  const cached = [];
  for (const t of results) {
    if (!t.trackId || !t.artistId) continue;

    const artist = await prisma.externalArtist.upsert({
      where: { source_externalId: { source: "itunes", externalId: String(t.artistId) } },
      create: {
        source: "itunes",
        externalId: String(t.artistId),
        name: t.artistName,
        imageUrl: upsizeArtwork(t.artworkUrl100),
        genres: t.primaryGenreName ? [t.primaryGenreName] : [],
        popularity: 50,
        externalUrl: t.artistViewUrl ?? `https://music.apple.com/search?term=${encodeURIComponent(t.artistName)}`,
      },
      update: {},
    });

    const track = await prisma.externalTrack.upsert({
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
        popularity: 40,
        previewUrl: t.previewUrl,
        externalUrl: t.trackViewUrl ?? artist.externalUrl,
      },
      update: { previewUrl: t.previewUrl },
      include: { artist: true },
    });
    cached.push(track);
  }
  return cached;
}
