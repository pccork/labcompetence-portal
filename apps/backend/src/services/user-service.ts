import bcrypt from "bcrypt";
import { Pool } from "pg";
import { Role } from "shared-types";

export interface User {
  id?: number;
  name: string;
  email: string;
  password: string;
  role: Role;
}

export interface SafeUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  created_at: Date;
}

export async function createUser(
  db: Pool,
  name: string,
  email: string,
  password: string,
  role: Role
) {
  const hashed = await bcrypt.hash(password, 10);

  const result = await db.query<SafeUser>(
    `
    INSERT INTO users (name, email, password, role)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, email, role, created_at
    `,
    [name, email, hashed, role]
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
    "SELECT id, name, email, role, created_at FROM users WHERE id = $1",
    [id]
  );

  return result.rows[0];
}

export async function listUsers(db: Pool) {
  const result = await db.query<SafeUser>(
    "SELECT id, name, email, role, created_at FROM users ORDER BY created_at ASC"
  );

  return result.rows;
}

export async function updateUser(
  db: Pool,
  id: number,
  name: string,
  email: string,
  role: Role
) {
  const result = await db.query<SafeUser>(
    `
    UPDATE users
    SET name = $2, email = $3, role = $4
    WHERE id = $1
    RETURNING id, name, email, role, created_at
    `,
    [id, name, email, role]
  );

  return result.rows[0];
}

export async function deleteUser(db: Pool, id: number) {
  const result = await db.query<SafeUser>(
    `
    DELETE FROM users
    WHERE id = $1
    RETURNING id, name, email, role, created_at
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
    RETURNING id, name, email, role, created_at
    `,
    [id, hashed]
  );

  return result.rows[0];
}
