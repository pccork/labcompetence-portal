import { useMemo, useState } from "react";

import { CurrentUser } from "../auth/api";
import {
  CreateTrainingAssignmentInput,
  CreateDepartmentInput,
  CreateLabInput,
  CreatePocRegistrationLinkInput,
  CreateTrainingRecordInput,
  CreateTemplateInput,
  HospitalSummary,
  DepartmentSummary,
  LabSummary,
  PocRegistrationLinkSummary,
  PocTrainingRequestSummary,
  ReplyToPocTrainingRequestInput,
  TemplateSummary,
  TemplateDetail,
  TrainingAssignmentSummary,
  TrainingRecordDetail,
  TrainingRecordSummary,
  UpdateTrainingAssignmentInput,
  UserSummary,
} from "./api";
import { DashboardMetrics } from "./components/DashboardMetrics";
import { GlobalAdminOverviewPanel } from "./components/GlobalAdminOverviewPanel";
import { LabsPanel } from "./components/LabsPanel";
import { PoctCoordinatorOverviewPanel } from "./components/PoctCoordinatorOverviewPanel";
import { PoctRequestPanel } from "./components/PoctRequestPanel";
import { TemplatesPanel } from "./components/TemplatesPanel";
import { TrainingAssignmentsPanel } from "./components/TrainingAssignmentsPanel";
import { TrainingRecordsPanel } from "./components/TrainingRecordsPanel";
import {
  buildPoctLabIdSet,
  isPoctAssignment,
  isPoctStaffType,
  isPoctTemplate,
} from "./components/poctDashboardUtils";
import { UsersPanel } from "./components/UsersPanel";
import { getAccountScopeLabel } from "./components/roleLabels";

interface DashboardShellProps {
  currentUser: CurrentUser;
  hospitals: HospitalSummary[];
  departments: DepartmentSummary[];
  archivedDepartments: DepartmentSummary[];
  users: UserSummary[];
  labs: LabSummary[];
  archivedLabs: LabSummary[];
  templates: TemplateSummary[];
  assignments: TrainingAssignmentSummary[];
  records: TrainingRecordSummary[];
  registrationLinks: PocRegistrationLinkSummary[];
  poctRequests: PocTrainingRequestSummary[];
  onRefresh: () => void;
  onCreateUser: (input: {
    hospitalId: number;
    name: string;
    email: string;
    password: string;
    role: string;
    staffType: string;
  }) => Promise<void>;
  onCreateHospital: (input: { name: string }) => Promise<void>;
  onCreateDepartment: (input: CreateDepartmentInput) => Promise<void>;
  onArchiveDepartment: (departmentId: number) => Promise<void>;
  onRestoreDepartment: (departmentId: number) => Promise<void>;
  onDeleteDepartment: (departmentId: number) => Promise<void>;
  onCreateLab: (input: CreateLabInput) => Promise<void>;
  onArchiveLab: (labId: number) => Promise<void>;
  onRestoreLab: (labId: number) => Promise<void>;
  onDeleteLab: (labId: number) => Promise<void>;
  onArchiveUser: (userId: number) => Promise<void>;
  onCreateTemplate: (input: CreateTemplateInput) => Promise<void>;
  onArchiveTemplate: (template: TemplateSummary) => Promise<void>;
  onDeleteTemplate: (templateId: number) => Promise<void>;
  onRestoreTemplate: (templateId: number) => Promise<void>;
  onFetchTemplateDetail: (
    templateId: number,
  ) => Promise<{ template: TemplateDetail }>;
  onCreateAssignment: (input: CreateTrainingAssignmentInput) => Promise<void>;
  onUpdateAssignment: (
    assignmentId: number,
    input: UpdateTrainingAssignmentInput,
  ) => Promise<void>;
  onCreateRecord: (input: CreateTrainingRecordInput) => Promise<void>;
  onFetchRecordDetail: (
    recordId: number,
  ) => Promise<{ record: TrainingRecordDetail }>;
  onCreatePocRegistrationLink: (
    input: CreatePocRegistrationLinkInput,
  ) => Promise<void>;
  onDeletePocRegistrationLink: (code: string) => Promise<void>;
  onUpdatePocRegistrationLinkStatus: (
    code: string,
    isActive: boolean,
  ) => Promise<void>;
  onReplyToPocRequest: (
    requestId: number,
    input: ReplyToPocTrainingRequestInput,
  ) => Promise<void>;
  onSignOut: () => void;
  errorMessage: string | null;
  isLoading: boolean;
}

