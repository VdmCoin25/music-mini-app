import { getInitData } from "./telegram";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

let authToken: string | null = sessionStorage.getItem("session_token_memory") ?? null;
// Note: for a production build prefer keeping the token in memory only and
// re-authenticating via Telegram initData on each app open, since initData
// is already available for free and short-lived tokens reduce risk.

export function setAuthToken(token: string) {
  authToken = token;
  sessionStorage.setItem("session_token_memory", token);
}

export function getAuthToken(): string | null {
  return authToken ?? sessionStorage.getItem("session_token_memory");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!(options.body instanceof FormData) && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `request_failed_${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  loginWithTelegram: () =>
    request<{ token: string; user: any }>("/auth/telegram", {
      method: "POST",
      body: JSON.stringify({ initData: getInitData() }),
    }),
  me: () => request<any>("/users/me"),
  updateProfile: (data: { nickname?: string; bio?: string }) =>
    request<any>("/users/me", { method: "PATCH", body: JSON.stringify(data) }),

  home: {
    newReleases: (type: "all" | "albums" | "beats" = "all") => request<any[]>(`/releases/new?type=${type}`),
    trending: () => request<any[]>("/trending"),
    chart: (period: string) => request<any[]>(`/charts/tracks?period=${period}`),
    genres: () => request<any[]>("/genres"),
  },

  track: (id: string) => request<any>(`/tracks/${id}`),
  similarTracks: (id: string) => request<any[]>(`/tracks/${id}/similar`),
  like: (id: string) => request<any>(`/tracks/${id}/like`, { method: "POST" }),
  unlike: (id: string) => request<any>(`/tracks/${id}/like`, { method: "DELETE" }),
  favorite: (id: string) => request<any>(`/tracks/${id}/favorite`, { method: "POST" }),
  unfavorite: (id: string) => request<any>(`/tracks/${id}/favorite`, { method: "DELETE" }),
  reportPlayback: (trackId: string, playedSeconds: number) =>
    request<any>("/playback/report", { method: "POST", body: JSON.stringify({ trackId, playedSeconds }) }),

  search: (q: string) => request<any>(`/search?q=${encodeURIComponent(q)}`),

  library: {
    liked: () => request<any[]>("/library/liked"),
    saved: () => request<any[]>("/library/saved"),
    history: () => request<any[]>("/library/history"),
    playlists: () => request<any[]>("/library/playlists"),
    followingFeed: () => request<any[]>("/library/following-feed"),
  },

  playlists: {
    create: (title: string, isPublic = true) =>
      request<any>("/playlists", { method: "POST", body: JSON.stringify({ title, isPublic }) }),
    get: (id: string) => request<any>(`/playlists/${id}`),
    addTrack: (id: string, trackId: string) =>
      request<any>(`/playlists/${id}/tracks`, { method: "POST", body: JSON.stringify({ trackId }) }),
    removeTrack: (id: string, trackId: string) => request<any>(`/playlists/${id}/tracks/${trackId}`, { method: "DELETE" }),
  },

  follow: (userId: string) => request<any>(`/users/${userId}/follow`, { method: "POST" }),
  unfollow: (userId: string) => request<any>(`/users/${userId}/follow`, { method: "DELETE" }),
  profile: (idOrNickname: string) => request<any>(`/users/${idOrNickname}`),
  profileTracks: (id: string) => request<any[]>(`/users/${id}/tracks`),

  beats: {
    list: (params: Record<string, string>) => request<any[]>(`/beats?${new URLSearchParams(params)}`),
    get: (id: string) => request<any>(`/beats/${id}`),
  },

  uploadTrack: (form: FormData) => request<any>("/uploads/track", { method: "POST", body: form }),
  uploadBeat: (form: FormData) => request<any>("/uploads/beat", { method: "POST", body: form }),

  admin: {
    overview: () => request<any>("/admin/overview"),
    users: (search = "") => request<any[]>(`/admin/users?search=${encodeURIComponent(search)}`),
    blockUser: (id: string) => request<any>(`/admin/users/${id}/block`, { method: "POST" }),
    unblockUser: (id: string) => request<any>(`/admin/users/${id}/unblock`, { method: "POST" }),
    tracks: (search = "") => request<any[]>(`/admin/tracks?search=${encodeURIComponent(search)}`),
    hideTrack: (id: string) => request<any>(`/admin/tracks/${id}/hide`, { method: "POST" }),
    reports: () => request<any[]>("/admin/reports"),
    resolveReport: (id: string) => request<any>(`/admin/reports/${id}/resolve`, { method: "POST" }),
  },
};
