import { useCallback, useEffect, useState, useTransition } from "react";

import { CurrentUser, fetchCurrentUser, loginUser } from "../features/auth/api";
import { LoginPanel } from "../features/auth/LoginPanel";
import {
  createTemplate,
  CreateTemplateInput,
  createUserAccount,
  fetchDueAssignments,
  fetchHospitals,
  fetchLabs,
  fetchTemplates,
  fetchTrainingRecords,
  fetchUsers,
  HospitalSummary,
  LabSummary,
  TemplateSummary,
  TrainingAssignmentSummary,
  TrainingRecordSummary,
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
        fetchDueAssignments(activeToken, 365),
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
      onSignOut={handleSignOut}
      errorMessage={errorMessage}
      isLoading={isPending}
    />
  );
}
