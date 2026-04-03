import { useMemo } from "react";

import { CurrentUser } from "../auth/api";
import {
  LabSummary,
  TemplateSummary,
  TrainingAssignmentSummary,
  TrainingRecordSummary,
} from "./api";

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

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Date(value).toLocaleDateString("en-IE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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
  const dueSoonCount = useMemo(
    () =>
      assignments.filter((assignment) => getDaysUntil(assignment.next_due_at) <= 30)
        .length,
    [assignments]
  );

  const activeTemplateCount = useMemo(
    () => templates.filter((template) => template.is_active).length,
    [templates]
  );

  return (
    <div className="portal-shell">
      <header className="portal-topbar">
        <div>
          <p className="eyebrow">Signed in</p>
          <h1 className="title is-4 mb-1">{currentUser.name}</h1>
          <p className="subtitle is-6 mb-0">
            {currentUser.hospital_name} · {currentUser.role} ·{" "}
            {currentUser.staff_type.replaceAll("_", " ")}
          </p>
        </div>

        <div className="buttons">
          <button
            className={`button is-light ${isLoading ? "is-loading" : ""}`}
            onClick={onRefresh}
          >
            Refresh
          </button>
          <button className="button is-dark" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      {errorMessage ? (
        <div className="notification is-danger is-light">{errorMessage}</div>
      ) : null}

      <section className="columns is-multiline">
        <div className="column is-4">
          <div className="metric-card">
            <p className="metric-label">Labs</p>
            <p className="metric-value">{labs.length}</p>
          </div>
        </div>
        <div className="column is-4">
          <div className="metric-card">
            <p className="metric-label">Active templates</p>
            <p className="metric-value">{activeTemplateCount}</p>
          </div>
        </div>
        <div className="column is-4">
          <div className="metric-card accent">
            <p className="metric-label">Due within 30 days</p>
            <p className="metric-value">{dueSoonCount}</p>
          </div>
        </div>
      </section>

      <section className="columns is-multiline">
        <div className="column is-6">
          <section className="panel-card">
            <div className="panel-heading-row">
              <h2 className="title is-5">Training due soon</h2>
              <span className="tag is-warning is-light">
                {assignments.length} tracked
              </span>
            </div>
            <div className="scroll-list">
              {assignments.length === 0 ? (
                <p className="empty-state">
                  No assignment deadlines returned yet.
                </p>
              ) : (
                assignments.map((assignment) => {
                  const daysLeft = getDaysUntil(assignment.next_due_at);
                  return (
                    <article className="list-card" key={assignment.id}>
                      <div>
                        <h3 className="list-title">{assignment.template_name}</h3>
                        <p className="list-meta">
                          {assignment.trainee_name} · {assignment.lab_name}
                        </p>
                      </div>
                      <span
                        className={`tag ${
                          daysLeft <= 30 ? "is-danger" : "is-success"
                        } is-light`}
                      >
                        {daysLeft} days
                      </span>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <div className="column is-6">
          <section className="panel-card">
            <div className="panel-heading-row">
              <h2 className="title is-5">Template library</h2>
              <span className="tag is-info is-light">{templates.length}</span>
            </div>
            <div className="scroll-list">
              {templates.length === 0 ? (
                <p className="empty-state">No templates available yet.</p>
              ) : (
                templates.map((template) => (
                  <article className="list-card" key={template.id}>
                    <div>
                      <h3 className="list-title">{template.name}</h3>
                      <p className="list-meta">
                        {template.form_family_reference} · {template.lab_name} ·{" "}
                        {template.target_staff_type.replaceAll("_", " ")}
                      </p>
                    </div>
                    <span className="tag is-link is-light">
                      v{template.latest_version_number || 1}
                    </span>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </section>

      <section className="columns is-multiline">
        <div className="column is-7">
          <section className="panel-card">
            <div className="panel-heading-row">
              <h2 className="title is-5">Recent training records</h2>
              <span className="tag is-success is-light">{records.length}</span>
            </div>
            <div className="scroll-list">
              {records.length === 0 ? (
                <p className="empty-state">No training records returned yet.</p>
              ) : (
                records.map((record) => (
                  <article className="list-card" key={record.id}>
                    <div>
                      <h3 className="list-title">{record.template_name}</h3>
                      <p className="list-meta">
                        {record.trainee_name} · {record.lab_name} · due{" "}
                        {formatDate(record.expires_at)}
                      </p>
                    </div>
                    <span className="tag is-primary is-light">
                      {record.status}
                    </span>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="column is-5">
          <section className="panel-card">
            <h2 className="title is-5">Lab sections</h2>
            <div className="lab-grid">
              {labs.length === 0 ? (
                <p className="empty-state">No labs returned yet.</p>
              ) : (
                labs.map((lab) => (
                  <div className="lab-chip" key={lab.id}>
                    <strong>{lab.name}</strong>
                    <small>{lab.hospital_name}</small>
                    {lab.is_poc ? (
                      <span className="tag is-warning is-light">POC</span>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
