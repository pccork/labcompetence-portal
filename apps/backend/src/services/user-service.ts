import bcrypt from "bcrypt";
import { Role, StaffType } from "shared-types";

import {
  archiveSafeUser,
  deleteSafeUser,
  findActiveSafeUsers,
  findSafeUserById,
  findSafeUsersForTrainingUnits,
  findUserRecordByEmail,
  insertUser,
  updateSafeUser,
  updateSafeUserPassword,
} from "../repositories/user-repository";
import type {
  DbClient,
  SafeUser,
  User,
  UserRecord,
} from "../repositories/user-repository";

export type {
  DbClient,
  SafeUser,
  User,
  UserRecord,
} from "../repositories/user-repository";

export async function createUser(
  db: DbClient,
  hospitalId: number,
  name: string,
  email: string,
  password: string,
  role: Role,
  staffType: StaffType = StaffType.BASIC_GRADE_SCIENTIST,
  isGlobalAdmin = false,
) {
  const hashedPassword = await bcrypt.hash(password, 10);

  return insertUser(db, {
    hospitalId,
    name,
    email,
    hashedPassword,
    role,
    staffType,
    isGlobalAdmin,
  });
}

export async function findUserByEmail(db: DbClient, email: string) {
  return findUserRecordByEmail(db, email);
}

export async function findUserById(db: DbClient, id: number) {
  return findSafeUserById(db, id);
}

export async function listUsers(db: DbClient, hospitalId?: number) {
  return findActiveSafeUsers(db, hospitalId);
}

export async function listUsersForRequester(
  db: DbClient,
  input: {
    hospitalId?: number | undefined;
    requesterId: number;
    requesterRole: Role;
    canAccessAllHospitals: boolean;
    trainingUnitIds: number[];
  },
) {
  if (input.requesterRole === Role.STAFF) {
    const requester = await findUserById(db, input.requesterId);
    return requester ? [requester] : [];
  }

  if (input.canAccessAllHospitals) {
    return listUsers(db, input.hospitalId);
  }

  return findSafeUsersForTrainingUnits(db, {
    hospitalId: input.hospitalId,
    requesterId: input.requesterId,
    trainingUnitIds: input.trainingUnitIds,
  });
}

export async function updateUser(
  db: DbClient,
  id: number,
  hospitalId: number,
  name: string,
  email: string,
  role: Role,
  staffType: StaffType = StaffType.BASIC_GRADE_SCIENTIST,
  isGlobalAdmin = false,
) {
  return updateSafeUser(db, {
    id,
    hospitalId,
    name,
    email,
    role,
    staffType,
    isGlobalAdmin,
  });
}

export async function deleteUser(db: DbClient, id: number) {
  return deleteSafeUser(db, id);
}

export async function archiveUser(db: DbClient, id: number) {
  return archiveSafeUser(db, id);
}

export async function updateUserPassword(
  db: DbClient,
  id: number,
  password: string,
) {
  const hashedPassword = await bcrypt.hash(password, 10);

  return updateSafeUserPassword(db, {
    id,
    hashedPassword,
  });
}
