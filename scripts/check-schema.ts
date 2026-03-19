import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function check() {
  // Check if intelPinSnapshots table exists
  const tables = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'intel_pin_snapshots'
  `);
  console.log("intel_pin_snapshots table exists:", tables.length > 0);

  // Check if new columns exist on intel_pins
  const cols = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'intel_pins' AND column_name IN (
      'instant_velocity', 'acceleration', 'baseline_multiple',
      'trend_direction', 'previous_saves', 'previous_snapshot_at'
    )
  `);
  console.log("New columns on intel_pins:", cols.map((r: any) => r.column_name));
  process.exit(0);
}
check();
