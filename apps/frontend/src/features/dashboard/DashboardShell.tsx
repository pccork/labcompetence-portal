import { useMemo, useState } from "react";

import { CurrentUser } from "../auth/api";
import {
  LabSummary,
  TemplateSummary,
  TrainingAssignmentSummary,
  TrainingRecordSummary,
} from "./api";
import { DashboardMetrics } from "./components/DashboardMetrics";
import { LabsPanel } from "./components/LabsPanel";
import { TemplatesPanel } from "./components/TemplatesPanel";
import { TrainingAssignmentsPanel } from "./components/TrainingAssignmentsPanel";
import { TrainingRecordsPanel } from "./components/TrainingRecordsPanel";

interface DashboardShellProps {
  currentUser: CurrentUser;
  labs: LabSummary[];
  templates: TemplateSummary[];
  assignments: TrainingAssignmentSummary[];
  records: TrainingRecordSummary[];
  onRefresh: () => void;
  onSignOut: () => void;
  errorMessage: string | null;
  isLoading: boolean;
}

const dashboardViews = [
  { id: "overview", label: "Overview" },
  { id: "assignments", label: "Due training" },
  { id: "templates", label: "Templates" },
  { id: "records", label: "Records" },
  { id: "labs", label: "Sections" },
] as const;

type DashboardView = (typeof dashboardViews)[number]["id"];

function getDaysUntil(value: string) {
  const deltaMs = new Date(value).getTime() - Date.now();
  return Math.ceil(deltaMs / (1000 * 60 * 60 * 24));
}

export function DashboardShell({
  currentUser,
  labs,
  templates,
  assignments,
  records,
  onRefresh,
  onSignOut,
  errorMessage,
  isLoading,
}: DashboardShellProps) {
  const [activeView, setActiveView] = useState<DashboardView>("overview");
  const [selectedLabId, setSelectedLabId] = useState<number | "all">("all");

  const selectedLabName = useMemo(() => {
    if (selectedLabId === "all") {
      return "All sections";
    }

    return labs.find((lab) => lab.id === selectedLabId)?.name || "Selected section";
  }, [labs, selectedLabId]);

  const filteredAssignments = useMemo(() => {
    if (selectedLabId === "all") {
      return assignments;
    }

    return assignments.filter(
      (assignment) => assignment.lab_id === selectedLabId
    );
  }, [assignments, selectedLabId]);

  const filteredTemplates = useMemo(() => {
    if (selectedLabId === "all") {
      return templates;
    }

    return templates.filter(
      (template) => template.lab_id === selectedLabId
    );
  }, [selectedLabId, templates]);

  const filteredRecords = useMemo(() => {
    if (selectedLabId === "all") {
      return records;
    }

    return records.filter(
      (record) => record.lab_id === selectedLabId
    );
  }, [records, selectedLabId]);

  const dueSoonCount = useMemo(
    () =>
      filteredAssignments.filter(
        (assignment) => getDaysUntil(assignment.next_due_at) <= 30
      ).length,
    [filteredAssignments]
  );

  const activeTemplateCount = useMemo(
    () => filteredTemplates.filter((template) => template.is_active).length,
    [filteredTemplates]
  );

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
            {currentUser.role} · {currentUser.staff_type.replaceAll("_", " ")}
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
                ? "Service dashboard"
                : activeView === "assignments"
                  ? "Training due and renewal planning"
                  : activeView === "templates"
                    ? "Digital form templates"
                    : activeView === "records"
                      ? "Completed and in-progress records"
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
          <div className="notification is-danger is-light">
            {errorMessage}
          </div>
        ) : null}

        <DashboardMetrics
          labCount={labs.length}
          activeTemplateCount={activeTemplateCount}
          dueSoonCount={dueSoonCount}
          activeAssignmentCount={filteredAssignments.length}
        />

        {activeView === "overview" ? (
          <section className="columns is-multiline">
            <div className="column is-7-desktop">
              <TrainingAssignmentsPanel
                assignments={filteredAssignments}
                selectedLabName={selectedLabName}
              />
            </div>
            <div className="column is-5-desktop">
              <LabsPanel
                labs={labs}
                selectedLabId={selectedLabId}
                onSelectLab={setSelectedLabId}
              />
            </div>
            <div className="column is-6-desktop">
              <TemplatesPanel templates={filteredTemplates} />
            </div>
            <div className="column is-6-desktop">
              <TrainingRecordsPanel records={filteredRecords} />
            </div>
          </section>
        ) : null}

        {activeView === "assignments" ? (
          <TrainingAssignmentsPanel
            assignments={filteredAssignments}
            selectedLabName={selectedLabName}
          />
        ) : null}

        {activeView === "templates" ? (
          <TemplatesPanel templates={filteredTemplates} />
        ) : null}

        {activeView === "records" ? (
          <TrainingRecordsPanel records={filteredRecords} />
        ) : null}

        {activeView === "labs" ? (
          <LabsPanel
            labs={labs}
            selectedLabId={selectedLabId}
            onSelectLab={setSelectedLabId}
          />
        ) : null}
      </main>
    </div>
  );
}
