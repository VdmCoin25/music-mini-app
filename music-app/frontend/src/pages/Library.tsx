import React, { useEffect, useState } from "react";
import { api } from "../api";
import { TrackCard } from "../components/TrackCard";

type Tab = "liked" | "saved" | "playlists" | "history";

export function Library() {
  const [tab, setTab] = useState<Tab>("liked");
  const [tracks, setTracks] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");

  useEffect(() => {
    if (tab === "liked") api.library.liked().then(setTracks);
    else if (tab === "saved") api.library.saved().then(setTracks);
    else if (tab === "history") api.library.history().then(setTracks);
    else if (tab === "playlists") api.library.playlists().then(setPlaylists);
  }, [tab]);

  async function createPlaylist() {
    if (!newPlaylistTitle.trim()) return;
    const p = await api.playlists.create(newPlaylistTitle.trim());
    setPlaylists((prev) => [p, ...prev]);
    setNewPlaylistTitle("");
  }

  return (
    <div className="page library-page">
      <h1>My Music</h1>
      <div className="tabs">
        {(["liked", "saved", "playlists", "history"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t === "liked" ? "Liked" : t === "saved" ? "Saved" : t === "playlists" ? "Playlists" : "Recently played"}
          </button>
        ))}
      </div>

      {tab === "playlists" ? (
        <>
          <div className="playlist-create">
            <input
              placeholder="New playlist name"
              value={newPlaylistTitle}
              onChange={(e) => setNewPlaylistTitle(e.target.value)}
            />
            <button onClick={createPlaylist}>Create</button>
          </div>
          {playlists.map((p) => (
            <div key={p.id} className="playlist-row">
              {p.title} {p.isPublic ? "" : "🔒"}
            </div>
          ))}
          {playlists.length === 0 && <div className="empty-state">No playlists yet</div>}
        </>
      ) : (
        <>
          {tracks.map((t) => (
            <TrackCard key={t.id} track={t} queue={tracks} />
          ))}
          {tracks.length === 0 && <div className="empty-state">Nothing here yet</div>}
        </>
      )}
    </div>
  );
}
