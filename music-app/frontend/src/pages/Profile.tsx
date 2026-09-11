import React, { useEffect, useState } from "react";
import { api } from "../api";
import { TrackCard } from "../components/TrackCard";

export function Profile() {
  const [me, setMe] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.me().then((u) => {
      setMe(u);
      setNickname(u.nickname);
      setBio(u.bio ?? "");
      api.profileTracks(u.id).then(setTracks);
    });
  }, []);

  async function save() {
    setSaving(true);
    try {
      const updated = await api.updateProfile({ nickname, bio });
      setMe(updated);
    } finally {
      setSaving(false);
    }
  }

  if (!me) return <div className="page">Loading...</div>;

  return (
    <div className="page profile-page">
      <div className="profile-header">
        <img src={me.avatarUrl ?? "/placeholder-cover.png"} alt="" className="profile-avatar" />
        <div>
          <input className="profile-nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          <textarea className="profile-bio" placeholder="Bio" value={bio} onChange={(e) => setBio(e.target.value)} />
          <button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <h2>My tracks</h2>
      {tracks.map((t) => (
        <TrackCard key={t.id} track={t} queue={tracks} />
      ))}
      {tracks.length === 0 && <div className="empty-state">You haven't uploaded anything yet</div>}
    </div>
  );
}
