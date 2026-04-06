import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const DEMO_PASSWORD = "Biochem20173!";
const DEMO_EMAIL_PATTERNS = [
  "%@example.test",
  "%@test.com",
  "%@test.local",
  "%@demo.local",
] as const;
const EXPLICIT_DEMO_EMAILS = ["admin@test.com"] as const;

async function resetDemoPasswords() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const result = await pool.query<{
    email: string;
    is_global_admin: boolean;
  }>(
    `
    UPDATE users
    SET password = $1
    WHERE is_active = true
      AND (
        lower(email) = ANY($2::text[])
        OR lower(email) LIKE ANY($3::text[])
      )
      AND lower(email) NOT LIKE '%@hse.ie'
      AND lower(email) NOT LIKE '%@health.gov.ie'
      AND lower(email) NOT LIKE '%@gmail.com'
      AND lower(email) NOT LIKE '%@outlook.com'
      AND lower(email) NOT LIKE '%@hotmail.com'
      AND lower(email) NOT LIKE '%@live.com'
      AND lower(email) NOT LIKE '%@yahoo.com'
      AND lower(email) NOT LIKE '%@icloud.com'
      AND is_active = true
    RETURNING email, is_global_admin
    `,
    [
      passwordHash,
      EXPLICIT_DEMO_EMAILS.map((email) => email.toLowerCase()),
      DEMO_EMAIL_PATTERNS.map((pattern) => pattern.toLowerCase()),
    ]
  );

  if (result.rowCount === 0) {
    console.log("No active demo users were found to update.");
    return;
  }

  console.log(
    `Updated ${result.rowCount} demo user password(s) to ${DEMO_PASSWORD}.`
  );
  console.table(result.rows);
}

resetDemoPasswords()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
