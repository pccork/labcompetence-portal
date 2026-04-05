import {
  LabSummary,
  TemplateSummary,
  TrainingAssignmentSummary,
  TrainingRecordSummary,
} from "../api";

export const poctStaffTypes = new Set([
  "poct_scientist",
  "poct_medical_nursing",
]);

export function isPoctStaffType(staffType: string) {
  return poctStaffTypes.has(staffType);
}

export function isPoctAssignment(
  assignment: TrainingAssignmentSummary,
  poctLabIds: Set<number>,
) {
  return (
    poctLabIds.has(assignment.lab_id) || isPoctStaffType(assignment.staff_type)
  );
}

export function isPoctRecord(
  record: TrainingRecordSummary,
  poctLabIds: Set<number>,
) {
  return (
    poctLabIds.has(record.lab_id) ||
    isPoctStaffType(record.trainee_staff_type) ||
    record.lab_is_poc
  );
}

export function isPoctTemplate(
  template: TemplateSummary,
  poctLabIds: Set<number>,
) {
  return (
    poctLabIds.has(template.lab_id) ||
    isPoctStaffType(template.target_staff_type)
  );
}

export function buildPoctLabIdSet(labs: LabSummary[]) {
  return new Set(labs.filter((lab) => lab.is_poc).map((lab) => lab.id));
}
