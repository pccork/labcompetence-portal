import { apiRequest } from "../../shared/api/client";

export interface HospitalSummary {
  id: number;
  name: string;
  created_at: string;
}

export interface DepartmentSummary {
  id: number;
  hospital_id: number;
  hospital_name: string;
  name: string;
  is_poc: boolean;
  is_active: boolean;
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
  is_global_admin: boolean;
  is_active: boolean;
  created_at: string;
}

export interface LabSummary {
  id: number;
  department_id: number;
  department_name: string;
  hospital_id: number;
  hospital_name: string;
  name: string;
  is_poc: boolean;
  is_active: boolean;
}

export interface TemplateSummary {
  id: number;
  name: string;
  lab_id: number;
  lab_name: string;
  department_id: number;
  department_name: string;
  lab_hospital_id: number;
  lab_hospital_name: string;
  form_family_reference: string;
  template_kind: string;
  target_staff_type: string;
  is_active: boolean;
  latest_version_id: number | null;
  latest_version_number: number | null;
}

export interface TemplateVersionSummary {
  id: number;
  template_id: number;
  version_number: number;
  schema_json: Record<string, unknown>;
  created_at: string;
}

export interface TemplateDetail extends TemplateSummary {
  versions: TemplateVersionSummary[];
}

export interface CreateTemplateInput {
  name: string;
  labId: number;
  formFamilyReference: string;
  templateKind: string;
  targetStaffType: string;
  isActive: boolean;
  schemaJson: Record<string, unknown>;
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
  department_id: number;
  department_name: string;
  lab_hospital_id: number;
  lab_hospital_name: string;
  assigned_by: number | null;
  assigned_by_name: string | null;
  renewal_interval_months: number;
  next_due_at: string;
  is_active: boolean;
}

export interface TrainingRecordSummary {
  id: number;
  trainee_id: number;
  trainee_hospital_id: number;
  trainee_hospital_name: string;
  trainee_name: string;
  trainee_email: string;
  trainee_staff_type: string;
  template_version_id: number;
  template_id: number;
  template_name: string;
  form_family_reference: string;
  template_kind: string;
  template_target_staff_type: string;
  version_number: number;
  lab_id: number;
  lab_name: string;
  department_id: number;
  department_name: string;
  lab_hospital_id: number;
  lab_hospital_name: string;
  lab_is_poc: boolean;
  assigned_trainer_id: number | null;
  assigned_trainer_name: string | null;
  training_assignment_id: number | null;
  status: string;
  assessment_payload_json: Record<string, unknown>;
  submitted_at: string;
  expires_at: string;
  scheduled_at: string | null;
  completed_at: string | null;
  trainee_signed_at: string | null;
  created_at: string;
}

export interface TrainingRecordSpecimenSummary {
  id: number;
  training_record_id: number;
  specimen_label: string;
  specimen_type: string | null;
  analyser_reference: string | null;
  processed_at: string | null;
  result_summary: string | null;
  created_at: string;
}

export interface TrainingRecordDetail extends TrainingRecordSummary {
  specimens: TrainingRecordSpecimenSummary[];
}

export interface CreateTrainingAssignmentInput {
  userId: number;
  templateId: number;
  renewalIntervalMonths: number;
  nextDueAt: string;
}

export interface CreateTrainingRecordInput {
  traineeId: number;
  templateVersionId: number;
  assignedTrainerId?: number | null;
  trainingAssignmentId?: number | null;
  scheduledAt?: string | null;
  completedAt?: string | null;
  traineeSignedAt?: string | null;
  assessmentPayloadJson?: Record<string, unknown>;
  specimens?: Array<{
    specimenLabel: string;
    specimenType?: string | null;
    analyserReference?: string | null;
    processedAt?: string | null;
    resultSummary?: string | null;
  }>;
  expiresAt: string;
  status?: string;
}

export interface CreateHospitalInput {
  name: string;
}

export interface CreateLabInput {
  hospitalId: number;
  departmentId?: number;
  departmentName?: string;
  name: string;
  isPoc?: boolean;
}

export interface CreateDepartmentInput {
  hospitalId: number;
  name: string;
  isPoc?: boolean;
}

