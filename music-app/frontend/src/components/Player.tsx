import React, { useState } from "react";
import { usePlayer } from "../PlayerContext";
import { api } from "../api";

function formatTime(sec: number): string {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MiniPlayer() {
  const { current, isPlaying, togglePlay, progress } = usePlayer();
  const [expanded, setExpanded] = useState(false);

  if (!current) return null;

  return (
    <>
      <div className="mini-player" onClick={() => setExpanded(true)}>
        <img className="mini-player__cover" src={current.coverUrl ?? "/placeholder-cover.png"} alt="" />
        <div className="mini-player__info">
          <div className="mini-player__title">{current.title}</div>
          <div className="mini-player__artist">{current.artist?.nickname}</div>
        </div>
        <button
          className="mini-player__play"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <div className="mini-player__progress" style={{ width: `${(progress / (current.durationSec || 1)) * 100}%` }} />
      </div>
      {expanded && <FullScreenPlayer onClose={() => setExpanded(false)} />}
    </>
  );
}

function FullScreenPlayer({ onClose }: { onClose: () => void }) {
  const { current, isPlaying, togglePlay, progress, seek, next, previous, shuffle, repeat, toggleShuffle, toggleRepeat } =
    usePlayer();
  const [liked, setLiked] = useState(false);

  if (!current) return null;

  async function onLike() {
    setLiked((l) => !l);
    try {
      if (!liked) await api.like(current!.id);
      else await api.unlike(current!.id);
    } catch {
      setLiked((l) => !l); // revert on failure
    }
  }

  return (
    <div className="full-player">
      <button className="full-player__close" onClick={onClose}>
        ⌄
      </button>
      <img className="full-player__cover" src={current.coverUrl ?? "/placeholder-cover.png"} alt="" />
      <div className="full-player__title">{current.title}</div>
      <div className="full-player__artist">{current.artist?.nickname}</div>

      <input
        type="range"
        className="full-player__seek"
        min={0}
        max={current.durationSec || 0}
        value={progress}
        onChange={(e) => seek(Number(e.target.value))}
      />
      <div className="full-player__times">
        <span>{formatTime(progress)}</span>
        <span>{formatTime(current.durationSec)}</span>
      </div>

      <div className="full-player__controls">
        <button className={shuffle ? "active" : ""} onClick={toggleShuffle}>
          🔀
        </button>
        <button onClick={previous}>⏮</button>
        <button className="full-player__play" onClick={togglePlay}>
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button onClick={next}>⏭</button>
        <button className={repeat ? "active" : ""} onClick={toggleRepeat}>
          🔁
        </button>
      </div>

      <div className="full-player__actions">
        <button onClick={onLike}>{liked ? "❤️" : "🤍"} Like</button>
        <button
          onClick={() =>
            navigator.share?.({ title: current.title, url: `https://t.me/your_bot?start=track_${current.id}` })
          }
        >
          🔗 Share
        </button>
      </div>
    </div>
  );
}