const standardDashboardViews = [
  { id: "overview", label: "Overview" },
  { id: "poct-requests", label: "POCT requests" },
  { id: "users", label: "Users" },
  { id: "assignments", label: "Due training" },
  { id: "templates", label: "Templates" },
  { id: "records", label: "Records" },
  { id: "labs", label: "Section setup" },
] as const;

const globalAdminViews = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "templates", label: "Templates" },
  { id: "labs", label: "Setup" },
] as const;

type DashboardView =
  | (typeof standardDashboardViews)[number]["id"]
  | (typeof globalAdminViews)[number]["id"];

function getDaysUntil(value: string) {
  const deltaMs = new Date(value).getTime() - Date.now();
  return Math.ceil(deltaMs / (1000 * 60 * 60 * 24));
}

export function DashboardShell({
  currentUser,
  hospitals,
  departments,
  archivedDepartments,
  users,
  labs,
  archivedLabs,
  templates,
  assignments,
  records,
  registrationLinks,
  poctRequests,
  onRefresh,
  onCreateUser,
  onCreateHospital,
  onCreateDepartment,
  onArchiveDepartment,
  onRestoreDepartment,
  onDeleteDepartment,
  onCreateLab,
  onArchiveLab,
  onRestoreLab,
  onDeleteLab,
  onArchiveUser,
  onCreateTemplate,
  onArchiveTemplate,
  onDeleteTemplate,
  onRestoreTemplate,
  onFetchTemplateDetail,
  onCreateAssignment,
  onUpdateAssignment,
  onCreateRecord,
  onFetchRecordDetail,
  onCreatePocRegistrationLink,
  onDeletePocRegistrationLink,
  onUpdatePocRegistrationLinkStatus,
  onReplyToPocRequest,
  onSignOut,
  errorMessage,
  isLoading,
}: DashboardShellProps) {
  const [activeView, setActiveView] = useState<DashboardView>("overview");
  const [selectedLabId, setSelectedLabId] = useState<number | "all">("all");
  const poctLabIds = useMemo(() => buildPoctLabIdSet(labs), [labs]);
  const isLocalCoordinator =
    currentUser.role === "admin" && !currentUser.is_global_admin;
  const hasPoctOnlyScope = labs.length > 0 && labs.every((lab) => lab.is_poc);

  const selectedLabName = useMemo(() => {
    if (currentUser.is_global_admin) {
      return "All hospitals";
    }

    if (selectedLabId === "all") {
      return "All sections";
    }

    const selectedLab = labs.find((lab) => lab.id === selectedLabId);

    return selectedLab
      ? `${selectedLab.department_name} / ${selectedLab.name}`
      : "Selected section";
  }, [currentUser.is_global_admin, labs, selectedLabId]);

  const filteredAssignments = useMemo(() => {
    if (selectedLabId === "all") {
      return assignments;
    }

    return assignments.filter(
      (assignment) => assignment.lab_id === selectedLabId,
    );
  }, [assignments, selectedLabId]);

  const filteredTemplates = useMemo(() => {
    if (selectedLabId === "all") {
      return templates;
    }

    return templates.filter((template) => template.lab_id === selectedLabId);
  }, [selectedLabId, templates]);

  const filteredRecords = useMemo(() => {
    if (selectedLabId === "all") {
      return records;
    }

    return records.filter((record) => record.lab_id === selectedLabId);
  }, [records, selectedLabId]);

  const dueSoonCount = useMemo(
    () =>
      filteredAssignments.filter(
        (assignment) => getDaysUntil(assignment.next_due_at) <= 30,
      ).length,
    [filteredAssignments],
  );

  const activeTemplateCount = useMemo(
    () => filteredTemplates.filter((template) => template.is_active).length,
    [filteredTemplates],
  );

  const poctAssignments = useMemo(
    () =>
      assignments.filter((assignment) =>
        isPoctAssignment(assignment, poctLabIds),
      ),
    [assignments, poctLabIds],
  );

  const poctActiveTemplateCount = useMemo(
    () =>
      templates.filter(
        (template) =>
          template.is_active && isPoctTemplate(template, poctLabIds),
      ).length,
    [poctLabIds, templates],
  );

  const poctTraineeCount = useMemo(() => {
    const poctTraineeIds = new Set<number>();

    users.forEach((user) => {
      if (user.role !== "admin" && isPoctStaffType(user.staff_type)) {
        poctTraineeIds.add(user.id);
      }
    });

    poctAssignments.forEach((assignment) =>
      poctTraineeIds.add(assignment.user_id),
    );

    return poctTraineeIds.size;
  }, [poctAssignments, users]);

  const poctDueSoonCount = useMemo(
    () =>
      poctAssignments.filter(
        (assignment) => getDaysUntil(assignment.next_due_at) <= 30,
      ).length,
    [poctAssignments],
  );
  const showPoctCoordinatorDashboard =
    isLocalCoordinator &&
    hasPoctOnlyScope &&
    (poctLabIds.size > 0 || poctAssignments.length > 0 || poctTraineeCount > 0);
  const isBasicGradeStandardUser =
    currentUser.role === "staff" &&
    currentUser.staff_type === "basic_grade_scientist";
  const canManageLocalSetup =
    currentUser.role === "admin" ||
    currentUser.staff_type === "training_coordinator" ||
    currentUser.staff_type === "senior_medical_scientist";
  const dashboardViews = currentUser.is_global_admin
    ? globalAdminViews
    : standardDashboardViews.filter((view) =>
        view.id === "poct-requests" ? showPoctCoordinatorDashboard : true,
      );

  const dashboardMetrics = currentUser.is_global_admin
    ? [
        {
          label: "Hospitals",
          value: hospitals.length,
          helper: "Hospital sites in the system",
        },
        {
          label: "Sections",
          value: labs.length,
          helper: "Training sections across all hospitals",
        },
        {
          label: "Users",
          value: users.length,
          helper: "Active staff accounts in the portal",
        },
        {
          label: "Admin roles",
          value: users.filter((user) => user.role === "admin").length,
          helper: "Global and local admin / coordinator accounts",
          accent: true,
        },
      ]
    : showPoctCoordinatorDashboard
      ? [
          {
            label: "POCT pathways",
            value: labs.filter((lab) => lab.is_poc).length,
            helper: "Point-of-care sections under coordination",
          },
          {
            label: "POCT templates",
            value: poctActiveTemplateCount,
            helper: "Active competency forms for POCT workflows",
          },
          {
            label: "POCT trainees",
            value: poctTraineeCount,
            helper: "Users actively tracked in the POCT pathway",
          },
          {
            label: "POCT due < 30 days",
            value: poctDueSoonCount,
            helper: "Needs trainer or coordinator follow-up",
            accent: true,
          },
        ]
      : [
          {
            label: "Labs",
            value: labs.length,
            helper: "Sections available in your scope",
          },
          {
            label: "Templates",
            value: activeTemplateCount,
            helper: "Active digital competency forms",
          },
          {
            label: "Assignments",
            value: filteredAssignments.length,
            helper: "Current section training assignments",
          },
          {
            label: "Due < 30 days",
            value: dueSoonCount,
            helper: "Needs trainer/co-ordinator follow-up",
            accent: true,
          },
        ];

  return (
    <div className="portal-layout">
      <aside className="portal-sidebar">
        <div className="brand-block">
          <p className="eyebrow">Lab competence</p>
          <h1 className="title is-4 mb-1">Training portal</h1>
          <p className="list-meta">
            ISO-aligned training oversight for staff, trainers, and
            co-ordinators.
          </p>
        </div>

        <nav className="side-nav">
          {dashboardViews.map((view) => (
            <button
              className={`side-nav-item ${
                activeView === view.id ? "is-active" : ""
              }`}
              key={view.id}
              onClick={() => setActiveView(view.id)}
              type="button"
            >
              {view.label}
            </button>
          ))}
        </nav>

        <div className="profile-block">
          <p className="eyebrow">Signed in</p>
          <h2 className="title is-5 mb-1">{currentUser.name}</h2>
          <p className="list-meta">
            {currentUser.hospital_name}
            <br />
            {getAccountScopeLabel(currentUser)} ·{" "}
            {currentUser.staff_type.replaceAll("_", " ")}
          </p>
          <button className="button is-dark is-fullwidth" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="portal-main">
        <header className="portal-topbar">
          <div>
            <p className="eyebrow">{selectedLabName}</p>
            <h2 className="title is-3 mb-1">
              {activeView === "overview"
                ? currentUser.is_global_admin
                  ? "Global admin dashboard"
                  : showPoctCoordinatorDashboard
                    ? "POCT training coordinator dashboard"
                    : "Service dashboard"
                : activeView === "assignments"
                  ? "Training due and renewal planning"
                : activeView === "users"
                    ? "User setup and staff directory"
                    : activeView === "poct-requests"
                      ? "POCT training requests and QR links"
                    : activeView === "templates"
                      ? "Digital form templates"
                      : activeView === "records"
                        ? "Completed and in-progress records"
                        : currentUser.is_global_admin
                          ? "Hospital and section setup"
                          : "Lab section directory"}
            </h2>
          </div>

          <div className="buttons">
            <button
              className={`button is-light ${isLoading ? "is-loading" : ""}`}
              onClick={onRefresh}
              type="button"
            >
              Refresh data
            </button>
          </div>
        </header>

        {errorMessage ? (
          <div className="notification is-danger is-light">{errorMessage}</div>
        ) : null}

        <DashboardMetrics metrics={dashboardMetrics} />

        {activeView === "overview" ? (
          currentUser.is_global_admin ? (
            <GlobalAdminOverviewPanel
              currentUser={currentUser}
              hospitals={hospitals}
              departments={departments}
              archivedDepartments={archivedDepartments}
              labs={labs}
              users={users}
              onCreateHospital={onCreateHospital}
              onCreateDepartment={onCreateDepartment}
              onArchiveDepartment={onArchiveDepartment}
              onRestoreDepartment={onRestoreDepartment}
              onDeleteDepartment={onDeleteDepartment}
            />
          ) : (
            <section className="columns is-multiline">
              {showPoctCoordinatorDashboard ? (
                <div className="column is-12">
                  <PoctCoordinatorOverviewPanel
                    currentUser={currentUser}
                    labs={labs}
                    users={users}
                    templates={templates}
                    assignments={assignments}
                    records={records}
                    onSelectLab={setSelectedLabId}
                  />
                </div>
              ) : null}
              <div className="column is-4-desktop">
                <TrainingRecordsPanel
                  currentUser={currentUser}
                  assignments={filteredAssignments}
                  records={filteredRecords}
                  templates={filteredTemplates}
                  users={users}
                  onCreateRecord={onCreateRecord}
                  onFetchRecordDetail={onFetchRecordDetail}
                  showRecordEntry={false}
                  showCompetencyRecords
                />
              </div>
              <div className="column is-4-desktop">
                <TrainingAssignmentsPanel
                  currentUser={currentUser}
                  assignments={filteredAssignments}
                  templates={filteredTemplates}
                  users={users}
                  selectedLabName={selectedLabName}
                  onCreateAssignment={onCreateAssignment}
                  onUpdateAssignment={onUpdateAssignment}
                  showPlanner={false}
                  showQueue
                />
              </div>
              <div className="column is-4-desktop">
                <TrainingAssignmentsPanel
                  currentUser={currentUser}
                  assignments={filteredAssignments}
                  templates={filteredTemplates}
                  users={users}
                  selectedLabName={selectedLabName}
                  onCreateAssignment={onCreateAssignment}
                  onUpdateAssignment={onUpdateAssignment}
                  showPlanner
                  showQueue={false}
                />
              </div>
              <div className="column is-4-desktop">
                <TrainingRecordsPanel
                  currentUser={currentUser}
                  assignments={filteredAssignments}
                  records={filteredRecords}
                  templates={filteredTemplates}
                  users={users}
                  onCreateRecord={onCreateRecord}
                  onFetchRecordDetail={onFetchRecordDetail}
                  showRecordEntry
                  showCompetencyRecords={false}
                  onOpenFullRecordEntry={() => setActiveView("records")}
                />
              </div>
              <div className="column is-4-desktop">
                <TemplatesPanel
                  currentUser={currentUser}
                  labs={labs}
                  templates={filteredTemplates}
                  isReadOnly={isBasicGradeStandardUser}
                  showTemplateSetup={false}
                  showFormLibrary
                  onCreateTemplate={onCreateTemplate}
                  onArchiveTemplate={onArchiveTemplate}
                  onDeleteTemplate={onDeleteTemplate}
                  onRestoreTemplate={onRestoreTemplate}
                  onFetchTemplateDetail={onFetchTemplateDetail}
                />
              </div>
              <div className="column is-4-desktop">
                <LabsPanel
                  currentUser={currentUser}
                  hospitals={hospitals}
                  departments={departments}
                  labs={labs}
                  archivedLabs={archivedLabs}
                  selectedLabId={selectedLabId}
                  onSelectLab={setSelectedLabId}
                  onCreateLab={onCreateLab}
                  onArchiveLab={onArchiveLab}
                  onRestoreLab={onRestoreLab}
                  onDeleteLab={onDeleteLab}
                  showCreateSection={false}
                  showLabSections
                />
              </div>
              {canManageLocalSetup ? (
                <div className="column is-6-desktop">
                  <TemplatesPanel
                    currentUser={currentUser}
                    labs={labs}
                    templates={filteredTemplates}
                    isReadOnly={isBasicGradeStandardUser}
                    showTemplateSetup
                    showFormLibrary={false}
                    onCreateTemplate={onCreateTemplate}
                    onArchiveTemplate={onArchiveTemplate}
                    onDeleteTemplate={onDeleteTemplate}
                    onRestoreTemplate={onRestoreTemplate}
                    onFetchTemplateDetail={onFetchTemplateDetail}
                  />
                </div>
              ) : null}
              {canManageLocalSetup ? (
                <div className="column is-6-desktop">
                  <LabsPanel
                    currentUser={currentUser}
                    hospitals={hospitals}
                    departments={departments}
                    labs={labs}
                    archivedLabs={archivedLabs}
                    selectedLabId={selectedLabId}
                    onSelectLab={setSelectedLabId}
                    onCreateLab={onCreateLab}
                    onArchiveLab={onArchiveLab}
                    onRestoreLab={onRestoreLab}
                    onDeleteLab={onDeleteLab}
                    showCreateSection
                    showLabSections={false}
                  />
                </div>
              ) : null}
            </section>
          )
        ) : null}

        {!currentUser.is_global_admin && activeView === "assignments" ? (
          <TrainingAssignmentsPanel
            currentUser={currentUser}
            assignments={filteredAssignments}
            templates={filteredTemplates}
            users={users}
            selectedLabName={selectedLabName}
            onCreateAssignment={onCreateAssignment}
            onUpdateAssignment={onUpdateAssignment}
          />
        ) : null}

        {!currentUser.is_global_admin &&
        activeView === "poct-requests" &&
        showPoctCoordinatorDashboard ? (
          <PoctRequestPanel
            currentUser={currentUser}
            labs={labs}
            registrationLinks={registrationLinks}
            requests={poctRequests}
            onCreateRegistrationLink={onCreatePocRegistrationLink}
            onDeleteRegistrationLink={onDeletePocRegistrationLink}
            onUpdateRegistrationLinkStatus={onUpdatePocRegistrationLinkStatus}
            onReplyToRequest={onReplyToPocRequest}
          />
        ) : null}

        {activeView === "users" ? (
          <UsersPanel
            currentUser={currentUser}
            hospitals={hospitals}
            users={users}
            assignments={assignments}
            records={records}
            onFetchRecordDetail={onFetchRecordDetail}
            onCreateUser={onCreateUser}
            onArchiveUser={onArchiveUser}
          />
        ) : null}

        {!currentUser.is_global_admin && activeView === "templates" ? (
          <TemplatesPanel
            currentUser={currentUser}
            labs={labs}
            templates={filteredTemplates}
            isReadOnly={isBasicGradeStandardUser}
            onCreateTemplate={onCreateTemplate}
            onArchiveTemplate={onArchiveTemplate}
            onDeleteTemplate={onDeleteTemplate}
            onRestoreTemplate={onRestoreTemplate}
            onFetchTemplateDetail={onFetchTemplateDetail}
          />
        ) : null}

        {currentUser.is_global_admin && activeView === "templates" ? (
          <TemplatesPanel
            currentUser={currentUser}
            labs={labs}
            templates={templates}
            isReadOnly
            onCreateTemplate={onCreateTemplate}
            onArchiveTemplate={onArchiveTemplate}
            onDeleteTemplate={onDeleteTemplate}
            onRestoreTemplate={onRestoreTemplate}
            onFetchTemplateDetail={onFetchTemplateDetail}
          />
        ) : null}

        {!currentUser.is_global_admin && activeView === "records" ? (
          <TrainingRecordsPanel
            currentUser={currentUser}
            assignments={filteredAssignments}
            records={filteredRecords}
            templates={filteredTemplates}
            users={users}
            onCreateRecord={onCreateRecord}
            onFetchRecordDetail={onFetchRecordDetail}
          />
        ) : null}

        {activeView === "labs" ? (
          currentUser.is_global_admin ? (
            <GlobalAdminOverviewPanel
              currentUser={currentUser}
              hospitals={hospitals}
              departments={departments}
              archivedDepartments={archivedDepartments}
              labs={labs}
              users={users}
              onCreateHospital={onCreateHospital}
              onCreateDepartment={onCreateDepartment}
              onArchiveDepartment={onArchiveDepartment}
              onRestoreDepartment={onRestoreDepartment}
              onDeleteDepartment={onDeleteDepartment}
            />
          ) : (
            <LabsPanel
              currentUser={currentUser}
              hospitals={hospitals}
              departments={departments}
              labs={labs}
              archivedLabs={archivedLabs}
              selectedLabId={selectedLabId}
              onSelectLab={setSelectedLabId}
              onCreateLab={onCreateLab}
              onArchiveLab={onArchiveLab}
              onRestoreLab={onRestoreLab}
              onDeleteLab={onDeleteLab}
            />
          )
        ) : null}
      </main>
    </div>
  );
}
