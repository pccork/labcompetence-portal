import { Pool } from "pg";
import { AssignmentStatus } from "shared-types";

export interface TrainingRecordSummary {
  id: number;
  trainee_id: number;
  trainee_hospital_id: number;
  trainee_hospital_name: string;
  trainee_name: string;
  trainee_email: string;
  lab_id: number;
  lab_hospital_id: number;
  lab_hospital_name: string;
  lab_name: string;
  lab_is_poc: boolean;
  template_version_id: number;
  template_id: number;
  template_name: string;
  version_number: number;
  submitted_at: Date;
  expires_at: Date;
  status: AssignmentStatus;
  created_at: Date;
}

export interface CreateTrainingRecordInput {
  traineeId: number;
  templateVersionId: number;
  expiresAt: string;
  status?: AssignmentStatus;
}

export interface TemplateVersionHospitalScope {
  id: number;
  lab_id: number;
  hospital_id: number;
  is_poc: boolean;
}

export async function findTemplateVersionHospitalScopeById(
  db: Pool,
  templateVersionId: number
) {
  const result = await db.query<TemplateVersionHospitalScope>(
    `
    SELECT
      tv.id,
      l.id AS lab_id,
      l.hospital_id,
      l.is_poc
    FROM template_versions tv
    INNER JOIN templates t ON t.id = tv.template_id
    INNER JOIN labs l ON l.id = t.lab_id
    WHERE tv.id = $1
    `,
    [templateVersionId]
  );

  return result.rows[0];
}

export async function listTrainingRecords(
  db: Pool,
  hospitalId?: number
) {
  const result = await db.query<TrainingRecordSummary>(
    `
    SELECT
      tr.id,
      u.id AS trainee_id,
      u.hospital_id AS trainee_hospital_id,
      trainee_hospital.name AS trainee_hospital_name,
      u.name AS trainee_name,
      u.email AS trainee_email,
      template_lab.id AS lab_id,
      template_lab.hospital_id AS lab_hospital_id,
      lab_hospital.name AS lab_hospital_name,
      template_lab.name AS lab_name,
      template_lab.is_poc AS lab_is_poc,
      tr.template_version_id,
      tv.template_id,
      t.name AS template_name,
      tv.version_number,
      tr.submitted_at,
      tr.expires_at,
      tr.status,
      tr.created_at
    FROM training_records tr
    INNER JOIN users u ON u.id = tr.user_id
    INNER JOIN hospitals trainee_hospital ON trainee_hospital.id = u.hospital_id
    INNER JOIN template_versions tv ON tv.id = tr.template_version_id
    INNER JOIN templates t ON t.id = tv.template_id
    INNER JOIN labs template_lab ON template_lab.id = t.lab_id
    INNER JOIN hospitals lab_hospital ON lab_hospital.id = template_lab.hospital_id
    WHERE ($1::int IS NULL OR template_lab.hospital_id = $1)
    ORDER BY tr.expires_at ASC, tr.created_at DESC
    `,
    [hospitalId ?? null]
  );

  return result.rows;
}

export async function createTrainingRecord(
  db: Pool,
  input: CreateTrainingRecordInput
) {
  const result = await db.query<{ id: number }>(
    `
    INSERT INTO training_records (user_id, template_version_id, expires_at, status)
    VALUES ($1, $2, $3, $4)
    RETURNING id
    `,
    [
      input.traineeId,
      input.templateVersionId,
      input.expiresAt,
      input.status ?? AssignmentStatus.PENDING,
    ]
  );

  const inserted = result.rows[0];

  if (!inserted) {
    throw new Error("Failed to create training record");
  }

  return findTrainingRecordById(db, inserted.id);
}

export async function findTrainingRecordById(db: Pool, id: number) {
  const result = await db.query<TrainingRecordSummary>(
    `
    SELECT
      tr.id,
      u.id AS trainee_id,
      u.hospital_id AS trainee_hospital_id,
      trainee_hospital.name AS trainee_hospital_name,
      u.name AS trainee_name,
      u.email AS trainee_email,
      template_lab.id AS lab_id,
      template_lab.hospital_id AS lab_hospital_id,
      lab_hospital.name AS lab_hospital_name,
      template_lab.name AS lab_name,
      template_lab.is_poc AS lab_is_poc,
      tr.template_version_id,
      tv.template_id,
      t.name AS template_name,
      tv.version_number,
      tr.submitted_at,
      tr.expires_at,
      tr.status,
      tr.created_at
    FROM training_records tr
    INNER JOIN users u ON u.id = tr.user_id
    INNER JOIN hospitals trainee_hospital ON trainee_hospital.id = u.hospital_id
    INNER JOIN template_versions tv ON tv.id = tr.template_version_id
    INNER JOIN templates t ON t.id = tv.template_id
    INNER JOIN labs template_lab ON template_lab.id = t.lab_id
    INNER JOIN hospitals lab_hospital ON lab_hospital.id = template_lab.hospital_id
    WHERE tr.id = $1
    `,
    [id]
  );

  return result.rows[0];
}

export async function listTrainingRecordsExpiringWithinDays(
  db: Pool,
  days: number,
  hospitalId?: number
) {
  const result = await db.query<TrainingRecordSummary>(
    `
    SELECT
      tr.id,
      u.id AS trainee_id,
      u.hospital_id AS trainee_hospital_id,
      trainee_hospital.name AS trainee_hospital_name,
      u.name AS trainee_name,
      u.email AS trainee_email,
      template_lab.id AS lab_id,
      template_lab.hospital_id AS lab_hospital_id,
      lab_hospital.name AS lab_hospital_name,
      template_lab.name AS lab_name,
      template_lab.is_poc AS lab_is_poc,
      tr.template_version_id,
      tv.template_id,
      t.name AS template_name,
      tv.version_number,
      tr.submitted_at,
      tr.expires_at,
      tr.status,
      tr.created_at
    FROM training_records tr
    INNER JOIN users u ON u.id = tr.user_id
    INNER JOIN hospitals trainee_hospital ON trainee_hospital.id = u.hospital_id
    INNER JOIN template_versions tv ON tv.id = tr.template_version_id
    INNER JOIN templates t ON t.id = tv.template_id
    INNER JOIN labs template_lab ON template_lab.id = t.lab_id
    INNER JOIN hospitals lab_hospital ON lab_hospital.id = template_lab.hospital_id
    WHERE tr.expires_at >= NOW()
      AND tr.expires_at <= NOW() + ($1::text || ' days')::interval
      AND ($2::int IS NULL OR template_lab.hospital_id = $2)
    ORDER BY tr.expires_at ASC
    `,
    [days, hospitalId ?? null]
  );

  return result.rows;
}
