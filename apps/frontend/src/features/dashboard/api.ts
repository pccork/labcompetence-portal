import { apiRequest } from "../../shared/api/client";

export interface HospitalSummary {
  id: number;
  name: string;
  created_at: string;
}

export interface UserSummary {
  id: number;
  hospital_id: number;
  hospital_name: string;
  name: string;
  email: string;
  role: string;
  staff_type: string;
  created_at: string;
}

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
  lab_id: number;
  lab_name: string;
  lab_hospital_id: number;
  lab_hospital_name: string;
  form_family_reference: string;
  template_kind: string;
  target_staff_type: string;
  is_active: boolean;
  latest_version_number: number | null;
}

export interface TrainingAssignmentSummary {
  id: number;
  user_id: number;
  trainee_name: string;
  trainee_email: string;
  staff_type: string;
  template_id: number;
  template_name: string;
  lab_id: number;
  lab_name: string;
  lab_hospital_id: number;
  lab_hospital_name: string;
  renewal_interval_months: number;
  next_due_at: string;
  is_active: boolean;
}

export interface TrainingRecordSummary {
  id: number;
  trainee_id: number;
  trainee_name: string;
  trainee_email: string;
  trainee_staff_type: string;
  template_id: number;
  template_name: string;
  lab_id: number;
  lab_name: string;
  lab_hospital_id: number;
  lab_hospital_name: string;
  status: string;
  expires_at: string;
  scheduled_at: string | null;
  completed_at: string | null;
}

export async function fetchLabs(token: string) {
  return apiRequest<{ labs: LabSummary[] }>("/labs", {}, token);
}

export async function fetchHospitals(token: string) {
  return apiRequest<{ hospitals: HospitalSummary[] }>("/hospitals", {}, token);
}

export async function fetchUsers(token: string) {
  return apiRequest<{ users: UserSummary[] }>("/users", {}, token);
}

export async function createUserAccount(
  token: string,
  input: {
    hospitalId: number;
    name: string;
    email: string;
    password: string;
    role: string;
    staffType: string;
  }
) {
  return apiRequest<{ user: UserSummary }>(
    "/users",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token
  );
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
