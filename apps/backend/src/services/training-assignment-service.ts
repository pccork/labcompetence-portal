import { Pool } from "pg";
import { StaffType } from "shared-types";

export interface TrainingAssignment {
  id: number;
  user_id: number;
  trainee_name: string;
  trainee_email: string;
  trainee_hospital_id: number;
  trainee_hospital_name: string;
  staff_type: StaffType;
  template_id: number;
  template_name: string;
  form_family_reference: string;
  template_kind: string;
  target_staff_type: StaffType;
  lab_id: number;
  lab_name: string;
  lab_hospital_id: number;
  lab_hospital_name: string;
  lab_is_poc: boolean;
  assigned_by: number | null;
  assigned_by_name: string | null;
  renewal_interval_months: number;
  next_due_at: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TemplateAssignmentScope {
  template_id: number;
  lab_id: number;
  hospital_id: number;
  is_poc: boolean;
  target_staff_type: StaffType;
}

const trainingAssignmentSelect = `
  SELECT
    ta.id,
    ta.user_id,
    trainee.name AS trainee_name,
    trainee.email AS trainee_email,
    trainee.hospital_id AS trainee_hospital_id,
    trainee_hospital.name AS trainee_hospital_name,
    trainee.staff_type,
    ta.template_id,
    t.name AS template_name,
    t.form_family_reference,
    t.template_kind,
    t.target_staff_type,
    ta.lab_id,
    l.name AS lab_name,
    l.hospital_id AS lab_hospital_id,
    lab_hospital.name AS lab_hospital_name,
    l.is_poc AS lab_is_poc,
    ta.assigned_by,
    assigner.name AS assigned_by_name,
    ta.renewal_interval_months,
    ta.next_due_at,
    ta.is_active,
    ta.created_at,
    ta.updated_at
  FROM training_assignments ta
  INNER JOIN users trainee ON trainee.id = ta.user_id
  INNER JOIN hospitals trainee_hospital ON trainee_hospital.id = trainee.hospital_id
  INNER JOIN templates t ON t.id = ta.template_id
  INNER JOIN labs l ON l.id = ta.lab_id
  INNER JOIN hospitals lab_hospital ON lab_hospital.id = l.hospital_id
  LEFT JOIN users assigner ON assigner.id = ta.assigned_by
`;

export async function findTemplateAssignmentScopeByTemplateId(
  db: Pool,
  templateId: number
) {
  const result = await db.query<TemplateAssignmentScope>(
    `
    SELECT
      t.id AS template_id,
      l.id AS lab_id,
      l.hospital_id,
      l.is_poc,
      t.target_staff_type
    FROM templates t
    INNER JOIN labs l ON l.id = t.lab_id
    WHERE t.id = $1
    `,
    [templateId]
  );

  return result.rows[0];
}

export async function listTrainingAssignments(
  db: Pool,
  hospitalId?: number,
  includeCrossHospitalPoc = false
) {
  const result = await db.query<TrainingAssignment>(
    `
    ${trainingAssignmentSelect}
    WHERE ta.is_active = true
      AND (
        $1::int IS NULL
        OR l.hospital_id = $1
        OR ($2 = true AND l.is_poc = true)
      )
    ORDER BY ta.next_due_at ASC, trainee.name ASC, t.name ASC
    `,
    [hospitalId ?? null, includeCrossHospitalPoc]
  );

  return result.rows;
}

export async function listTrainingAssignmentsDueWithinDays(
  db: Pool,
  days: number,
  hospitalId?: number,
  includeCrossHospitalPoc = false
) {
  const result = await db.query<TrainingAssignment>(
    `
    ${trainingAssignmentSelect}
    WHERE ta.is_active = true
      AND ta.next_due_at >= NOW()
      AND ta.next_due_at <= NOW() + ($1::text || ' days')::interval
      AND (
        $2::int IS NULL
        OR l.hospital_id = $2
        OR ($3 = true AND l.is_poc = true)
      )
    ORDER BY ta.next_due_at ASC, trainee.name ASC, t.name ASC
    `,
    [days, hospitalId ?? null, includeCrossHospitalPoc]
  );

  return result.rows;
}

export async function createTrainingAssignment(
  db: Pool,
  input: {
    userId: number;
    templateId: number;
    labId: number;
    assignedBy: number;
    renewalIntervalMonths: number;
    nextDueAt: string;
  }
) {
  const result = await db.query<{ id: number }>(
    `
    INSERT INTO training_assignments (
      user_id,
      template_id,
      lab_id,
      assigned_by,
      renewal_interval_months,
      next_due_at
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
    `,
    [
      input.userId,
      input.templateId,
      input.labId,
      input.assignedBy,
      input.renewalIntervalMonths,
      input.nextDueAt,
    ]
  );

  const assignmentId = result.rows[0]?.id;

  if (!assignmentId) {
    throw new Error("Failed to create training assignment");
  }

  return findTrainingAssignmentById(db, assignmentId);
}

export async function findTrainingAssignmentById(
  db: Pool,
  assignmentId: number
) {
  const result = await db.query<TrainingAssignment>(
    `
    ${trainingAssignmentSelect}
    WHERE ta.id = $1
    `,
    [assignmentId]
  );

  return result.rows[0];
}

export async function updateTrainingAssignment(
  db: Pool,
  assignmentId: number,
  renewalIntervalMonths: number,
  nextDueAt: string,
  isActive: boolean
) {
  const result = await db.query<{ id: number }>(
    `
    UPDATE training_assignments
    SET
      renewal_interval_months = $2,
      next_due_at = $3,
      is_active = $4,
      updated_at = NOW()
    WHERE id = $1
    RETURNING id
    `,
    [
      assignmentId,
      renewalIntervalMonths,
      nextDueAt,
      isActive,
    ]
  );

  const updatedId = result.rows[0]?.id;

  if (!updatedId) {
    return undefined;
  }

  return findTrainingAssignmentById(db, updatedId);
}
