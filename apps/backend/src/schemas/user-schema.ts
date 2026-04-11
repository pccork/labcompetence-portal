import { Role, StaffType } from "shared-types";

export interface CreateUserBody {
  Body: {
    hospitalId?: number;
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    staffType?: string;
    isGlobalAdmin?: boolean;
  };
}

export interface UserParams {
  Params: {
    id: string;
  };
}

export interface UpdatePasswordBody {
  Body: {
    password?: string;
  };
}

export interface ArchiveUserBody {
  Body: {
    archive?: boolean;
  };
}

export const allowedRoles = new Set<string>(Object.values(Role));
export const allowedStaffTypes = new Set<string>(Object.values(StaffType));
