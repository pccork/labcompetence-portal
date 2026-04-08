import { Pool } from "pg";
import {
  AssignmentStatus,
  StaffType,
} from "shared-types";

export interface TrainingRecordSpecimen {
  id: number;
  training_record_id: number;
  specimen_label: string;
  specimen_type: string | null;
  analyser_reference: string | null;
  processed_at: Date | null;
  result_summary: string | null;
  created_at: Date;
}

export interface TrainingRecordSummary {
  id: number;
  trainee_id: number;
  trainee_hospital_id: number;
  trainee_hospital_name: string;
  trainee_name: string;
  trainee_email: string;
  trainee_staff_type: StaffType;
  lab_id: number;
  department_id: number;
  department_name: string;
  lab_hospital_id: number;
  lab_hospital_name: string;
  lab_name: string;
  lab_is_poc: boolean;
  template_version_id: number;
  template_id: number;
  template_name: string;
  form_family_reference: string;
  template_kind: string;
  template_target_staff_type: StaffType;
  version_number: number;
  assigned_trainer_id: number | null;
  assigned_trainer_name: string | null;
  training_assignment_id: number | null;
  scheduled_at: Date | null;
  completed_at: Date | null;
  trainee_signed_at: Date | null;
  assessment_payload_json: Record<string, unknown>;
  submitted_at: Date;
  expires_at: Date;
  status: AssignmentStatus;
  is_active: boolean;
  created_at: Date;
}

export interface TrainingRecordDetail extends TrainingRecordSummary {
  specimens: TrainingRecordSpecimen[];
}

export interface CreateTrainingRecordInput {
  traineeId: number;
  templateVersionId: number;
  assignedTrainerId?: number | null;
  trainingAssignmentId?: number | null;
  scheduledAt?: string | null;
  completedAt?: string | null;
  traineeSignedAt?: string | null;
  assessmentPayloadJson?: Record<string, unknown>;
  specimens?: Array<{
    specimenLabel: string;
    specimenType?: string | null;
    analyserReference?: string | null;
    processedAt?: string | null;
    resultSummary?: string | null;
  }>;
  expiresAt: string;
  status?: AssignmentStatus;
}

