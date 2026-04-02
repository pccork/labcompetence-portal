import { Pool } from "pg";

import { Lab } from "./lab-service";

export async function listLabsForUser(db: Pool, userId: number) {
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
    INNER JOIN user_labs ul ON ul.lab_id = l.id
    WHERE ul.user_id = $1
    ORDER BY h.name ASC, l.name ASC
    `,
    [userId]
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
    INSERT INTO user_labs (user_id, lab_id)
    VALUES ($1, $2)
    RETURNING user_id, lab_id, assigned_at
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
    DELETE FROM user_labs
    WHERE user_id = $1 AND lab_id = $2
    RETURNING user_id, lab_id, assigned_at
    `,
    [userId, labId]
  );

  return result.rows[0];
}
