import { Pool } from "pg";

export interface Lab {
  id: number;
  hospital_id: number;
  hospital_name: string;
  name: string;
  is_poc: boolean;
  created_at: Date;
}

export async function listLabs(db: Pool) {
  const result = await db.query<Lab>(
    `
    SELECT
      l.id,
      l.hospital_id,
      h.name AS hospital_name,
      l.name,
      l.is_poc,
      l.created_at
    FROM labs l
    INNER JOIN hospitals h ON h.id = l.hospital_id
    ORDER BY h.name ASC, l.name ASC
    `
  );

  return result.rows;
}

export async function createLab(
  db: Pool,
  hospitalId: number,
  name: string,
  isPoc: boolean
) {
  const result = await db.query<Lab>(
    `
    WITH inserted_lab AS (
      INSERT INTO labs (hospital_id, name, is_poc)
      VALUES ($1, $2, $3)
      RETURNING id, hospital_id, name, is_poc, created_at
    )
    SELECT
      inserted_lab.id,
      inserted_lab.hospital_id,
      h.name AS hospital_name,
      inserted_lab.name,
      inserted_lab.is_poc,
      inserted_lab.created_at
    FROM inserted_lab
    INNER JOIN hospitals h ON h.id = inserted_lab.hospital_id
    `,
    [hospitalId, name, isPoc]
  );

  return result.rows[0];
}

export async function findLabById(db: Pool, id: number) {
  const result = await db.query<Lab>(
    `
    SELECT
      l.id,
      l.hospital_id,
      h.name AS hospital_name,
      l.name,
      l.is_poc,
      l.created_at
    FROM labs l
    INNER JOIN hospitals h ON h.id = l.hospital_id
    WHERE l.id = $1
    `,
    [id]
  );

  return result.rows[0];
}

export async function updateLab(
  db: Pool,
  id: number,
  hospitalId: number,
  name: string,
  isPoc: boolean
) {
  const result = await db.query<Lab>(
    `
    WITH updated_lab AS (
      UPDATE labs
      SET hospital_id = $2, name = $3, is_poc = $4
      WHERE id = $1
      RETURNING id, hospital_id, name, is_poc, created_at
    )
    SELECT
      updated_lab.id,
      updated_lab.hospital_id,
      h.name AS hospital_name,
      updated_lab.name,
      updated_lab.is_poc,
      updated_lab.created_at
    FROM updated_lab
    INNER JOIN hospitals h ON h.id = updated_lab.hospital_id
    `,
    [id, hospitalId, name, isPoc]
  );

  return result.rows[0];
}

export async function deleteLab(db: Pool, id: number) {
  const result = await db.query<Lab>(
    `
    WITH deleted_lab AS (
      DELETE FROM labs
      WHERE id = $1
      RETURNING id, hospital_id, name, is_poc, created_at
    )
    SELECT
      deleted_lab.id,
      deleted_lab.hospital_id,
      h.name AS hospital_name,
      deleted_lab.name,
      deleted_lab.is_poc,
      deleted_lab.created_at
    FROM deleted_lab
    INNER JOIN hospitals h ON h.id = deleted_lab.hospital_id
    `,
    [id]
  );

  return result.rows[0];
}
