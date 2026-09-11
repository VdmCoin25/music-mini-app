import React from "react";
import { usePlayer, type Track } from "../PlayerContext";

export function TrackCard({ track, queue }: { track: Track; queue?: Track[] }) {
  const { playTrack, current, isPlaying, togglePlay } = usePlayer();
  const isCurrent = current?.id === track.id;

  function onPlayClick() {
    if (isCurrent) togglePlay();
    else playTrack(track, queue);
  }

  return (
    <div className={`track-card${isCurrent ? " active" : ""}`} onClick={onPlayClick}>
      <img className="track-card__cover" src={track.coverUrl ?? "/placeholder-cover.png"} alt="" loading="lazy" />
      <div className="track-card__info">
        <div className="track-card__title">{track.title}</div>
        <div className="track-card__artist">{track.artist?.nickname}</div>
      </div>
      <button className="track-card__play">{isCurrent && isPlaying ? "⏸" : "▶"}</button>
    </div>
  );
}

export function TrackCardSkeleton() {
  return (
    <div className="track-card skeleton">
      <div className="track-card__cover skeleton-box" />
      <div className="track-card__info">
        <div className="skeleton-box" style={{ width: "60%", height: 14 }} />
        <div className="skeleton-box" style={{ width: "40%", height: 12, marginTop: 6 }} />
      </div>
    </div>
  );
}
