import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";

export interface Track {
  id: string;
  title: string;
  coverUrl?: string;
  audioUrl: string;
  durationSec: number;
  artist?: { nickname: string };
}

interface PlayerState {
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  progress: number; // seconds
  current: Track | null;
  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  shuffle: boolean;
  repeat: boolean;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
}

const PlayerCtx = createContext<PlayerState | null>(null);

// A session is "reported" (counts as a play) once, when the 30s/30% threshold
// is first crossed for the currently loaded track — see backend playback.ts
// for the authoritative anti-fraud check; this flag just avoids spamming
// the endpoint every render tick.
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const reportedRef = useRef(false);

  const current = currentIndex >= 0 ? queue[currentIndex] ?? null : null;

  function playTrack(track: Track, newQueue?: Track[]) {
    const q = newQueue ?? [track];
    const idx = q.findIndex((t) => t.id === track.id);
    setQueue(q);
    setCurrentIndex(idx === -1 ? 0 : idx);
  }

  function togglePlay() {
    if (!current) return;
    setIsPlaying((p) => !p);
  }

  function next() {
    if (queue.length === 0) return;
    if (shuffle) {
      setCurrentIndex(Math.floor(Math.random() * queue.length));
      return;
    }
    setCurrentIndex((i) => (i + 1) % queue.length);
  }

  function previous() {
    if (queue.length === 0) return;
    setCurrentIndex((i) => (i - 1 + queue.length) % queue.length);
  }

  function seek(seconds: number) {
    audioRef.current.currentTime = seconds;
    setProgress(seconds);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!current) return;
    reportedRef.current = false;
    audio.src = current.audioUrl;
    audio.currentTime = 0;
    setProgress(0);
    if (isPlaying) audio.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (isPlaying) audio.play().catch(() => {});
    else audio.pause();
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    function onTimeUpdate() {
      setProgress(audio.currentTime);
      if (!current) return;
      const percent = current.durationSec > 0 ? audio.currentTime / current.durationSec : 0;
      if (!reportedRef.current && (audio.currentTime >= 30 || percent >= 0.3)) {
        reportedRef.current = true;
        api.reportPlayback(current.id, Math.round(audio.currentTime)).catch(() => {});
      }
    }
    function onEnded() {
      if (!current) return;
      // Final report in case the threshold check above never fired (very short tracks).
      if (!reportedRef.current) {
        api.reportPlayback(current.id, current.durationSec).catch(() => {});
      }
      if (repeat) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        next();
      }
    }
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, repeat, shuffle, queue]);

  const value = useMemo<PlayerState>(
    () => ({
      queue,
      currentIndex,
      isPlaying,
      progress,
      current,
      playTrack,
      togglePlay,
      next,
      previous,
      seek,
      shuffle,
      repeat,
      toggleShuffle: () => setShuffle((s) => !s),
      toggleRepeat: () => setRepeat((r) => !r),
    }),
    [queue, currentIndex, isPlaying, progress, current, shuffle, repeat],
  );

  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}

export function usePlayer(): PlayerState {
  const ctx = useContext(PlayerCtx);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
