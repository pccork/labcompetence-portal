import bcrypt from "bcrypt";
import { Pool } from "pg";
import { Role } from "shared-types";

export interface User {
  id?: number;
  email: string;
  password: string;
  role: Role;
}

export async function createUser(
  db: Pool,
  email: string,
  password: string,
  role: Role
) {
  const hashed = await bcrypt.hash(password, 10);

  await db.query(
    "INSERT INTO users (email, password, role) VALUES ($1, $2, $3)",
    [email, hashed, role]
  );
}

export async function findUserByEmail(db: Pool, email: string) {
  const result = await db.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  return result.rows[0];
}