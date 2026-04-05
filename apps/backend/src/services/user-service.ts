import bcrypt from "bcrypt";
import {
  Pool,
  PoolClient,
} from "pg";
import {
  Role,
  StaffType,
} from "shared-types";

export interface User {
  id?: number;
  hospital_id: number;
  name: string;
  email: string;
  password: string;
  role: Role;
  staff_type: StaffType;
}

export interface SafeUser {
  id: number;
  hospital_id: number;
  hospital_name: string;
  name: string;
  email: string;
  role: Role;
  staff_type: StaffType;
  is_global_admin: boolean;
  is_active: boolean;
  created_at: Date;
}

export async function createUser(
  db: Pool | PoolClient,
  hospitalId: number,
  name: string,
  email: string,
  password: string,
  role: Role,
  staffType: StaffType = StaffType.BASIC_GRADE_SCIENTIST,
  isGlobalAdmin = false
) {
  const hashed = await bcrypt.hash(password, 10);

  const result = await db.query<SafeUser>(
    `
    WITH inserted_user AS (
      INSERT INTO users (
        hospital_id,
        name,
        email,
        password,
        role,
        staff_type,
        is_global_admin,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING id, hospital_id, name, email, role, staff_type, is_global_admin, is_active, created_at
    )
    SELECT
      inserted_user.id,
      inserted_user.hospital_id,
      h.name AS hospital_name,
      inserted_user.name,
      inserted_user.email,
      inserted_user.role,
      inserted_user.staff_type,
      inserted_user.is_global_admin,
      inserted_user.is_active,
      inserted_user.created_at
    FROM inserted_user
    INNER JOIN hospitals h ON h.id = inserted_user.hospital_id
    `,
    [hospitalId, name, email, hashed, role, staffType, isGlobalAdmin]
  );

  return result.rows[0];
}

export async function findUserByEmail(db: Pool, email: string) {
  const result = await db.query(
    "SELECT * FROM users WHERE email = $1 AND is_active = true",
    [email]
  );

  return result.rows[0];
}

export async function findUserById(db: Pool, id: number) {
  const result = await db.query<SafeUser>(
    `
    SELECT
      u.id,
      u.hospital_id,
      h.name AS hospital_name,
      u.name,
      u.email,
      u.role,
      u.staff_type,
      u.is_global_admin,
      u.is_active,
      u.created_at
    FROM users u
    INNER JOIN hospitals h ON h.id = u.hospital_id
    WHERE u.id = $1
    `,
    [id]
  );

  return result.rows[0];
}

export async function listUsers(db: Pool, hospitalId?: number) {
  const result = await db.query<SafeUser>(
    `
    SELECT
      u.id,
      u.hospital_id,
      h.name AS hospital_name,
      u.name,
      u.email,
      u.role,
      u.staff_type,
      u.is_global_admin,
      u.is_active,
      u.created_at
    FROM users u
    INNER JOIN hospitals h ON h.id = u.hospital_id
    WHERE ($1::int IS NULL OR u.hospital_id = $1)
      AND u.is_active = true
    ORDER BY h.name ASC, u.name ASC
    `,
    [hospitalId ?? null]
  );

  return result.rows;
}

export async function listUsersForRequester(
  db: Pool,
  input: {
    hospitalId?: number | undefined;
    requesterId: number;
    requesterRole: Role;
    canAccessAllHospitals: boolean;
    trainingUnitIds: number[];
  }
) {
  if (input.requesterRole === Role.STAFF) {
    const requester = await findUserById(db, input.requesterId);
    return requester ? [requester] : [];
  }

  if (input.canAccessAllHospitals) {
    return listUsers(db, input.hospitalId);
  }

  const result = await db.query<SafeUser>(
    `
    SELECT DISTINCT
      u.id,
      u.hospital_id,
      h.name AS hospital_name,
      u.name,
      u.email,
      u.role,
      u.staff_type,
      u.is_global_admin,
      u.is_active,
      u.created_at
    FROM users u
    INNER JOIN hospitals h ON h.id = u.hospital_id
    LEFT JOIN user_training_units utu ON utu.user_id = u.id
    WHERE ($1::int IS NULL OR u.hospital_id = $1)
      AND u.is_active = true
      AND (
        u.id = $2
        OR (
          $3::int[] IS NOT NULL
          AND utu.training_unit_id = ANY($3::int[])
        )
      )
    ORDER BY h.name ASC, u.name ASC
    `,
    [
      input.hospitalId ?? null,
      input.requesterId,
      input.trainingUnitIds.length > 0 ? input.trainingUnitIds : null,
    ]
  );

  return result.rows;
}

