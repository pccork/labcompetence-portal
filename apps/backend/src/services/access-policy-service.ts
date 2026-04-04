import { Pool } from "pg";
import { Role } from "shared-types";

import { findUserById } from "./user-service";

export interface HospitalAccessScope {
  homeHospitalId: number;
  canAccessAllHospitals: boolean;
  canAccessCrossHospitalPoc: boolean;
}

export async function getHospitalAccessScope(
  db: Pool,
  requesterId: number
) {
  const requester = await findUserById(db, requesterId);

  if (!requester) {
    return undefined;
  }

  const pocAccessResult = await db.query<{ has_poc_access: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM user_training_units utu
      INNER JOIN training_units tu ON tu.id = utu.training_unit_id
      INNER JOIN labs l ON l.id = tu.lab_id
      WHERE utu.user_id = $1
        AND l.is_poc = true
    ) AS has_poc_access
    `,
    [requesterId]
  );

  return {
    homeHospitalId: requester.hospital_id,
    canAccessAllHospitals: requester.role === Role.ADMIN,
    canAccessCrossHospitalPoc:
      pocAccessResult.rows[0]?.has_poc_access ?? false,
  };
}

export function canAccessHospital(
  scope: HospitalAccessScope,
  hospitalId: number,
  targetIsPoc = false
) {
  return (
    scope.canAccessAllHospitals ||
    scope.homeHospitalId === hospitalId ||
    (targetIsPoc && scope.canAccessCrossHospitalPoc)
  );
}

export function resolveScopedHospitalId(scope: HospitalAccessScope) {
  return scope.canAccessAllHospitals ? undefined : scope.homeHospitalId;
}
