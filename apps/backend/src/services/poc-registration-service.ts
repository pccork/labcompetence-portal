import { randomBytes } from "crypto";
import { Pool } from "pg";
import {
  PocTrainingRequestStatus,
  Role,
  StaffType,
} from "shared-types";

import { Lab } from "./lab-service";
import { createUser, SafeUser } from "./user-service";

export interface PocRegistrationLink {
  id: number;
  code: string;
  is_active: boolean;
  default_training_location: string | null;
  default_training_time_details: string | null;
  created_at: Date;
  lab_id: number;
  lab_name: string;
  department_id: number;
  department_name: string;
  lab_is_poc: boolean;
  hospital_id: number;
  hospital_name: string;
}

export interface PocSelfRegistrationResult {
  user: SafeUser;
  lab: Lab;
  registrationLink: PocRegistrationLink;
  trainingRequest: PocTrainingRequest;
}

export interface PocTrainingRequest {
  id: number;
  registration_link_id: number;
  user_id: number;
  trainee_hospital_id: number;
  trainee_hospital_name: string;
  trainee_name: string;
  trainee_email: string;
  lab_id: number;
  lab_name: string;
  department_id: number;
  department_name: string;
  lab_hospital_id: number;
  lab_hospital_name: string;
  lab_is_poc: boolean;
  is_training_approved: boolean;
  trainer_reply_status: PocTrainingRequestStatus;
  training_location: string | null;
  training_time_details: string | null;
  trainer_message: string | null;
  responded_by: number | null;
  responder_name: string | null;
  responded_at: Date | null;
  requested_at: Date;
}

export async function listPocRegistrationLinks(
  db: Pool,
  trainingUnitIds?: number[]
) {
  const result = await db.query<PocRegistrationLink>(
    `
    SELECT
      prl.id,
      prl.code,
      prl.is_active,
      prl.default_training_location,
      prl.default_training_time_details,
      prl.created_at,
      tu.id AS lab_id,
      tu.name AS lab_name,
      l.id AS department_id,
      l.name AS department_name,
      l.is_poc AS lab_is_poc,
      h.id AS hospital_id,
      h.name AS hospital_name
    FROM poc_registration_links prl
    INNER JOIN training_units tu ON tu.id = prl.training_unit_id
    INNER JOIN labs l ON l.id = tu.lab_id
    INNER JOIN hospitals h ON h.id = l.hospital_id
    WHERE (
      $1::int[] IS NULL
      OR prl.training_unit_id = ANY($1::int[])
    )
    ORDER BY prl.created_at DESC
    `,
    [trainingUnitIds ?? null]
  );

  return result.rows;
}

export async function findPocRegistrationLinkByCode(
  db: Pool,
  code: string
) {
  const result = await db.query<PocRegistrationLink>(
    `
    SELECT
      prl.id,
      prl.code,
      prl.is_active,
      prl.default_training_location,
      prl.default_training_time_details,
      prl.created_at,
      tu.id AS lab_id,
      tu.name AS lab_name,
      l.id AS department_id,
      l.name AS department_name,
      l.is_poc AS lab_is_poc,
      h.id AS hospital_id,
      h.name AS hospital_name
    FROM poc_registration_links prl
    INNER JOIN training_units tu ON tu.id = prl.training_unit_id
    INNER JOIN labs l ON l.id = tu.lab_id
    INNER JOIN hospitals h ON h.id = l.hospital_id
    WHERE prl.code = $1
    `,
    [code]
  );

  return result.rows[0];
}

export async function createPocRegistrationLink(
  db: Pool,
  labId: number,
  defaultTrainingLocation: string | null,
  defaultTrainingTimeDetails: string | null
) {
  const code = randomBytes(16).toString("hex");

  const result = await db.query<{ code: string }>(
    `
    INSERT INTO poc_registration_links (
      lab_id,
      training_unit_id,
      code,
      default_training_location,
      default_training_time_details
    )
    VALUES (
      (SELECT lab_id FROM training_units WHERE id = $1),
      $1,
      $2,
      $3,
      $4
    )
    RETURNING code
    `,
    [
      labId,
      code,
      defaultTrainingLocation,
      defaultTrainingTimeDetails,
    ]
  );

  const created = result.rows[0];

  if (!created) {
    throw new Error("Failed to create POC registration link");
  }

  return findPocRegistrationLinkByCode(db, created.code);
}

