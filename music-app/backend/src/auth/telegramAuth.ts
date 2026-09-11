import { createHash, createHmac } from "node:crypto";
import { config } from "../config.js";

export interface TelegramUserData {
  id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
}

export interface ValidatedInitData {
  user: TelegramUserData;
  authDate: number;
}

/**
 * Validates Telegram Mini App `initData` string according to
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * NEVER trust a telegram_id sent as a plain client field — this is the only
 * source of truth for "who is making this request".
 */
export function validateTelegramInitData(initData: string, maxAgeSeconds = 86400): ValidatedInitData {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    throw new Error("initData missing hash");
  }
  params.delete("hash");

  const dataCheckArr: string[] = [];
  for (const [key, value] of [...params.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    dataCheckArr.push(`${key}=${value}`);
  }
  const dataCheckString = dataCheckArr.join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(config.telegramBotToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computedHash !== hash) {
    throw new Error("initData signature is invalid");
  }

  const authDate = parseInt(params.get("auth_date") ?? "0", 10);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || now - authDate > maxAgeSeconds) {
    throw new Error("initData is expired");
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    throw new Error("initData missing user");
  }
  const userJson = JSON.parse(userRaw);
  if (!userJson.id) {
    throw new Error("initData user missing id");
  }

  return {
    user: {
      id: String(userJson.id),
      username: userJson.username,
      first_name: userJson.first_name,
      last_name: userJson.last_name,
      photo_url: userJson.photo_url,
    },
    authDate,
  };
}

/** Deterministic short hash, only used to build fallback nicknames. */
export function shortHash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 6);
}
