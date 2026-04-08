import { Pool } from "pg";

export interface Lab {
  id: number;
  department_id: number;
  department_name: string;
  hospital_id: number;
  hospital_name: string;
  name: string;
  is_poc: boolean;
  is_active: boolean;
  created_at: Date;
}

export interface DepartmentSummary {
  id: number;
  hospital_id: number;
  hospital_name: string;
  name: string;
  is_poc: boolean;
  is_active: boolean;
  created_at: Date;
}

export async function listLabs(
  db: Pool,
  hospitalId?: number,
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
      tu.is_active,
      tu.created_at
    FROM training_units tu
    INNER JOIN labs l ON l.id = tu.lab_id
    INNER JOIN hospitals h ON h.id = l.hospital_id
    WHERE ($1::int IS NULL OR l.hospital_id = $1)
      AND l.is_active = true
      AND tu.is_active = true
      AND (
        $2::int[] IS NULL
        OR tu.id = ANY($2::int[])
      )
    ORDER BY h.name ASC, l.name ASC, tu.name ASC
    `,
    [hospitalId ?? null, trainingUnitIds ?? null]
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
  const result = await db.query<DepartmentSummary>(
    `
    SELECT
      l.id,
      l.hospital_id,
      h.name AS hospital_name,
      l.name,
      l.is_poc,
      l.is_active,
      l.created_at
    FROM labs l
    INNER JOIN hospitals h ON h.id = l.hospital_id
    WHERE ($1::int IS NULL OR l.hospital_id = $1)
      AND l.is_active = true
    ORDER BY h.name ASC, l.name ASC
    `,
    [hospitalId ?? null]
  );

  return result.rows;
}

export async function createDepartment(
  db: Pool,
  hospitalId: number,
  name: string,
  isPoc: boolean
) {
  const result = await db.query<DepartmentSummary>(
    `
    WITH inserted_department AS (
      INSERT INTO labs (hospital_id, name, is_poc)
      VALUES ($1, $2, $3)
      RETURNING id, hospital_id, name, is_poc, is_active, created_at
    )
    SELECT
      inserted_department.id,
      inserted_department.hospital_id,
      h.name AS hospital_name,
      inserted_department.name,
      inserted_department.is_poc,
      inserted_department.is_active,
      inserted_department.created_at
    FROM inserted_department
    INNER JOIN hospitals h ON h.id = inserted_department.hospital_id
    `,
    [hospitalId, name, isPoc]
  );

  return result.rows[0];
}

export async function findDepartmentById(db: Pool, id: number) {
  const result = await db.query<DepartmentSummary>(
    `
    SELECT
      l.id,
      l.hospital_id,
      h.name AS hospital_name,
      l.name,
      l.is_poc,
      l.is_active,
      l.created_at
    FROM labs l
    INNER JOIN hospitals h ON h.id = l.hospital_id
    WHERE l.id = $1
    `,
    [id]
  );

  return result.rows[0];
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
      RETURNING id, lab_id, name, is_active, created_at
    )
    SELECT
      inserted_unit.id,
      l.id AS department_id,
      l.name AS department_name,
      l.hospital_id,
      h.name AS hospital_name,
      inserted_unit.name,
      l.is_poc,
      inserted_unit.is_active,
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
      tu.is_active,
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
      RETURNING id, lab_id, name, is_active, created_at
    )
    SELECT
      updated_unit.id,
      l.id AS department_id,
      l.name AS department_name,
      l.hospital_id,
      h.name AS hospital_name,
      updated_unit.name,
      l.is_poc,
      updated_unit.is_active,
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
      RETURNING id, lab_id, name, is_active, created_at
    )
    SELECT
      deleted_unit.id,
      l.id AS department_id,
      l.name AS department_name,
      l.hospital_id,
      h.name AS hospital_name,
      deleted_unit.name,
      l.is_poc,
      deleted_unit.is_active,
      deleted_unit.created_at
    FROM deleted_unit
    INNER JOIN labs l ON l.id = deleted_unit.lab_id
    INNER JOIN hospitals h ON h.id = l.hospital_id
    `,
    [id]
  );

  return result.rows[0];
}

export async function archiveLab(db: Pool, id: number) {
  const result = await db.query<{ id: number }>(
    `
    UPDATE training_units
    SET is_active = false
    WHERE id = $1
    RETURNING id
    `,
    [id]
  );

  return result.rows[0];
}

export async function archiveDepartment(db: Pool, id: number) {
  const result = await db.query<{ id: number }>(
    `
    UPDATE labs
    SET is_active = false
    WHERE id = $1
    RETURNING id
    `,
    [id]
  );

  return result.rows[0];
}

export async function deleteDepartment(db: Pool, id: number) {
  const result = await db.query<{ id: number }>(
    `
    DELETE FROM labs
    WHERE id = $1
    RETURNING id
    `,
    [id]
  );

  return result.rows[0];
}

export async function getDepartmentUsage(db: Pool, id: number) {
  const result = await db.query<{
    section_count: number;
    template_count: number;
    assignment_count: number;
    record_count: number;
  }>(
    `
    SELECT
      COUNT(DISTINCT tu.id) AS section_count,
      COUNT(DISTINCT t.id) AS template_count,
      COUNT(DISTINCT ta.id) AS assignment_count,
      COUNT(DISTINCT tr.id) AS record_count
    FROM labs l
    LEFT JOIN training_units tu ON tu.lab_id = l.id
    LEFT JOIN templates t ON t.training_unit_id = tu.id
    LEFT JOIN training_assignments ta ON ta.training_unit_id = tu.id
    LEFT JOIN template_versions tv ON tv.template_id = t.id
    LEFT JOIN training_records tr ON tr.template_version_id = tv.id
    WHERE l.id = $1
    `,
    [id]
  );

  return result.rows[0];
}

export async function getLabUsage(db: Pool, id: number) {
  const result = await db.query<{
    user_assignment_count: number;
    template_count: number;
    active_template_count: number;
    assignment_count: number;
    record_count: number;
    active_record_count: number;
    poc_link_count: number;
    poc_request_count: number;
  }>(
    `
    SELECT
      COUNT(DISTINCT utu.user_id) AS user_assignment_count,
      COUNT(DISTINCT t.id) AS template_count,
      COUNT(DISTINCT CASE WHEN t.is_active = true THEN t.id END) AS active_template_count,
      COUNT(DISTINCT ta.id) AS assignment_count,
      COUNT(DISTINCT tr.id) AS record_count,
      COUNT(DISTINCT CASE WHEN tr.is_active = true THEN tr.id END) AS active_record_count,
      COUNT(DISTINCT prl.id) AS poc_link_count,
      COUNT(DISTINCT ptr.id) AS poc_request_count
    FROM training_units tu
    LEFT JOIN user_training_units utu ON utu.training_unit_id = tu.id
    LEFT JOIN templates t ON t.training_unit_id = tu.id
    LEFT JOIN training_assignments ta ON ta.training_unit_id = tu.id
    LEFT JOIN template_versions tv ON tv.template_id = t.id
    LEFT JOIN training_records tr ON tr.template_version_id = tv.id
    LEFT JOIN poc_registration_links prl ON prl.training_unit_id = tu.id
    LEFT JOIN poc_training_requests ptr ON ptr.training_unit_id = tu.id
    WHERE tu.id = $1
    `,
    [id]
  );

  return result.rows[0];
}
