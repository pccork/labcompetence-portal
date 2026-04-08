import { useCallback, useEffect, useState, useTransition } from "react";

import {
  AuthProvidersConfig,
  CurrentUser,
  fetchAuthProvidersConfig,
  fetchCurrentUser,
  loginUser,
  loginWithMicrosoftCode,
} from "../features/auth/api";
import { LoginPanel } from "../features/auth/LoginPanel";
import {
  beginMicrosoftLogin,
  clearPendingMicrosoftAuth,
  getPendingMicrosoftAuth,
} from "../features/auth/microsoftAuth";
import {
  archiveDepartmentRecord,
  archiveLabSection,
  archiveUserAccount,
  createDepartmentRecord,
  createHospital,
  createLabSection,
  CreateDepartmentInput,
  deleteDepartmentRecord,
  deleteLabSection,
  deleteTemplateRecord,
  createPocRegistrationLink,
  createTrainingAssignment,
  createTrainingRecord,
  createTemplate,
  DepartmentSummary,
  CreateTrainingAssignmentInput,
  CreatePocRegistrationLinkInput,
  CreateTrainingRecordInput,
  CreateTemplateInput,
  createUserAccount,
  fetchDepartments,
  fetchPocRegistrationLinks,
  fetchPocTrainingRequests,
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
  PocRegistrationLinkSummary,
  PocTrainingRequestSummary,
  replyToPocTrainingRequest,
  restoreDepartmentRecord,
  restoreLabSection,
  restoreTemplateRecord,
  TemplateSummary,
  TrainingAssignmentSummary,
  TrainingRecordSummary,
  updateTemplate,
  UserSummary,
} from "../features/dashboard/api";
import { DashboardShell } from "../features/dashboard/DashboardShell";
import { PocRegistrationPage } from "../features/poc/PocRegistrationPage";
import {
  clearSession,
  loadSession,
  saveSession,
} from "../shared/session/sessionStore";

