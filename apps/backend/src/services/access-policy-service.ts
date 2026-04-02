import { Pool } from "pg";

import { findUserById } from "./user-service";

export interface HospitalAccessScope {
  homeHospitalId: number;
  canAccessAllHospitals: boolean;
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
      FROM user_labs ul
      INNER JOIN labs l ON l.id = ul.lab_id
      WHERE ul.user_id = $1
        AND l.is_poc = true
    ) AS has_poc_access
    `,
    [requesterId]
  );

  return {
    homeHospitalId: requester.hospital_id,
    canAccessAllHospitals:
      pocAccessResult.rows[0]?.has_poc_access ?? false,
  };
}

export function canAccessHospital(
  scope: HospitalAccessScope,
  hospitalId: number
) {
  return scope.canAccessAllHospitals || scope.homeHospitalId === hospitalId;
}
