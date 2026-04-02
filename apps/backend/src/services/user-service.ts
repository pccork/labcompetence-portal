import bcrypt from "bcrypt";
import { Pool } from "pg";
import { Role } from "shared-types";

export interface User {
  id?: number;
  hospital_id: number;
  name: string;
  email: string;
  password: string;
  role: Role;
}

export interface SafeUser {
  id: number;
  hospital_id: number;
  hospital_name: string;
  name: string;
  email: string;
  role: Role;
  created_at: Date;
}

export async function createUser(
  db: Pool,
  hospitalId: number,
  name: string,
  email: string,
  password: string,
  role: Role
) {
  const hashed = await bcrypt.hash(password, 10);

  const result = await db.query<SafeUser>(
    `
    WITH inserted_user AS (
      INSERT INTO users (hospital_id, name, email, password, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, hospital_id, name, email, role, created_at
    )
    SELECT
      inserted_user.id,
      inserted_user.hospital_id,
      h.name AS hospital_name,
      inserted_user.name,
      inserted_user.email,
      inserted_user.role,
      inserted_user.created_at
    FROM inserted_user
    INNER JOIN hospitals h ON h.id = inserted_user.hospital_id
    `,
    [hospitalId, name, email, hashed, role]
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
    `
    SELECT
      u.id,
      u.hospital_id,
      h.name AS hospital_name,
      u.name,
      u.email,
      u.role,
      u.created_at
    FROM users u
    INNER JOIN hospitals h ON h.id = u.hospital_id
    WHERE u.id = $1
    `,
    [id]
  );

  return result.rows[0];
}

export async function listUsers(db: Pool, hospitalId?: number) {
  const result = await db.query<SafeUser>(
    `
    SELECT
      u.id,
      u.hospital_id,
      h.name AS hospital_name,
      u.name,
      u.email,
      u.role,
      u.created_at
    FROM users u
    INNER JOIN hospitals h ON h.id = u.hospital_id
    WHERE ($1::int IS NULL OR u.hospital_id = $1)
    ORDER BY h.name ASC, u.name ASC
    `,
    [hospitalId ?? null]
  );

  return result.rows;
}

export async function updateUser(
  db: Pool,
  id: number,
  hospitalId: number,
  name: string,
  email: string,
  role: Role
) {
  const result = await db.query<SafeUser>(
    `
    WITH updated_user AS (
      UPDATE users
      SET hospital_id = $2, name = $3, email = $4, role = $5
      WHERE id = $1
      RETURNING id, hospital_id, name, email, role, created_at
    )
    SELECT
      updated_user.id,
      updated_user.hospital_id,
      h.name AS hospital_name,
      updated_user.name,
      updated_user.email,
      updated_user.role,
      updated_user.created_at
    FROM updated_user
    INNER JOIN hospitals h ON h.id = updated_user.hospital_id
    `,
    [id, hospitalId, name, email, role]
  );

  return result.rows[0];
}

export async function deleteUser(db: Pool, id: number) {
  const result = await db.query<SafeUser>(
    `
    WITH deleted_user AS (
      DELETE FROM users
      WHERE id = $1
      RETURNING id, hospital_id, name, email, role, created_at
    )
    SELECT
      deleted_user.id,
      deleted_user.hospital_id,
      h.name AS hospital_name,
      deleted_user.name,
      deleted_user.email,
      deleted_user.role,
      deleted_user.created_at
    FROM deleted_user
    INNER JOIN hospitals h ON h.id = deleted_user.hospital_id
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
    WITH updated_user AS (
      UPDATE users
      SET password = $2
      WHERE id = $1
      RETURNING id, hospital_id, name, email, role, created_at
    )
    SELECT
      updated_user.id,
      updated_user.hospital_id,
      h.name AS hospital_name,
      updated_user.name,
      updated_user.email,
      updated_user.role,
      updated_user.created_at
    FROM updated_user
    INNER JOIN hospitals h ON h.id = updated_user.hospital_id
    `,
    [id, hashed]
  );

  return result.rows[0];
}