export interface PocRegistrationLinkSummary {
  id: number;
  code: string;
  is_active: boolean;
  default_training_location: string | null;
  default_training_time_details: string | null;
  created_at: string;
  lab_id: number;
  lab_name: string;
  department_id: number;
  department_name: string;
  lab_is_poc: boolean;
  hospital_id: number;
  hospital_name: string;
}

export interface PocTrainingRequestSummary {
  id: number;
  registration_link_id: number;
  user_id: number | null;
  trainee_hospital_id: number;
  trainee_hospital_name: string;
  trainee_name: string;
  trainee_email: string;
  trainee_staff_type: string;
  lab_id: number;
  lab_name: string;
  department_id: number;
  department_name: string;
  lab_hospital_id: number;
  lab_hospital_name: string;
  lab_is_poc: boolean;
  is_training_approved: boolean;
  trainer_reply_status: string;
  training_location: string | null;
  training_time_details: string | null;
  trainer_message: string | null;
  responded_by: number | null;
  responder_name: string | null;
  responded_at: string | null;
  requested_at: string;
}

export interface CreatePocRegistrationLinkInput {
  labId: number;
  defaultTrainingLocation?: string;
  defaultTrainingTimeDetails?: string;
}

export interface ReplyToPocTrainingRequestInput {
  trainerReplyStatus: "scheduled" | "cancelled";
  trainingLocation?: string;
  trainingTimeDetails?: string;
  trainerMessage?: string;
}

export interface PocSelfRegistrationInput {
  hospitalId: number;
  name: string;
  email: string;
  staffType: string;
  password?: string;
}

export async function fetchLabs(token: string, includeArchived = false) {
  const query = includeArchived ? "?includeArchived=true" : "";

  return apiRequest<{ labs: LabSummary[] }>(`/labs${query}`, {}, token);
}

export async function fetchHospitals(token: string) {
  return apiRequest<{ hospitals: HospitalSummary[] }>("/hospitals", {}, token);
}

export async function fetchDepartments(token: string, includeArchived = false) {
  const query = includeArchived ? "?includeArchived=true" : "";

  return apiRequest<{ departments: DepartmentSummary[] }>(
    `/departments${query}`,
    {},
    token
  );
}

export async function fetchPublicHospitals() {
  return apiRequest<{ hospitals: HospitalSummary[] }>("/poc/hospitals");
}

export async function createHospital(
  token: string,
  input: CreateHospitalInput
) {
  return apiRequest<{ hospital: HospitalSummary }>(
    "/hospitals",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token
  );
}

export async function createDepartmentRecord(
  token: string,
  input: CreateDepartmentInput
) {
  return apiRequest<{ department: DepartmentSummary }>(
    "/departments",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token
  );
}

export async function archiveDepartmentRecord(token: string, departmentId: number) {
  return apiRequest<{ archived: boolean }>(
    `/departments/${departmentId}/archive`,
    {
      method: "PATCH",
    },
    token
  );
}

export async function restoreDepartmentRecord(token: string, departmentId: number) {
  return apiRequest<{ restored: boolean }>(
    `/departments/${departmentId}/restore`,
    {
      method: "PATCH",
    },
    token
  );
}

export async function deleteDepartmentRecord(token: string, departmentId: number) {
  return apiRequest<{ deleted: boolean }>(
    `/departments/${departmentId}`,
    {
      method: "DELETE",
    },
    token
  );
}

export async function fetchUsers(token: string) {
  return apiRequest<{ users: UserSummary[] }>("/users", {}, token);
}

export async function createLabSection(
  token: string,
  input: CreateLabInput
) {
  return apiRequest<{ lab: LabSummary }>(
    "/labs",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token
  );
}

export async function archiveLabSection(token: string, labId: number) {
  return apiRequest<{ archived: boolean }>(
    `/labs/${labId}/archive`,
    {
      method: "PATCH",
    },
    token
  );
}

export async function restoreLabSection(token: string, labId: number) {
  return apiRequest<{ restored: boolean }>(
    `/labs/${labId}/restore`,
    {
      method: "PATCH",
    },
    token
  );
}

