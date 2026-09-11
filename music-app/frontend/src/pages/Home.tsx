import React, { useEffect, useState } from "react";
import { api } from "../api";
import { TrackCard, TrackCardSkeleton } from "../components/TrackCard";
import type { Track } from "../PlayerContext";

function Section({ title, tracks, loading }: { title: string; tracks: Track[]; loading: boolean }) {
  return (
    <section className="home-section">
      <h2>{title}</h2>
      <div className="home-section__row">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <TrackCardSkeleton key={i} />)
          : tracks.map((t) => <TrackCard key={t.id} track={t} queue={tracks} />)}
        {!loading && tracks.length === 0 && <div className="empty-state">Nothing here yet</div>}
      </div>
    </section>
  );
}

export function Home() {
  const [newReleases, setNewReleases] = useState<Track[]>([]);
  const [trending, setTrending] = useState<Track[]>([]);
  const [topWeek, setTopWeek] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.home.newReleases(), api.home.trending(), api.home.chart("week")])
      .then(([nr, tr, tw]) => {
        setNewReleases(nr);
        setTrending(tr);
        setTopWeek(tw);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page home-page">
      <h1>Home</h1>
      <Section title="🔥 Trending" tracks={trending} loading={loading} />
      <Section title="🆕 New releases" tracks={newReleases} loading={loading} />
      <Section title="📈 Top this week" tracks={topWeek} loading={loading} />
    </div>
  );
}
