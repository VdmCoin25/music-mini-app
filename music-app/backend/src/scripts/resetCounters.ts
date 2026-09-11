/**
 * playsToday / playsWeek / playsMonth / playsYear are rolling counters that
 * must be zeroed out on a schedule from the OUTSIDE (cron, k8s CronJob, etc):
 *
 *   0 0 * * *      node dist/scripts/resetCounters.js today
 *   0 0 * * 1      node dist/scripts/resetCounters.js week
 *   0 0 1 * *      node dist/scripts/resetCounters.js month
 *   0 0 1 1 *      node dist/scripts/resetCounters.js year
 *
 * totalPlays and trendingScore are never reset — trendingScore is
 * recomputed continuously in services/trending.ts.
 */
import { prisma } from "../db.js";

const field = process.argv[2];
const fieldMap: Record<string, "playsToday" | "playsWeek" | "playsMonth" | "playsYear"> = {
  today: "playsToday",
  week: "playsWeek",
  month: "playsMonth",
  year: "playsYear",
};

async function main() {
  const column = fieldMap[field];
  if (!column) {
    console.error(`Usage: resetCounters.ts <today|week|month|year>`);
    process.exit(1);
  }
  const result = await prisma.track.updateMany({ data: { [column]: 0 } });
  console.log(`Reset ${column} for ${result.count} tracks`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
