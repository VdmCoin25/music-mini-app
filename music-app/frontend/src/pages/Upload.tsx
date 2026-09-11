import React, { useState } from "react";
import { api } from "../api";

export function Upload() {
  const [kind, setKind] = useState<"track" | "beat">("track");
  const [title, setTitle] = useState("");
  const [audio, setAudio] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [bpm, setBpm] = useState("120");
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!audio || !title.trim()) return;
    setStatus("uploading");
    const form = new FormData();
    form.append("title", title.trim());
    form.append("audio", audio);
    if (cover) form.append("cover", cover);
    if (kind === "beat") form.append("bpm", bpm);

    try {
      if (kind === "track") await api.uploadTrack(form);
      else await api.uploadBeat(form);
      setStatus("done");
      setTitle("");
      setAudio(null);
      setCover(null);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="page upload-page">
      <h1>Upload</h1>
      <div className="tabs">
        <button className={kind === "track" ? "active" : ""} onClick={() => setKind("track")}>
          Track
        </button>
        <button className={kind === "beat" ? "active" : ""} onClick={() => setKind("beat")}>
          Beat
        </button>
      </div>

      <form onSubmit={onSubmit} className="upload-form">
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        {kind === "beat" && (
          <label>
            BPM
            <input type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} required />
          </label>
        )}

        <label>
          Audio file
          <input type="file" accept="audio/*" onChange={(e) => setAudio(e.target.files?.[0] ?? null)} required />
        </label>

        <label>
          Cover (optional)
          <input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
        </label>

        <button type="submit" disabled={status === "uploading"}>
          {status === "uploading" ? "Uploading..." : "Publish"}
        </button>

        {status === "done" && <div className="success-state">Published!</div>}
        {status === "error" && <div className="error-state">Upload failed — check the file and try again.</div>}
      </form>
    </div>
  );
}
