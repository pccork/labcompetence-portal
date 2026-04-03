import { useCallback, useEffect, useState, useTransition } from "react";

import { CurrentUser, fetchCurrentUser, loginUser } from "../features/auth/api";
import { LoginPanel } from "../features/auth/LoginPanel";
import {
  fetchDueAssignments,
  fetchLabs,
  fetchTemplates,
  fetchTrainingRecords,
  LabSummary,
  TemplateSummary,
  TrainingAssignmentSummary,
  TrainingRecordSummary,
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
      const [me, labsResponse, templatesResponse, assignmentsResponse, recordsResponse] =
        await Promise.all([
          fetchCurrentUser(activeToken),
          fetchLabs(activeToken),
          fetchTemplates(activeToken),
          fetchDueAssignments(activeToken, 365),
          fetchTrainingRecords(activeToken),
        ]);

      setCurrentUser(me.user);
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
      labs={labs}
      templates={templates}
      assignments={assignments}
      records={records}
      onRefresh={() =>
        startTransition(() => {
          void loadDashboard(token);
        })
      }
      onSignOut={handleSignOut}
      errorMessage={errorMessage}
      isLoading={isPending}
    />
  );
}
