import React, { useEffect, useState } from "react";
import { api } from "../api";
import { TrackCard } from "../components/TrackCard";

export function Search() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any>({ tracks: [], artists: [], albums: [], beats: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length === 0) {
      setResults({ tracks: [], artists: [], albums: [], beats: [] });
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      api
        .search(q)
        .then(setResults)
        .finally(() => setLoading(false));
    }, 300); // debounce
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <div className="page search-page">
      <input
        className="search-input"
        placeholder="Search tracks, artists, albums, beats..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {loading && <div className="empty-state">Searching...</div>}
      {!loading && results.tracks.length > 0 && (
        <section>
          <h2>Tracks</h2>
          {results.tracks.map((t: any) => (
            <TrackCard key={t.id} track={t} queue={results.tracks} />
          ))}
        </section>
      )}
      {!loading && results.artists?.length > 0 && (
        <section>
          <h2>Artists</h2>
          {results.artists.map((a: any) => (
            <div key={a.id} className="artist-row">
              <img src={a.avatarUrl ?? "/placeholder-cover.png"} alt="" />
              <span>{a.nickname}</span>
            </div>
          ))}
        </section>
      )}
      {!loading && q && results.tracks.length === 0 && results.artists?.length === 0 && (
        <div className="empty-state">No results for "{q}"</div>
      )}
    </div>
  );
}
