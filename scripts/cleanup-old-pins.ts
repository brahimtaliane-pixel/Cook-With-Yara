import { db } from "@/lib/db";
import { intelPins } from "@/lib/db/schema";
import { lt, isNull, or, count } from "drizzle-orm";

async function main() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  // Count what we'll delete
  const [before] = await db.select({ count: count() }).from(intelPins)
    .where(or(
      lt(intelPins.pinCreatedAt, cutoff),
      isNull(intelPins.pinCreatedAt),
    ));
  console.log(`Pins older than 30 days or with null date: ${before.count}`);

  // Delete them
  await db.delete(intelPins).where(or(
    lt(intelPins.pinCreatedAt, cutoff),
    isNull(intelPins.pinCreatedAt),
  ));
  console.log("Deleted.");

  const [after] = await db.select({ count: count() }).from(intelPins);
  console.log(`Remaining pins: ${after.count}`);

  process.exit(0);
}
main();
