import { Pool } from "pg";
import { AssignmentStatus } from "shared-types";

export interface TrainingRecordSummary {
  id: number;
  trainee_id: number;
  trainee_name: string;
  trainee_email: string;
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

export async function listTrainingRecords(db: Pool) {
  const result = await db.query<TrainingRecordSummary>(
    `
    SELECT
      tr.id,
      u.id AS trainee_id,
      u.name AS trainee_name,
      u.email AS trainee_email,
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
    INNER JOIN template_versions tv ON tv.id = tr.template_version_id
    INNER JOIN templates t ON t.id = tv.template_id
    ORDER BY tr.expires_at ASC, tr.created_at DESC
    `
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
      u.name AS trainee_name,
      u.email AS trainee_email,
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
    INNER JOIN template_versions tv ON tv.id = tr.template_version_id
    INNER JOIN templates t ON t.id = tv.template_id
    WHERE tr.id = $1
    `,
    [id]
  );

  return result.rows[0];
}

export async function listTrainingRecordsExpiringWithinDays(
  db: Pool,
  days: number
) {
  const result = await db.query<TrainingRecordSummary>(
    `
    SELECT
      tr.id,
      u.id AS trainee_id,
      u.name AS trainee_name,
      u.email AS trainee_email,
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
    INNER JOIN template_versions tv ON tv.id = tr.template_version_id
    INNER JOIN templates t ON t.id = tv.template_id
    WHERE tr.expires_at >= NOW()
      AND tr.expires_at <= NOW() + ($1::text || ' days')::interval
    ORDER BY tr.expires_at ASC
    `,
    [days]
  );

  return result.rows;
}