export interface TemplateVersionHospitalScope {
  id: number;
  template_id: number;
  lab_id: number;
  department_id: number;
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
      tv.template_id,
      tu.id AS lab_id,
      l.id AS department_id,
      l.hospital_id,
      l.is_poc
    FROM template_versions tv
    INNER JOIN templates t ON t.id = tv.template_id
    INNER JOIN training_units tu ON tu.id = t.training_unit_id
    INNER JOIN labs l ON l.id = tu.lab_id
    WHERE tv.id = $1
    `,
    [templateVersionId]
  );

  return result.rows[0];
}

const trainingRecordSummarySelect = `
  SELECT
    tr.id,
    u.id AS trainee_id,
    u.hospital_id AS trainee_hospital_id,
    trainee_hospital.name AS trainee_hospital_name,
    u.name AS trainee_name,
    u.email AS trainee_email,
    u.staff_type AS trainee_staff_type,
    template_unit.id AS lab_id,
    template_lab.id AS department_id,
    template_lab.name AS department_name,
    template_lab.hospital_id AS lab_hospital_id,
    lab_hospital.name AS lab_hospital_name,
    template_unit.name AS lab_name,
    template_lab.is_poc AS lab_is_poc,
    tr.template_version_id,
    tv.template_id,
    t.name AS template_name,
    t.form_family_reference,
    t.template_kind,
    t.target_staff_type AS template_target_staff_type,
    tv.version_number,
    tr.assigned_trainer_id,
    trainer.name AS assigned_trainer_name,
    tr.training_assignment_id,
    tr.scheduled_at,
    tr.completed_at,
    tr.trainee_signed_at,
    tr.assessment_payload_json,
    tr.submitted_at,
    tr.expires_at,
    tr.status,
    tr.is_active,
    tr.created_at
  FROM training_records tr
  INNER JOIN users u ON u.id = tr.user_id
  INNER JOIN hospitals trainee_hospital ON trainee_hospital.id = u.hospital_id
  INNER JOIN template_versions tv ON tv.id = tr.template_version_id
  INNER JOIN templates t ON t.id = tv.template_id
  INNER JOIN training_units template_unit ON template_unit.id = t.training_unit_id
  INNER JOIN labs template_lab ON template_lab.id = template_unit.lab_id
  INNER JOIN hospitals lab_hospital ON lab_hospital.id = template_lab.hospital_id
  LEFT JOIN users trainer ON trainer.id = tr.assigned_trainer_id
`;

async function listSpecimensForTrainingRecord(
  db: Pool,
  trainingRecordId: number
) {
  const result = await db.query<TrainingRecordSpecimen>(
    `
    SELECT
      id,
      training_record_id,
      specimen_label,
      specimen_type,
      analyser_reference,
      processed_at,
      result_summary,
      created_at
    FROM training_record_specimens
    WHERE training_record_id = $1
    ORDER BY created_at ASC, id ASC
    `,
    [trainingRecordId]
  );

  return result.rows;
}

export async function listTrainingRecords(
  db: Pool,
  hospitalId?: number,
  includeCrossHospitalPoc = false,
  trainingUnitIds?: number[]
) {
  const result = await db.query<TrainingRecordSummary>(
    `
    ${trainingRecordSummarySelect}
    WHERE (
      $1::int IS NULL
      OR template_lab.hospital_id = $1
      OR ($2 = true AND template_lab.is_poc = true)
    )
      AND (
        $3::int[] IS NULL
        OR template_unit.id = ANY($3::int[])
      )
    ORDER BY tr.expires_at ASC, tr.created_at DESC
    `,
    [hospitalId ?? null, includeCrossHospitalPoc, trainingUnitIds ?? null]
  );

  return result.rows;
}

export async function createTrainingRecord(
  db: Pool,
  input: CreateTrainingRecordInput
) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query<{ id: number }>(
      `
      INSERT INTO training_records (
        user_id,
        template_version_id,
        assigned_trainer_id,
        training_assignment_id,
        scheduled_at,
        completed_at,
        trainee_signed_at,
        assessment_payload_json,
        expires_at,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
      `,
      [
        input.traineeId,
        input.templateVersionId,
        input.assignedTrainerId ?? null,
        input.trainingAssignmentId ?? null,
        input.scheduledAt ?? null,
        input.completedAt ?? null,
        input.traineeSignedAt ?? null,
        input.assessmentPayloadJson ?? {},
        input.expiresAt,
        input.status ?? AssignmentStatus.PENDING,
      ]
    );

    const trainingRecordId = result.rows[0]?.id;

    if (!trainingRecordId) {
      throw new Error("Failed to create training record");
    }

    for (const specimen of input.specimens ?? []) {
      await client.query(
        `
        INSERT INTO training_record_specimens (
          training_record_id,
          specimen_label,
          specimen_type,
          analyser_reference,
          processed_at,
          result_summary
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          trainingRecordId,
          specimen.specimenLabel,
          specimen.specimenType ?? null,
          specimen.analyserReference ?? null,
          specimen.processedAt ?? null,
          specimen.resultSummary ?? null,
        ]
      );
    }

    await client.query("COMMIT");

    const record = await findTrainingRecordById(db, trainingRecordId);

    if (!record) {
      throw new Error("Failed to load created training record");
    }

    return record;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findTrainingRecordById(db: Pool, id: number) {
  const result = await db.query<TrainingRecordSummary>(
    `
    ${trainingRecordSummarySelect}
    WHERE tr.id = $1
    `,
    [id]
  );

  const record = result.rows[0];

  if (!record) {
    return undefined;
  }

  const specimens = await listSpecimensForTrainingRecord(db, record.id);

  return {
    ...record,
    specimens,
  } satisfies TrainingRecordDetail;
}

export async function listTrainingRecordsExpiringWithinDays(
  db: Pool,
  days: number,
  hospitalId?: number,
  includeCrossHospitalPoc = false,
  trainingUnitIds?: number[]
) {
  const result = await db.query<TrainingRecordSummary>(
    `
    ${trainingRecordSummarySelect}
    WHERE tr.expires_at >= NOW()
      AND tr.expires_at <= NOW() + ($1::text || ' days')::interval
      AND (
        $2::int IS NULL
        OR template_lab.hospital_id = $2
        OR ($3 = true AND template_lab.is_poc = true)
      )
      AND (
        $4::int[] IS NULL
        OR template_unit.id = ANY($4::int[])
      )
    ORDER BY tr.expires_at ASC
    `,
    [
      days,
      hospitalId ?? null,
      includeCrossHospitalPoc,
      trainingUnitIds ?? null,
    ]
  );

  return result.rows;
}
