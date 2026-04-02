import { Pool } from "pg";

export interface Lab {
  id: number;
  name: string;
  created_at: Date;
}

export async function listLabs(db: Pool) {
  const result = await db.query<Lab>(
    "SELECT id, name, created_at FROM labs ORDER BY name ASC"
  );

  return result.rows;
}

export async function createLab(db: Pool, name: string) {
  const result = await db.query<Lab>(
    `
    INSERT INTO labs (name)
    VALUES ($1)
    RETURNING id, name, created_at
    `,
    [name]
  );

  return result.rows[0];
}

export async function findLabById(db: Pool, id: number) {
  const result = await db.query<Lab>(
    "SELECT id, name, created_at FROM labs WHERE id = $1",
    [id]
  );

  return result.rows[0];
}

export async function updateLab(
  db: Pool,
  id: number,
  name: string
) {
  const result = await db.query<Lab>(
    `
    UPDATE labs
    SET name = $2
    WHERE id = $1
    RETURNING id, name, created_at
    `,
    [id, name]
  );

  return result.rows[0];
}

export async function deleteLab(db: Pool, id: number) {
  const result = await db.query<Lab>(
    `
    DELETE FROM labs
    WHERE id = $1
    RETURNING id, name, created_at
    `,
    [id]
  );

  return result.rows[0];
}
