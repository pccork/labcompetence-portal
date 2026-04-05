import dotenv from "dotenv";
import { Pool } from "pg";

import { exportPrivateSeedSnapshot } from "../services/private-seed-sync-service";

dotenv.config();

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const result = await exportPrivateSeedSnapshot(pool);

    console.log(
      `Private seed exported to ${result.filePath} (${result.exportedUserCount} users, ${result.exportedTemplateCount} templates).`,
    );
  } finally {
    await pool.end();
  }
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