export async function setPocRegistrationLinkStatus(
  db: Pool,
  code: string,
  isActive: boolean
) {
  const result = await db.query<{ code: string }>(
    `
    UPDATE poc_registration_links
    SET is_active = $2
    WHERE code = $1
    RETURNING code
    `,
    [code, isActive]
  );

  const updated = result.rows[0];

  if (!updated) {
    return undefined;
  }

  return findPocRegistrationLinkByCode(db, updated.code);
}

export async function registerTraineeFromPocLink(
  db: Pool,
  input: {
    registrationCode: string;
    hospitalId: number;
    name: string;
    email: string;
    password: string;
    staffType?: StaffType;
  }
) {
  const registrationLink = await findPocRegistrationLinkByCode(
    db,
    input.registrationCode
  );

  if (
    !registrationLink ||
    !registrationLink.is_active ||
    !registrationLink.lab_is_poc
  ) {
    return undefined;
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const user = await createUser(
      client,
      input.hospitalId,
      input.name,
      input.email,
      input.password,
      Role.STAFF,
      input.staffType ?? StaffType.POCT_MEDICAL_NURSING
    );

    if (!user) {
      throw new Error("Failed to create POC trainee");
    }

    const trainingRequestResult = await client.query<{ id: number }>(
      `
      INSERT INTO poc_training_requests (
        registration_link_id,
        user_id,
        lab_id,
        training_unit_id,
        is_training_approved,
        trainer_reply_status,
        training_location,
        training_time_details
      )
      VALUES ($1, $2, $3, $4, true, $5, $6, $7)
      RETURNING id
      `,
      [
        registrationLink.id,
        user.id,
        registrationLink.department_id,
        registrationLink.lab_id,
        PocTrainingRequestStatus.PENDING_TRAINER_REPLY,
        registrationLink.default_training_location,
        registrationLink.default_training_time_details,
      ]
    );

    const trainingRequestId = trainingRequestResult.rows[0]?.id;

    if (!trainingRequestId) {
      throw new Error("Failed to create POC training request");
    }

    const labResult = await client.query<Lab>(
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
      [registrationLink.lab_id]
    );

    const lab = labResult.rows[0];

    if (!lab) {
      throw new Error("POC lab not found during self-registration");
    }

    await client.query("COMMIT");

    const trainingRequest = await findPocTrainingRequestById(
      db,
      trainingRequestId
    );

    if (!trainingRequest) {
      throw new Error("Failed to load POC training request");
    }

    return {
      user,
      lab,
      registrationLink,
      trainingRequest,
    } satisfies PocSelfRegistrationResult;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listPocTrainingRequests(
  db: Pool,
  hospitalId?: number,
  includeCrossHospitalPoc = false,
  trainingUnitIds?: number[]
) {
  const result = await db.query<PocTrainingRequest>(
    `
    SELECT
      ptr.id,
      ptr.registration_link_id,
      ptr.user_id,
      u.hospital_id AS trainee_hospital_id,
      trainee_hospital.name AS trainee_hospital_name,
      u.name AS trainee_name,
      u.email AS trainee_email,
      ptr.training_unit_id AS lab_id,
      tu.name AS lab_name,
      l.id AS department_id,
      l.name AS department_name,
      l.hospital_id AS lab_hospital_id,
      lab_hospital.name AS lab_hospital_name,
      l.is_poc AS lab_is_poc,
      ptr.is_training_approved,
      ptr.trainer_reply_status,
      ptr.training_location,
      ptr.training_time_details,
      ptr.trainer_message,
      ptr.responded_by,
      responder.name AS responder_name,
      ptr.responded_at,
      ptr.requested_at
    FROM poc_training_requests ptr
    INNER JOIN users u ON u.id = ptr.user_id
    INNER JOIN hospitals trainee_hospital ON trainee_hospital.id = u.hospital_id
    INNER JOIN training_units tu ON tu.id = ptr.training_unit_id
    INNER JOIN labs l ON l.id = tu.lab_id
    INNER JOIN hospitals lab_hospital ON lab_hospital.id = l.hospital_id
    LEFT JOIN users responder ON responder.id = ptr.responded_by
    WHERE (
      $1::int IS NULL
      OR l.hospital_id = $1
      OR ($2 = true AND l.is_poc = true)
    )
      AND (
        $3::int[] IS NULL
        OR ptr.training_unit_id = ANY($3::int[])
      )
    ORDER BY ptr.requested_at DESC
    `,
    [hospitalId ?? null, includeCrossHospitalPoc, trainingUnitIds ?? null]
  );

  return result.rows;
}

export async function findPocTrainingRequestById(
  db: Pool,
  requestId: number
) {
  const result = await db.query<PocTrainingRequest>(
    `
    SELECT
      ptr.id,
      ptr.registration_link_id,
      ptr.user_id,
      u.hospital_id AS trainee_hospital_id,
      trainee_hospital.name AS trainee_hospital_name,
      u.name AS trainee_name,
      u.email AS trainee_email,
      ptr.training_unit_id AS lab_id,
      tu.name AS lab_name,
      l.id AS department_id,
      l.name AS department_name,
      l.hospital_id AS lab_hospital_id,
      lab_hospital.name AS lab_hospital_name,
      l.is_poc AS lab_is_poc,
      ptr.is_training_approved,
      ptr.trainer_reply_status,
      ptr.training_location,
      ptr.training_time_details,
      ptr.trainer_message,
      ptr.responded_by,
      responder.name AS responder_name,
      ptr.responded_at,
      ptr.requested_at
    FROM poc_training_requests ptr
    INNER JOIN users u ON u.id = ptr.user_id
    INNER JOIN hospitals trainee_hospital ON trainee_hospital.id = u.hospital_id
    INNER JOIN training_units tu ON tu.id = ptr.training_unit_id
    INNER JOIN labs l ON l.id = tu.lab_id
    INNER JOIN hospitals lab_hospital ON lab_hospital.id = l.hospital_id
    LEFT JOIN users responder ON responder.id = ptr.responded_by
    WHERE ptr.id = $1
    `,
    [requestId]
  );

  return result.rows[0];
}

export async function replyToPocTrainingRequest(
  db: Pool,
  input: {
    requestId: number;
    responderId: number;
    status: PocTrainingRequestStatus;
    trainingLocation: string | null;
    trainingTimeDetails: string | null;
    trainerMessage: string | null;
  }
) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const updateResult = await client.query<{ id: number }>(
      `
      UPDATE poc_training_requests
      SET trainer_reply_status = $2,
          training_location = $3,
          training_time_details = $4,
          trainer_message = $5,
          responded_by = $6,
          responded_at = NOW()
      WHERE id = $1
      RETURNING id
      `,
      [
        input.requestId,
        input.status,
        input.trainingLocation,
        input.trainingTimeDetails,
        input.trainerMessage,
        input.responderId,
      ]
    );

    const updatedId = updateResult.rows[0]?.id;

    if (!updatedId) {
      await client.query("ROLLBACK");
      return undefined;
    }

    if (input.status === PocTrainingRequestStatus.SCHEDULED) {
      const requestRow = await client.query<{
        user_id: number;
        lab_id: number;
      }>(
        `
        SELECT
          user_id,
          training_unit_id AS lab_id
        FROM poc_training_requests
        WHERE id = $1
        `,
        [input.requestId]
      );

      const request = requestRow.rows[0];

      if (!request) {
        throw new Error("Failed to load POC training request");
      }

      await client.query(
        `
        INSERT INTO user_training_units (user_id, training_unit_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, training_unit_id) DO NOTHING
        `,
        [request.user_id, request.lab_id]
      );
    }

    await client.query("COMMIT");

    return findPocTrainingRequestById(db, updatedId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