export function App() {
  const pathname = window.location.pathname;
  const pocRegistrationMatch = pathname.match(/^\/poc\/register\/([^/]+)$/);
  const registrationCode = pocRegistrationMatch?.[1] ?? null;
  const [token, setToken] = useState(() => loadSession()?.token || null);
  const [authConfig, setAuthConfig] = useState<AuthProvidersConfig | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [labs, setLabs] = useState<LabSummary[]>([]);
  const [archivedLabs, setArchivedLabs] = useState<LabSummary[]>([]);
  const [hospitals, setHospitals] = useState<HospitalSummary[]>([]);
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [archivedDepartments, setArchivedDepartments] = useState<
    DepartmentSummary[]
  >([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [registrationLinks, setRegistrationLinks] = useState<
    PocRegistrationLinkSummary[]
  >([]);
  const [poctRequests, setPoctRequests] = useState<PocTrainingRequestSummary[]>(
    [],
  );
  const [assignments, setAssignments] = useState<TrainingAssignmentSummary[]>(
    []
  );
  const [records, setRecords] = useState<TrainingRecordSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMicrosoftPending, setIsMicrosoftPending] = useState(false);
  const [isPending, startTransition] = useTransition();

  const clearMicrosoftCallbackParams = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    url.searchParams.delete("session_state");
    url.searchParams.delete("error");
    url.searchParams.delete("error_description");
    window.history.replaceState({}, document.title, url.toString());
  }, []);

  const loadDashboard = useCallback(async (activeToken: string) => {
    setErrorMessage(null);

    try {
      const me = await fetchCurrentUser(activeToken);

      const commonRequests = await Promise.all([
        fetchHospitals(activeToken),
        fetchDepartments(activeToken, true),
        fetchUsers(activeToken),
        fetchLabs(activeToken, true),
        fetchTemplates(activeToken),
      ]);

      const [
        hospitalsResponse,
        departmentsResponse,
        usersResponse,
        labsResponse,
        templatesResponse,
      ] = commonRequests;

      const workflowResponses = me.user.is_global_admin
        ? {
            assignments: { assignments: [] as TrainingAssignmentSummary[] },
            records: { records: [] as TrainingRecordSummary[] },
            registrationLinks: {
              registrationLinks: [] as PocRegistrationLinkSummary[],
            },
            poctRequests: { requests: [] as PocTrainingRequestSummary[] },
          }
        : me.user.role !== "admin"
          ? {
              assignments: await fetchTrainingAssignments(activeToken),
              records: await fetchTrainingRecords(activeToken),
              registrationLinks: {
                registrationLinks: [] as PocRegistrationLinkSummary[],
              },
              poctRequests: { requests: [] as PocTrainingRequestSummary[] },
            }
        : await Promise.all([
            fetchTrainingAssignments(activeToken),
            fetchTrainingRecords(activeToken),
            fetchPocRegistrationLinks(activeToken),
            fetchPocTrainingRequests(activeToken),
          ]).then(([assignments, records, registrationLinks, poctRequests]) => ({
            assignments,
            records,
            registrationLinks,
            poctRequests,
          }));

      setCurrentUser(me.user);
      setHospitals(hospitalsResponse.hospitals);
      setDepartments(
        departmentsResponse.departments.filter((department) => department.is_active)
      );
      setArchivedDepartments(
        departmentsResponse.departments.filter((department) => !department.is_active)
      );
      setUsers(usersResponse.users);
      setLabs(labsResponse.labs.filter((lab) => lab.is_active));
      setArchivedLabs(labsResponse.labs.filter((lab) => !lab.is_active));
      setTemplates(templatesResponse.templates);
      setAssignments(workflowResponses.assignments.assignments);
      setRecords(workflowResponses.records.records);
      setRegistrationLinks(workflowResponses.registrationLinks.registrationLinks);
      setPoctRequests(workflowResponses.poctRequests.requests);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load dashboard data"
      );
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      void fetchAuthProvidersConfig()
        .then((config) => {
          setAuthConfig(config);
        })
        .catch((error) => {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load sign-in options"
          );
        });
    });
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    startTransition(() => {
      void loadDashboard(token);
    });
  }, [loadDashboard, token]);

  useEffect(() => {
    if (token || !authConfig?.microsoft.enabled) {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const authError = searchParams.get("error");
    const authErrorDescription = searchParams.get("error_description");

    if (!code && !authError) {
      return;
    }

    if (authError) {
      clearPendingMicrosoftAuth();
      clearMicrosoftCallbackParams();
      setErrorMessage(authErrorDescription || "Microsoft sign-in was cancelled");
      return;
    }

    const pendingAuth = getPendingMicrosoftAuth();

    if (!code || !state || !pendingAuth || pendingAuth.state !== state) {
      clearPendingMicrosoftAuth();
      clearMicrosoftCallbackParams();
      setErrorMessage("Microsoft sign-in session could not be verified");
      return;
    }

    setIsMicrosoftPending(true);
    setErrorMessage(null);

    startTransition(() => {
      void loginWithMicrosoftCode(
        code,
        pendingAuth.codeVerifier,
        pendingAuth.redirectUri
      )
        .then(async (response) => {
          setToken(response.token);
          saveSession({ token: response.token });
          clearPendingMicrosoftAuth();
          clearMicrosoftCallbackParams();
          await loadDashboard(response.token);
        })
        .catch((error) => {
          clearPendingMicrosoftAuth();
          clearMicrosoftCallbackParams();
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to sign in with Microsoft"
          );
        })
        .finally(() => {
          setIsMicrosoftPending(false);
        });
    });
  }, [authConfig, clearMicrosoftCallbackParams, loadDashboard, token]);

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

  const handleMicrosoftLogin = async () => {
    if (
      !authConfig?.microsoft.enabled ||
      !authConfig.microsoft.clientId ||
      !authConfig.microsoft.tenantId
    ) {
      throw new Error("Microsoft sign-in is not configured");
    }

    setErrorMessage(null);
    setIsMicrosoftPending(true);

    try {
      await beginMicrosoftLogin({
        clientId: authConfig.microsoft.clientId,
        tenantId: authConfig.microsoft.tenantId,
      });
    } catch (error) {
      setIsMicrosoftPending(false);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to start Microsoft sign-in"
      );
    }
  };

  const handleSignOut = () => {
    clearSession();
    clearPendingMicrosoftAuth();
    setToken(null);
    setCurrentUser(null);
    setHospitals([]);
    setDepartments([]);
    setArchivedDepartments([]);
    setUsers([]);
    setLabs([]);
    setArchivedLabs([]);
    setTemplates([]);
    setRegistrationLinks([]);
    setPoctRequests([]);
    setAssignments([]);
    setRecords([]);
    setErrorMessage(null);
  };

  if (registrationCode) {
    return <PocRegistrationPage code={registrationCode} />;
  }

  if (!token || !currentUser) {
    return (
      <LoginPanel
        onLogin={handleLogin}
        onMicrosoftLogin={handleMicrosoftLogin}
        errorMessage={errorMessage}
        localEnabled={authConfig?.local.enabled ?? false}
        microsoftEnabled={authConfig?.microsoft.enabled ?? false}
        microsoftEmailDomain={authConfig?.microsoft.allowedEmailDomain ?? null}
        authConfigReady={Boolean(authConfig)}
        isMicrosoftPending={isMicrosoftPending}
      />
    );
  }

  return (
    <DashboardShell
      currentUser={currentUser}
      hospitals={hospitals}
      departments={departments}
      archivedDepartments={archivedDepartments}
      users={users}
      labs={labs}
      archivedLabs={archivedLabs}
      templates={templates}
      assignments={assignments}
      records={records}
      registrationLinks={registrationLinks}
      poctRequests={poctRequests}
      onRefresh={() =>
        startTransition(() => {
          void loadDashboard(token);
        })
      }
      onCreateUser={async (input) => {
        await createUserAccount(token, input);
        await loadDashboard(token);
      }}
      onCreateHospital={async (input) => {
        await createHospital(token, input);
        await loadDashboard(token);
      }}
      onCreateDepartment={async (input: CreateDepartmentInput) => {
        await createDepartmentRecord(token, input);
        await loadDashboard(token);
      }}
      onArchiveDepartment={async (departmentId: number) => {
        await archiveDepartmentRecord(token, departmentId);
        await loadDashboard(token);
      }}
      onRestoreDepartment={async (departmentId: number) => {
        await restoreDepartmentRecord(token, departmentId);
        await loadDashboard(token);
      }}
      onDeleteDepartment={async (departmentId: number) => {
        await deleteDepartmentRecord(token, departmentId);
        await loadDashboard(token);
      }}
      onCreateLab={async (input) => {
        await createLabSection(token, input);
        await loadDashboard(token);
      }}
      onArchiveLab={async (labId: number) => {
        await archiveLabSection(token, labId);
        await loadDashboard(token);
      }}
      onRestoreLab={async (labId: number) => {
        await restoreLabSection(token, labId);
        await loadDashboard(token);
      }}
      onDeleteLab={async (labId: number) => {
        await deleteLabSection(token, labId);
        await loadDashboard(token);
      }}
      onArchiveUser={async (userId: number) => {
        await archiveUserAccount(token, userId);
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
      onDeleteTemplate={async (templateId: number) => {
        await deleteTemplateRecord(token, templateId);
        await loadDashboard(token);
      }}
      onRestoreTemplate={async (templateId: number) => {
        await restoreTemplateRecord(token, templateId);
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
      onCreatePocRegistrationLink={async (
        input: CreatePocRegistrationLinkInput,
      ) => {
        await createPocRegistrationLink(token, input);
        await loadDashboard(token);
      }}
      onReplyToPocRequest={async (requestId, input) => {
        await replyToPocTrainingRequest(token, requestId, input);
        await loadDashboard(token);
      }}
      onSignOut={handleSignOut}
      errorMessage={errorMessage}
      isLoading={isPending}
    />
  );
}
