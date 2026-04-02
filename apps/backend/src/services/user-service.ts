import bcrypt from "bcrypt";
import { Pool } from "pg";
import { Role } from "shared-types";

export interface User {
  id?: number;
  email: string;
  password: string;
  role: Role;
}

export interface SafeUser {
  id: number;
  email: string;
  role: Role;
  created_at: Date;
}

export async function createUser(
  db: Pool,
  email: string,
  password: string,
  role: Role
) {
  const hashed = await bcrypt.hash(password, 10);

  const result = await db.query<SafeUser>(
    `
    INSERT INTO users (email, password, role)
    VALUES ($1, $2, $3)
    RETURNING id, email, role, created_at
    `,
    [email, hashed, role]
  );

  return result.rows[0];
}

export async function findUserByEmail(db: Pool, email: string) {
  const result = await db.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  return result.rows[0];
}

export async function findUserById(db: Pool, id: number) {
  const result = await db.query<SafeUser>(
    "SELECT id, email, role, created_at FROM users WHERE id = $1",
    [id]
  );

  return result.rows[0];
}

export async function listUsers(db: Pool) {
  const result = await db.query<SafeUser>(
    "SELECT id, email, role, created_at FROM users ORDER BY created_at ASC"
  );

  return result.rows;
}

export async function updateUser(
  db: Pool,
  id: number,
  email: string,
  role: Role
) {
  const result = await db.query<SafeUser>(
    `
    UPDATE users
    SET email = $2, role = $3
    WHERE id = $1
    RETURNING id, email, role, created_at
    `,
    [id, email, role]
  );

  return result.rows[0];
}

export async function deleteUser(db: Pool, id: number) {
  const result = await db.query<SafeUser>(
    `
    DELETE FROM users
    WHERE id = $1
    RETURNING id, email, role, created_at
    `,
    [id]
  );

  return result.rows[0];
}

export async function updateUserPassword(
  db: Pool,
  id: number,
  password: string
) {
  const hashed = await bcrypt.hash(password, 10);

  const result = await db.query<SafeUser>(
    `
    UPDATE users
    SET password = $2
    WHERE id = $1
    RETURNING id, email, role, created_at
    `,
    [id, hashed]
  );

  return result.rows[0];
}
