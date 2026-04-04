import { useCallback, useEffect, useState, useTransition } from "react";

import { CurrentUser, fetchCurrentUser, loginUser } from "../features/auth/api";
import { LoginPanel } from "../features/auth/LoginPanel";
import {
  createTrainingAssignment,
  createTrainingRecord,
  createTemplate,
  CreateTrainingAssignmentInput,
  CreateTrainingRecordInput,
  CreateTemplateInput,
  createUserAccount,
  fetchHospitals,
  fetchLabs,
  fetchTemplateDetail,
  fetchTemplates,
  fetchTrainingAssignments,
  fetchTrainingRecordDetail,
  fetchTrainingRecords,
  fetchUsers,
  HospitalSummary,
  LabSummary,
  TemplateSummary,
  TrainingAssignmentSummary,
  TrainingRecordSummary,
  updateTemplate,
  UserSummary,
} from "../features/dashboard/api";
import { DashboardShell } from "../features/dashboard/DashboardShell";
import {
  clearSession,
  loadSession,
  saveSession,
} from "../shared/session/sessionStore";

export function App() {
  const [token, setToken] = useState(() => loadSession()?.token || null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [labs, setLabs] = useState<LabSummary[]>([]);
  const [hospitals, setHospitals] = useState<HospitalSummary[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignmentSummary[]>(
    []
  );
  const [records, setRecords] = useState<TrainingRecordSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadDashboard = useCallback(async (activeToken: string) => {
    setErrorMessage(null);

    try {
      const [
        me,
        hospitalsResponse,
        usersResponse,
        labsResponse,
        templatesResponse,
        assignmentsResponse,
        recordsResponse,
      ] = await Promise.all([
        fetchCurrentUser(activeToken),
        fetchHospitals(activeToken),
          fetchUsers(activeToken),
          fetchLabs(activeToken),
          fetchTemplates(activeToken),
          fetchTrainingAssignments(activeToken),
          fetchTrainingRecords(activeToken),
      ]);

      setCurrentUser(me.user);
      setHospitals(hospitalsResponse.hospitals);
      setUsers(usersResponse.users);
      setLabs(labsResponse.labs);
      setTemplates(templatesResponse.templates);
      setAssignments(assignmentsResponse.assignments);
      setRecords(recordsResponse.records);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load dashboard data"
      );
    }
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    startTransition(() => {
      void loadDashboard(token);
    });
  }, [loadDashboard, token]);

  const handleLogin = async (email: string, password: string) => {
    setErrorMessage(null);

    try {
      const response = await loginUser(email, password);
      setToken(response.token);
      saveSession({ token: response.token });
      await loadDashboard(response.token);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to sign in"
      );
    }
  };

  const handleSignOut = () => {
    clearSession();
    setToken(null);
    setCurrentUser(null);
    setHospitals([]);
    setUsers([]);
    setLabs([]);
    setTemplates([]);
    setAssignments([]);
    setRecords([]);
    setErrorMessage(null);
  };

  if (!token || !currentUser) {
    return <LoginPanel onLogin={handleLogin} errorMessage={errorMessage} />;
  }

  return (
    <DashboardShell
      currentUser={currentUser}
      hospitals={hospitals}
      users={users}
      labs={labs}
      templates={templates}
      assignments={assignments}
      records={records}
      onRefresh={() =>
        startTransition(() => {
          void loadDashboard(token);
        })
      }
      onCreateUser={async (input) => {
        await createUserAccount(token, input);
        await loadDashboard(token);
      }}
      onCreateTemplate={async (input: CreateTemplateInput) => {
        await createTemplate(token, input);
        await loadDashboard(token);
      }}
      onArchiveTemplate={async (template) => {
        await updateTemplate(token, template.id, {
          name: template.name,
          labId: template.lab_id,
          formFamilyReference: template.form_family_reference,
          templateKind: template.template_kind,
          targetStaffType: template.target_staff_type,
          isActive: false,
          schemaJson: {},
        });
        await loadDashboard(token);
      }}
      onFetchTemplateDetail={(templateId: number) =>
        fetchTemplateDetail(token, templateId)
      }
      onCreateAssignment={async (
        input: CreateTrainingAssignmentInput
      ) => {
        await createTrainingAssignment(token, input);
        await loadDashboard(token);
      }}
      onCreateRecord={async (input: CreateTrainingRecordInput) => {
        await createTrainingRecord(token, input);
        await loadDashboard(token);
      }}
      onFetchRecordDetail={(recordId: number) =>
        fetchTrainingRecordDetail(token, recordId)
      }
      onSignOut={handleSignOut}
      errorMessage={errorMessage}
      isLoading={isPending}
    />
  );
}
