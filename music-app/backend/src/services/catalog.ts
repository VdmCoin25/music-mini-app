// Local tracks and imported external (Spotify) tracks are stored in
// different tables with different fields. The frontend player and cards
// expect one consistent shape — this file is the single place that builds it.

export function normalizeLocalTrack(t: any) {
  return {
    id: t.id,
    isExternal: false,
    title: t.title,
    coverUrl: t.coverUrl,
    audioUrl: t.audioUrl,
    durationSec: t.durationSec,
    totalPlays: t.totalPlays,
    trendingScore: t.trendingScore,
    createdAt: t.createdAt,
    genre: t.genre ?? null,
    description: t.description,
    artist: t.artist
      ? { id: t.artist.id, nickname: t.artist.nickname, avatarUrl: t.artist.avatarUrl }
      : undefined,
  };
}

export function normalizeExternalTrack(t: any) {
  return {
    id: t.id,
    isExternal: true,
    title: t.title,
    coverUrl: t.coverUrl,
    // No audioUrl unless Spotify gave us an official preview clip — the
    // frontend falls back to an "Open in Spotify" button when this is null.
    audioUrl: t.previewUrl ?? undefined,
    durationSec: Math.round(t.durationMs / 1000),
    totalPlays: t.popularity * 100, // rough sort-comparable proxy, not a real play count
    trendingScore: t.popularity,
    createdAt: t.createdAt,
    genre: t.genre ? { id: t.genre, name: t.genre } : null,
    externalUrl: t.externalUrl,
    source: t.source,
    album: t.album,
    artist: t.artist
      ? { id: t.artist.id, nickname: t.artist.name, avatarUrl: t.artist.imageUrl, isExternal: true }
      : undefined,
  };
}
