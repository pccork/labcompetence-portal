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
