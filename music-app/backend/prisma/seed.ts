import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Public-domain / royalty-free placeholder assets — replace with your own
// storage URLs after uploading real demo tracks. These are NOT commercial
// music and exist only so the app doesn't look empty on first run.
const PLACEHOLDER_AUDIO = "https://example-music-app-assets.local/demo/placeholder.mp3";
const PLACEHOLDER_COVER = "https://example-music-app-assets.local/demo/placeholder-cover.jpg";

async function main() {
  console.log("Seeding genres...");
  const genreNames = ["Rap", "Hip-Hop", "Trap", "Drill", "R&B", "Pop", "Rock", "Electronic", "Lo-Fi", "Phonk", "Jazz", "Classical"];
  const genres = await Promise.all(
    genreNames.map((name) => prisma.genre.upsert({ where: { name }, create: { name }, update: {} })),
  );

  console.log("Seeding demo users...");
  const users = await Promise.all(
    ["demo_artist_1", "demo_artist_2", "demo_producer_1", "demo_listener_1"].map((nickname, i) =>
      prisma.user.upsert({
        where: { telegramId: `demo-${i}` },
        create: {
          telegramId: `demo-${i}`,
          telegramUsername: nickname,
          telegramFirstName: nickname,
          nickname,
          bio: "Demo seed account",
          avatarUrl: PLACEHOLDER_COVER,
          isAdmin: i === 0,
        },
        update: {},
      }),
    ),
  );
  const [artist1, artist2, producer1] = users;

  console.log("Seeding tracks...");
  const trackTitles = ["Midnight Drive", "Neon Skies", "Slow Burn", "Static Love", "Golden Hour"];
  for (let i = 0; i < trackTitles.length; i++) {
    await prisma.track.create({
      data: {
        title: trackTitles[i],
        artistId: i % 2 === 0 ? artist1.id : artist2.id,
        genreId: genres[i % genres.length].id,
        audioUrl: PLACEHOLDER_AUDIO,
        coverUrl: PLACEHOLDER_COVER,
        durationSec: 180 + i * 12,
        totalPlays: (5 - i) * 137,
        playsToday: (5 - i) * 4,
        playsWeek: (5 - i) * 22,
        playsMonth: (5 - i) * 60,
        playsYear: (5 - i) * 137,
        uniqueListeners: (5 - i) * 40,
        trendingScore: (5 - i) * 10,
      },
    });
  }

  console.log("Seeding beats...");
  const beatTitles = ["Dark Trap Loop", "Drill Bounce", "Lo-Fi Chill", "Phonk Drift"];
  for (let i = 0; i < beatTitles.length; i++) {
    await prisma.beat.create({
      data: {
        title: beatTitles[i],
        producerId: producer1.id,
        audioUrl: PLACEHOLDER_AUDIO,
        coverUrl: PLACEHOLDER_COVER,
        bpm: 120 + i * 10,
        key: ["Am", "Cm", "Gm", "Em"][i],
        genre: ["Trap", "Drill", "Lo-Fi", "Phonk"][i],
        mood: "Dark",
        durationSec: 90,
        licenseType: i % 2 === 0 ? "FREE" : "PAID",
        priceCents: i % 2 === 0 ? null : 2500,
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
