import { Pool } from "pg";

export interface Hospital {
  id: number;
  name: string;
  created_at: Date;
}

export async function listHospitals(db: Pool, hospitalId?: number) {
  const result = await db.query<Hospital>(
    `
    SELECT id, name, created_at
    FROM hospitals
    WHERE ($1::int IS NULL OR id = $1)
    ORDER BY name ASC
    `,
    [hospitalId ?? null]
  );

  return result.rows;
}

export async function findHospitalById(db: Pool, id: number) {
  const result = await db.query<Hospital>(
    "SELECT id, name, created_at FROM hospitals WHERE id = $1",
    [id]
  );

  return result.rows[0];
}

export async function createHospital(db: Pool, name: string) {
  const result = await db.query<Hospital>(
    `
    INSERT INTO hospitals (name)
    VALUES ($1)
    RETURNING id, name, created_at
    `,
    [name]
  );

  return result.rows[0];
}

export async function updateHospital(
  db: Pool,
  id: number,
  name: string
) {
  const result = await db.query<Hospital>(
    `
    UPDATE hospitals
    SET name = $2
    WHERE id = $1
    RETURNING id, name, created_at
    `,
    [id, name]
  );

  return result.rows[0];
}

export async function deleteHospital(db: Pool, id: number) {
  const result = await db.query<Hospital>(
    `
    DELETE FROM hospitals
    WHERE id = $1
    RETURNING id, name, created_at
    `,
    [id]
  );

  return result.rows[0];
}
