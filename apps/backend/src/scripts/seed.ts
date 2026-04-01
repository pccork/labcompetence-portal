import { Pool } from "pg";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seed() {
  const password = await bcrypt.hash("password123", 10);

  await pool.query(
    `
    INSERT INTO users (email, password, role)
    VALUES ($1, $2, $3)
    ON CONFLICT (email) DO NOTHING
    `,
    ["admin@test.com", password, "admin"]
  );

  console.log("Admin seeded (or already exists).");
  
  //  Seed labs
  await pool.query(
    `
    INSERT INTO labs (name)
    VALUES 
      ('Biochemistry'),
      ('Immunology')
    ON CONFLICT (name) DO NOTHING
    `
  );

  console.log("Labs seeded (or already exist).");
  

  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});