export async function deleteLabSection(token: string, labId: number) {
  return apiRequest<{ deleted: boolean }>(
    `/labs/${labId}`,
    {
      method: "DELETE",
    },
    token
  );
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

export async function archiveUserAccount(token: string, userId: number) {
  return apiRequest<{ user: UserSummary }>(
    `/users/${userId}/archive`,
    {
      method: "PATCH",
      body: JSON.stringify({ archive: true }),
    },
    token
  );
}

export async function fetchTemplates(token: string) {
  return apiRequest<{ templates: TemplateSummary[] }>("/templates", {}, token);
}

export async function fetchTemplateDetail(
  token: string,
  templateId: number
) {
  return apiRequest<{ template: TemplateDetail }>(
    `/templates/${templateId}`,
    {},
    token
  );
}

export async function createTemplate(
  token: string,
  input: CreateTemplateInput
) {
  return apiRequest<{ template: TemplateSummary }>(
    "/templates",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token
  );
}

export async function deleteTemplateRecord(token: string, templateId: number) {
  return apiRequest<{ deleted: boolean }>(
    `/templates/${templateId}`,
    {
      method: "DELETE",
    },
    token
  );
}

export async function restoreTemplateRecord(token: string, templateId: number) {
  return apiRequest<{ template: TemplateSummary }>(
    `/templates/${templateId}/restore`,
    {
      method: "PATCH",
    },
    token
  );
}

export async function updateTemplate(
  token: string,
  templateId: number,
  input: CreateTemplateInput
) {
  return apiRequest<{ template: TemplateSummary }>(
    `/templates/${templateId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
    token
  );
}

export async function fetchDueAssignments(token: string, days = 90) {
  return apiRequest<{ assignments: TrainingAssignmentSummary[] }>(
    `/training-assignments/due?days=${days}`,
    {},
    token
  );
}

export async function fetchTrainingAssignments(token: string) {
  return apiRequest<{ assignments: TrainingAssignmentSummary[] }>(
    "/training-assignments",
    {},
    token
  );
}

export async function createTrainingAssignment(
  token: string,
  input: CreateTrainingAssignmentInput
) {
  return apiRequest<{ assignment: TrainingAssignmentSummary }>(
    "/training-assignments",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
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

export async function fetchTrainingRecordDetail(
  token: string,
  recordId: number
) {
  return apiRequest<{ record: TrainingRecordDetail }>(
    `/training-records/${recordId}`,
    {},
    token
  );
}

export async function createTrainingRecord(
  token: string,
  input: CreateTrainingRecordInput
) {
  return apiRequest<{ record: TrainingRecordSummary }>(
    "/training-records",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token
  );
}

export async function fetchPocRegistrationLinks(token: string) {
  return apiRequest<{ registrationLinks: PocRegistrationLinkSummary[] }>(
    "/poc/registration-links",
    {},
    token
  );
}

export async function createPocRegistrationLink(
  token: string,
  input: CreatePocRegistrationLinkInput
) {
  return apiRequest<{ registrationLink: PocRegistrationLinkSummary }>(
    "/poc/registration-links",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token
  );
}

export async function fetchPublicPocRegistrationLink(code: string) {
  return apiRequest<{ registrationLink: PocRegistrationLinkSummary }>(
    `/poc/registration-links/${code}`
  );
}

export async function registerFromPocLink(
  code: string,
  input: PocSelfRegistrationInput
) {
  return apiRequest<{
    registration: {
      registrationLink: PocRegistrationLinkSummary;
      trainingRequest: PocTrainingRequestSummary;
    };
  }>(`/poc/registration-links/${code}/register`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchPocTrainingRequests(token: string) {
  return apiRequest<{ requests: PocTrainingRequestSummary[] }>(
    "/poc/training-requests",
    {},
    token
  );
}

export async function replyToPocTrainingRequest(
  token: string,
  requestId: number,
  input: ReplyToPocTrainingRequestInput
) {
  return apiRequest<{ trainingRequest: PocTrainingRequestSummary }>(
    `/poc/training-requests/${requestId}/reply`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    token
  );
}
