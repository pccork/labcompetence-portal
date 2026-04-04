import { Pool } from "pg";

export interface Lab {
  id: number;
  department_id: number;
  department_name: string;
  hospital_id: number;
  hospital_name: string;
  name: string;
  is_poc: boolean;
  created_at: Date;
}

export async function listLabs(db: Pool, hospitalId?: number) {
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
    WHERE ($1::int IS NULL OR l.hospital_id = $1)
    ORDER BY h.name ASC, l.name ASC, tu.name ASC
    `,
    [hospitalId ?? null]
  );

  return result.rows;
}

async function findOrCreateDepartment(
  db: Pool,
  hospitalId: number,
  departmentName: string,
  isPoc: boolean
) {
  const result = await db.query<{ id: number }>(
    `
    INSERT INTO labs (hospital_id, name, is_poc)
    VALUES ($1, $2, $3)
    ON CONFLICT (hospital_id, name) DO UPDATE
    SET is_poc = EXCLUDED.is_poc
    RETURNING id
    `,
    [hospitalId, departmentName, isPoc]
  );

  const departmentId = result.rows[0]?.id;

  if (!departmentId) {
    throw new Error(`Failed to create department ${departmentName}`);
  }

  return departmentId;
}

export async function listDepartments(db: Pool, hospitalId?: number) {
  const result = await db.query(
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
    WHERE ($1::int IS NULL OR l.hospital_id = $1)
    ORDER BY h.name ASC, l.name ASC
    `,
    [hospitalId ?? null]
  );

  return result.rows;
}

export async function createLab(
  db: Pool,
  hospitalId: number,
  name: string,
  isPoc: boolean,
  departmentId?: number | null,
  departmentName?: string | null
) {
  const resolvedDepartmentId =
    departmentId && Number.isInteger(departmentId) && departmentId > 0
      ? departmentId
      : await findOrCreateDepartment(
          db,
          hospitalId,
          departmentName?.trim() || name,
          isPoc
        );

  const result = await db.query<Lab>(
    `
    WITH inserted_unit AS (
      INSERT INTO training_units (lab_id, name)
      VALUES ($1, $2)
      RETURNING id, lab_id, name, created_at
    )
    SELECT
      inserted_unit.id,
      l.id AS department_id,
      l.name AS department_name,
      l.hospital_id,
      h.name AS hospital_name,
      inserted_unit.name,
      l.is_poc,
      inserted_unit.created_at
    FROM inserted_unit
    INNER JOIN labs l ON l.id = inserted_unit.lab_id
    INNER JOIN hospitals h ON h.id = l.hospital_id
    `,
    [resolvedDepartmentId, name]
  );

  return result.rows[0];
}

export async function findLabById(db: Pool, id: number) {
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
    WHERE tu.id = $1
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
  isPoc: boolean,
  departmentId?: number | null,
  departmentName?: string | null
) {
  const resolvedDepartmentId =
    departmentId && Number.isInteger(departmentId) && departmentId > 0
      ? departmentId
      : await findOrCreateDepartment(
          db,
          hospitalId,
          departmentName?.trim() || name,
          isPoc
        );

  const result = await db.query<Lab>(
    `
    WITH updated_unit AS (
      UPDATE training_units
      SET lab_id = $2, name = $3
      WHERE id = $1
      RETURNING id, lab_id, name, created_at
    )
    SELECT
      updated_unit.id,
      l.id AS department_id,
      l.name AS department_name,
      l.hospital_id,
      h.name AS hospital_name,
      updated_unit.name,
      l.is_poc,
      updated_unit.created_at
    FROM updated_unit
    INNER JOIN labs l ON l.id = updated_unit.lab_id
    INNER JOIN hospitals h ON h.id = l.hospital_id
    `,
    [id, resolvedDepartmentId, name]
  );

  return result.rows[0];
}

export async function deleteLab(db: Pool, id: number) {
  const result = await db.query<Lab>(
    `
    WITH deleted_unit AS (
      DELETE FROM training_units
      WHERE id = $1
      RETURNING id, lab_id, name, created_at
    )
    SELECT
      deleted_unit.id,
      l.id AS department_id,
      l.name AS department_name,
      l.hospital_id,
      h.name AS hospital_name,
      deleted_unit.name,
      l.is_poc,
      deleted_unit.created_at
    FROM deleted_unit
    INNER JOIN labs l ON l.id = deleted_unit.lab_id
    INNER JOIN hospitals h ON h.id = l.hospital_id
    `,
    [id]
  );

  return result.rows[0];
}
