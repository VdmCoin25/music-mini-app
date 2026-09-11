import React, { useEffect, useState } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { api, setAuthToken } from "./api";
import { initTelegram } from "./telegram";
import { PlayerProvider } from "./PlayerContext";
import { BottomNav } from "./components/BottomNav";
import { MiniPlayer } from "./components/Player";
import { Home } from "./pages/Home";
import { Search } from "./pages/Search";
import { Library } from "./pages/Library";
import { Upload } from "./pages/Upload";
import { Profile } from "./pages/Profile";

type AuthState = "loading" | "ready" | "error";

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");

  useEffect(() => {
    initTelegram();
    api
      .loginWithTelegram()
      .then(({ token }) => {
        setAuthToken(token);
        setAuthState("ready");
      })
      .catch(() => setAuthState("error"));
  }, []);

  if (authState === "loading") {
    return <div className="full-screen-center">Loading...</div>;
  }
  if (authState === "error") {
    return (
      <div className="full-screen-center">
        Couldn't sign you in. Please reopen the app from Telegram.
      </div>
    );
  }

  return (
    <PlayerProvider>
      <HashRouter>
        <div className="app-shell">
          <div className="app-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/search" element={<Search />} />
              <Route path="/library" element={<Library />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </div>
          <MiniPlayer />
          <BottomNav />
        </div>
      </HashRouter>
    </PlayerProvider>
  );
}
