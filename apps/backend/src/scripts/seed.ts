import { Pool } from "pg";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seed() {
  const password = await bcrypt.hash("password123", 10);

  const hospitalResult = await pool.query<{ id: number }>(
    `
    INSERT INTO hospitals (name)
    VALUES ($1)
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
    `,
    ["CUH"]
  );

  const hospitalId = hospitalResult.rows[0]?.id;

  if (!hospitalId) {
    throw new Error("Failed to seed default hospital");
  }

  await pool.query(
    `
    INSERT INTO users (hospital_id, name, email, password, role, staff_type)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (email) DO NOTHING
    `,
    [
      hospitalId,
      "Portal Admin",
      "admin@test.com",
      password,
      "admin",
      "training_coordinator",
    ]
  );

  console.log("Admin seeded (or already exists).");
  
  //  Seed labs
  await pool.query(
    `
    INSERT INTO labs (hospital_id, name, is_poc)
    VALUES 
      ($1, 'Biochemistry', false),
      ($1, 'Immunology', false),
      ($1, 'Point of Care', true)
    ON CONFLICT (hospital_id, name) DO NOTHING
    `,
    [hospitalId]
  );

  console.log("Labs seeded (or already exist).");
  

  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
