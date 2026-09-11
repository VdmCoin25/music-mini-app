function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const config = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  databaseUrl: required("DATABASE_URL"),
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  jwtSecret: required("JWT_SECRET", "dev-secret-change-me"),
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    region: process.env.S3_REGION ?? "us-east-1",
    bucket: process.env.S3_BUCKET ?? "music-app",
    accessKeyId: process.env.S3_ACCESS_KEY ?? "minioadmin",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "minioadmin",
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? "http://localhost:9000/music-app",
    forcePathStyle: true,
  },
  uploads: {
    maxAudioBytes: 50 * 1024 * 1024, // 50MB
    maxImageBytes: 8 * 1024 * 1024, // 8MB
    allowedAudioMime: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/flac", "audio/mp4"],
    allowedImageMime: ["image/png", "image/jpeg", "image/webp"],
  },
  playback: {
    minSecondsToCount: 30,
    minPercentToCount: 0.3,
  },
  admin: {
    // Telegram IDs that are auto-promoted to admin on first login.
    // Fill in via ADMIN_TELEGRAM_IDS="123456,654321"
    telegramIds: (process.env.ADMIN_TELEGRAM_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  },
  isProd: process.env.NODE_ENV === "production",
};
