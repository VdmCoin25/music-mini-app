// Thin wrapper around the Telegram WebApp JS bridge (loaded via the
// <script src="https://telegram.org/js/telegram-web-app.js"> tag in index.html).

interface TelegramWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  BackButton: { show: () => void; hide: () => void; onClick: (cb: () => void) => void };
  MainButton: { show: () => void; hide: () => void; setText: (t: string) => void; onClick: (cb: () => void) => void };
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function getInitData(): string {
  const tg = getTelegramWebApp();
  if (tg?.initData) return tg.initData;
  // Local dev fallback so you can work on the UI outside Telegram.
  // NEVER ship this fallback's data as real auth — the backend will reject
  // a fake initData signature anyway, since it validates the HMAC.
  return import.meta.env.VITE_DEV_INIT_DATA ?? "";
}

export function initTelegram(): void {
  const tg = getTelegramWebApp();
  tg?.ready();
  tg?.expand();
}
