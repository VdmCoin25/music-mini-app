import { Bot, InlineKeyboard } from "grammy";

const token = process.env.TELEGRAM_BOT_TOKEN;
const miniAppUrl = process.env.MINI_APP_URL; // e.g. https://your-domain.com

if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");
if (!miniAppUrl) throw new Error("MINI_APP_URL is required (must be https:// in production)");

const bot = new Bot(token);

function mainKeyboard() {
  return new InlineKeyboard()
    .webApp("🎵 Open Music App", miniAppUrl!)
    .row()
    .webApp("👤 Profile", `${miniAppUrl}/profile`)
    .webApp("⬆️ Upload", `${miniAppUrl}/upload`);
}

// Deep links arrive as the start payload, e.g. /start track_<id>,
// profile_<nickname>, playlist_<id>, album_<id>, beat_<id>.
bot.command("start", async (ctx) => {
  const payload = ctx.match?.toString().trim();
  const match = payload?.match(/^(track|profile|playlist|album|beat)_(.+)$/);

  if (match) {
    const [, kind, id] = match;
    const path = kind === "profile" ? `/artist/${id}` : `/${kind}/${id}`;
    const kb = new InlineKeyboard().webApp("Open in Music App", `${miniAppUrl}${path}`);
    await ctx.reply("Tap below to open:", { reply_markup: kb });
    return;
  }

  await ctx.reply(
    "Welcome! This bot connects to the Music Mini App — upload tracks and beats, build playlists, and discover new music, all inside Telegram.",
    { reply_markup: mainKeyboard() },
  );
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    "/start — open the app\nJust tap a button below to jump straight to the app, your profile, or the upload screen.",
    { reply_markup: mainKeyboard() },
  );
});

bot.catch((err) => console.error("Bot error:", err));

bot.start();
console.log("Telegram bot started (long polling).");