export async function updateUser(
  db: Pool,
  id: number,
  hospitalId: number,
  name: string,
  email: string,
  role: Role,
  staffType: StaffType = StaffType.BASIC_GRADE_SCIENTIST,
  isGlobalAdmin = false
) {
  const result = await db.query<SafeUser>(
    `
    WITH updated_user AS (
      UPDATE users
      SET
        hospital_id = $2,
        name = $3,
        email = $4,
        role = $5,
        staff_type = $6,
        is_global_admin = $7
      WHERE id = $1
      RETURNING id, hospital_id, name, email, role, staff_type, is_global_admin, is_active, created_at
    )
    SELECT
      updated_user.id,
      updated_user.hospital_id,
      h.name AS hospital_name,
      updated_user.name,
      updated_user.email,
      updated_user.role,
      updated_user.staff_type,
      updated_user.is_global_admin,
      updated_user.is_active,
      updated_user.created_at
    FROM updated_user
    INNER JOIN hospitals h ON h.id = updated_user.hospital_id
    `,
    [id, hospitalId, name, email, role, staffType, isGlobalAdmin]
  );

  return result.rows[0];
}

export async function deleteUser(db: Pool, id: number) {
  const result = await db.query<SafeUser>(
    `
    WITH deleted_user AS (
      DELETE FROM users
      WHERE id = $1
      RETURNING id, hospital_id, name, email, role, staff_type, created_at
    )
    SELECT
      deleted_user.id,
      deleted_user.hospital_id,
      h.name AS hospital_name,
      deleted_user.name,
      deleted_user.email,
      deleted_user.role,
      deleted_user.staff_type,
      deleted_user.created_at
    FROM deleted_user
    INNER JOIN hospitals h ON h.id = deleted_user.hospital_id
    `,
    [id]
  );

  return result.rows[0];
}

export async function archiveUser(db: Pool, id: number) {
  const result = await db.query<SafeUser>(
    `
    WITH archived_user AS (
      UPDATE users
      SET is_active = false
      WHERE id = $1
      RETURNING id, hospital_id, name, email, role, staff_type, is_global_admin, is_active, created_at
    )
    SELECT
      archived_user.id,
      archived_user.hospital_id,
      h.name AS hospital_name,
      archived_user.name,
      archived_user.email,
      archived_user.role,
      archived_user.staff_type,
      archived_user.is_global_admin,
      archived_user.is_active,
      archived_user.created_at
    FROM archived_user
    INNER JOIN hospitals h ON h.id = archived_user.hospital_id
    `,
    [id]
  );

  return result.rows[0];
}

export async function updateUserPassword(
  db: Pool,
  id: number,
  password: string
) {
  const hashed = await bcrypt.hash(password, 10);

  const result = await db.query<SafeUser>(
    `
    WITH updated_user AS (
      UPDATE users
      SET password = $2
      WHERE id = $1
      RETURNING id, hospital_id, name, email, role, staff_type, is_global_admin, is_active, created_at
    )
    SELECT
      updated_user.id,
      updated_user.hospital_id,
      h.name AS hospital_name,
      updated_user.name,
      updated_user.email,
      updated_user.role,
      updated_user.staff_type,
      updated_user.is_global_admin,
      updated_user.is_active,
      updated_user.created_at
    FROM updated_user
    INNER JOIN hospitals h ON h.id = updated_user.hospital_id
    `,
    [id, hashed]
  );

  return result.rows[0];
}
