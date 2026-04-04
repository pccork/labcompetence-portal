import { Pool } from "pg";

import { Lab } from "./lab-service";

export async function listLabsForUser(
  db: Pool,
  userId: number,
  trainingUnitIds?: number[]
) {
  const result = await db.query<Lab>(
    `
    SELECT
      tu.id,
      l.id AS department_id,
      l.name AS department_name,
      l.hospital_id,
      h.name AS hospital_name,
      tu.name,
      l.is_poc,
      tu.created_at
    FROM training_units tu
    INNER JOIN labs l ON l.id = tu.lab_id
    INNER JOIN hospitals h ON h.id = l.hospital_id
    INNER JOIN user_training_units utu
      ON utu.training_unit_id = tu.id
    WHERE utu.user_id = $1
      AND (
        $2::int[] IS NULL
        OR utu.training_unit_id = ANY($2::int[])
      )
    ORDER BY h.name ASC, l.name ASC, tu.name ASC
    `,
    [userId, trainingUnitIds ?? null]
  );

  return result.rows;
}

export async function assignUserToLab(
  db: Pool,
  userId: number,
  labId: number
) {
  const result = await db.query(
    `
    INSERT INTO user_training_units (user_id, training_unit_id)
    VALUES ($1, $2)
    RETURNING
      user_id,
      training_unit_id AS lab_id,
      assigned_at
    `,
    [userId, labId]
  );

  return result.rows[0];
}

export async function removeUserFromLab(
  db: Pool,
  userId: number,
  labId: number
) {
  const result = await db.query(
    `
    DELETE FROM user_training_units
    WHERE user_id = $1 AND training_unit_id = $2
    RETURNING
      user_id,
      training_unit_id AS lab_id,
      assigned_at
    `,
    [userId, labId]
  );

  return result.rows[0];
}
