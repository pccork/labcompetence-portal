import { apiRequest } from "../../shared/api/client";

export interface LabSummary {
  id: number;
  hospital_id: number;
  hospital_name: string;
  name: string;
  is_poc: boolean;
}

export interface TemplateSummary {
  id: number;
  name: string;
  lab_name: string;
  lab_hospital_name: string;
  form_family_reference: string;
  template_kind: string;
  target_staff_type: string;
  is_active: boolean;
  latest_version_number: number | null;
}

export interface TrainingAssignmentSummary {
  id: number;
  trainee_name: string;
  trainee_email: string;
  staff_type: string;
  template_name: string;
  lab_name: string;
  lab_hospital_name: string;
  renewal_interval_months: number;
  next_due_at: string;
  is_active: boolean;
}

export interface TrainingRecordSummary {
  id: number;
  trainee_name: string;
  trainee_email: string;
  trainee_staff_type: string;
  template_name: string;
  lab_name: string;
  lab_hospital_name: string;
  status: string;
  expires_at: string;
  scheduled_at: string | null;
  completed_at: string | null;
}

export async function fetchLabs(token: string) {
  return apiRequest<{ labs: LabSummary[] }>("/labs", {}, token);
}

export async function fetchTemplates(token: string) {
  return apiRequest<{ templates: TemplateSummary[] }>("/templates", {}, token);
}

export async function fetchDueAssignments(token: string, days = 90) {
  return apiRequest<{ assignments: TrainingAssignmentSummary[] }>(
    `/training-assignments/due?days=${days}`,
    {},
    token
  );
}

export async function fetchTrainingRecords(token: string) {
  return apiRequest<{ records: TrainingRecordSummary[] }>(
    "/training-records",
    {},
    token
  );
}
