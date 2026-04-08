export enum Role {
  STAFF = "staff",
  TRAINER = "trainer",
  ADMIN = "admin",
}

export enum AssignmentStatus {
  PENDING = "pending",
  SUBMITTED = "submitted",
  SIGNEDOFF = "signedoff",
  EXPIRED = "expired",
}

export enum PocTrainingRequestStatus {
  PENDING_TRAINER_REPLY = "pending_trainer_reply",
  SCHEDULED = "scheduled",
  CANCELLED = "cancelled",
}

export enum StaffType {
  TRAINING_COORDINATOR = "training_coordinator",
  SENIOR_MEDICAL_SCIENTIST = "senior_medical_scientist",
  BASIC_GRADE_SCIENTIST = "basic_grade_scientist",
  MEDICAL_LABORATORY_AIDE = "medical_laboratory_aide",
  POCT_SCIENTIST = "poct_scientist",
  POCT_MEDICAL_NURSING = "poct_medical_nursing",
}

export const DEFAULT_CORE_DEPARTMENTS = [
  "Biochemistry",
  "Microbiology",
  "Virology",
  "Haematology",
  "Histology",
] as const;

export const POINT_OF_CARE_DEPARTMENT = "Point of Care";

export const DEFAULT_LOCAL_SETUP_DEPARTMENTS = [
  ...DEFAULT_CORE_DEPARTMENTS,
  POINT_OF_CARE_DEPARTMENT,
] as const;
