import { useMemo } from "react";

import { CurrentUser } from "../../auth/api";
import {
  LabSummary,
  TemplateSummary,
  TrainingAssignmentSummary,
  TrainingRecordSummary,
  UserSummary,
} from "../api";
import {
  buildPoctLabIdSet,
  isPoctAssignment,
  isPoctRecord,
  isPoctStaffType,
  isPoctTemplate,
} from "./poctDashboardUtils";

interface PoctCoordinatorOverviewPanelProps {
  currentUser: CurrentUser;
  labs: LabSummary[];
  users: UserSummary[];
  templates: TemplateSummary[];
  assignments: TrainingAssignmentSummary[];
  records: TrainingRecordSummary[];
  onSelectLab: (labId: number | "all") => void;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not scheduled";
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

function describeDueWindow(daysUntilDue: number) {
  if (daysUntilDue < 0) {
    return `${Math.abs(daysUntilDue)} days overdue`;
  }

  if (daysUntilDue === 0) {
    return "Due today";
  }

  return `Due in ${daysUntilDue} days`;
}

function describeExpiryWindow(daysUntilExpiry: number) {
  if (daysUntilExpiry < 0) {
    return `${Math.abs(daysUntilExpiry)} days expired`;
  }

  if (daysUntilExpiry === 0) {
    return "Expires today";
  }

  return `Expires in ${daysUntilExpiry} days`;
}

export function PoctCoordinatorOverviewPanel({
  currentUser,
  labs,
  users,
  templates,
  assignments,
  records,
  onSelectLab,
}: PoctCoordinatorOverviewPanelProps) {
  const poctLabIds = useMemo(() => buildPoctLabIdSet(labs), [labs]);

  const poctLabs = useMemo(
    () => labs.filter((lab) => poctLabIds.has(lab.id)),
    [labs, poctLabIds],
  );

  const poctTemplates = useMemo(
    () => templates.filter((template) => isPoctTemplate(template, poctLabIds)),
    [poctLabIds, templates],
  );

  const poctAssignments = useMemo(
    () =>
      assignments.filter((assignment) =>
        isPoctAssignment(assignment, poctLabIds),
      ),
    [assignments, poctLabIds],
  );

  const poctRecords = useMemo(
    () => records.filter((record) => isPoctRecord(record, poctLabIds)),
    [poctLabIds, records],
  );

  const poctTrainees = useMemo(() => {
    const traineeIds = new Set<number>();

    users.forEach((user) => {
      if (user.role !== "admin" && isPoctStaffType(user.staff_type)) {
        traineeIds.add(user.id);
      }
    });

    poctAssignments.forEach((assignment) => traineeIds.add(assignment.user_id));
    poctRecords.forEach((record) => traineeIds.add(record.trainee_id));

    return users
      .filter((user) => traineeIds.has(user.id))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [poctAssignments, poctRecords, users]);

  const poctTrainerCoverage = useMemo(() => {
    const trainerLoad = new Map<
      number,
      {
        user: UserSummary;
        assignedCount: number;
        signedOffCount: number;
      }
    >();

    users
      .filter((user) => user.role === "trainer" || user.role === "admin")
      .forEach((user) => {
        trainerLoad.set(user.id, {
          user,
          assignedCount: 0,
          signedOffCount: 0,
        });
      });

    poctAssignments.forEach((assignment) => {
      if (!assignment.assigned_by) {
        return;
      }

      const trainer = trainerLoad.get(assignment.assigned_by);
      if (trainer) {
        trainer.assignedCount += 1;
      }
    });

    poctRecords.forEach((record) => {
      if (!record.assigned_trainer_id) {
        return;
      }

      const trainer = trainerLoad.get(record.assigned_trainer_id);
      if (trainer) {
        trainer.signedOffCount += 1;
      }
    });

    return [...trainerLoad.values()]
      .filter(
        (trainer) => trainer.assignedCount > 0 || trainer.signedOffCount > 0,
      )
      .sort(
        (left, right) =>
          right.assignedCount +
          right.signedOffCount -
          (left.assignedCount + left.signedOffCount),
      );
  }, [poctAssignments, poctRecords, users]);

  const priorityAssignments = useMemo(
    () =>
      [...poctAssignments]
        .map((assignment) => ({
          ...assignment,
          daysUntilDue: getDaysUntil(assignment.next_due_at),
        }))
        .filter((assignment) => assignment.daysUntilDue <= 45)
        .sort((left, right) => left.daysUntilDue - right.daysUntilDue)
        .slice(0, 6),
    [poctAssignments],
  );

  const expiringRecords = useMemo(
    () =>
      [...poctRecords]
        .map((record) => ({
          ...record,
          daysUntilExpiry: getDaysUntil(record.expires_at),
        }))
        .filter((record) => record.daysUntilExpiry <= 60)
        .sort((left, right) => left.daysUntilExpiry - right.daysUntilExpiry)
        .slice(0, 6),
    [poctRecords],
  );

  const sectionSnapshots = useMemo(
    () =>
      poctLabs.map((lab) => {
        const sectionTemplates = poctTemplates.filter(
          (template) => template.lab_id === lab.id,
        );
        const sectionAssignments = poctAssignments.filter(
          (assignment) => assignment.lab_id === lab.id,
        );
        const sectionRecords = poctRecords.filter(
          (record) => record.lab_id === lab.id,
        );
        const dueSoonCount = sectionAssignments.filter(
          (assignment) => getDaysUntil(assignment.next_due_at) <= 30,
        ).length;
        const completedCount = sectionRecords.filter(
          (record) => record.status === "signedoff",
        ).length;

        return {
          lab,
          templateCount: sectionTemplates.filter(
            (template) => template.is_active,
          ).length,
          assignmentCount: sectionAssignments.length,
          dueSoonCount,
          completedCount,
        };
      }),
    [poctAssignments, poctLabs, poctRecords, poctTemplates],
  );

  const outstandingCount = priorityAssignments.filter(
    (assignment) => assignment.daysUntilDue < 0,
  ).length;
  const upcomingCount = priorityAssignments.filter(
    (assignment) => assignment.daysUntilDue >= 0,
  ).length;
  const recordsReadyForRenewal = expiringRecords.filter(
    (record) => record.daysUntilExpiry <= 30,
  ).length;

  return (
    <section className="columns is-multiline">
      <div className="column is-12">
        <section className="panel-card poct-hero-card">
          <div className="poct-hero-layout">
            <div>
              <p className="panel-kicker">POCT coordination desk</p>
              <h2 className="title is-4 mb-3">
                Keep device pathways, renewals, and trainer coverage moving.
              </h2>
              <p className="list-meta">
                {currentUser.hospital_name} is signed in under{" "}
                {currentUser.name}. This workspace pulls POCT sections,
                templates, assignments, and competency records into one view for
                training co-ordination.
              </p>
            </div>

            <div className="poct-hero-badges">
              <article>
                <strong>{poctLabs.length}</strong>
                <span>POCT pathways</span>
              </article>
              <article>
                <strong>{poctTrainees.length}</strong>
                <span>POCT trainees</span>
              </article>
              <article>
                <strong>{priorityAssignments.length}</strong>
                <span>Priority renewals</span>
              </article>
            </div>
          </div>
        </section>
      </div>

      <div className="column is-6-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Priority queue</p>
              <h2 className="title is-5">POCT assignments needing action</h2>
            </div>
            <span className="tag is-warning is-light">
              {outstandingCount} overdue · {upcomingCount} upcoming
            </span>
          </div>

          <div className="scroll-list poct-scroll-list">
            {priorityAssignments.length === 0 ? (
              <p className="empty-state">
                No POCT assignments are due in the next 45 days.
              </p>
            ) : (
              priorityAssignments.map((assignment) => (
                <article className="list-card" key={assignment.id}>
                  <div>
                    <h3 className="list-title">{assignment.trainee_name}</h3>
                    <p className="list-meta">
                      {assignment.template_name}
                      <br />
                      {assignment.department_name} / {assignment.lab_name}
                    </p>
                  </div>
                  <div className="tag-stack">
                    <span
                      className={`tag ${
                        assignment.daysUntilDue < 0
                          ? "is-danger"
                          : assignment.daysUntilDue <= 14
                            ? "is-warning"
                            : "is-info"
                      } is-light`}
                    >
                      {describeDueWindow(assignment.daysUntilDue)}
                    </span>
                    <small className="list-meta">
                      Renewal {assignment.renewal_interval_months} months
                    </small>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="column is-6-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Renewal watch</p>
              <h2 className="title is-5">Competency records nearing expiry</h2>
            </div>
            <span className="tag is-link is-light">
              {recordsReadyForRenewal} due within 30 days
            </span>
          </div>

          <div className="scroll-list poct-scroll-list">
            {expiringRecords.length === 0 ? (
              <p className="empty-state">
                No signed or active POCT records are expiring in the next 60
                days.
              </p>
            ) : (
              expiringRecords.map((record) => (
                <article className="list-card" key={record.id}>
                  <div>
                    <h3 className="list-title">{record.trainee_name}</h3>
                    <p className="list-meta">
                      {record.template_name}
                      <br />
                      {record.lab_name} · completed{" "}
                      {formatDate(record.completed_at)}
                    </p>
                  </div>
                  <div className="tag-stack">
                    <span
                      className={`tag ${
                        record.daysUntilExpiry < 0
                          ? "is-danger"
                          : record.daysUntilExpiry <= 14
                            ? "is-warning"
                            : "is-success"
                      } is-light`}
                    >
                      {describeExpiryWindow(record.daysUntilExpiry)}
                    </span>
                    <small className="list-meta">{record.status}</small>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="column is-7-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Section readiness</p>
              <h2 className="title is-5">POCT devices and pathways</h2>
            </div>
            <span className="tag is-info is-light">
              {sectionSnapshots.length} monitored sections
            </span>
          </div>

          <div className="poct-section-grid">
            {sectionSnapshots.length === 0 ? (
              <p className="empty-state">
                Mark sections as POCT to see a coordinator view here.
              </p>
            ) : (
              sectionSnapshots.map((snapshot) => (
                <button
                  className="poct-section-card"
                  key={snapshot.lab.id}
                  onClick={() => onSelectLab(snapshot.lab.id)}
                  type="button"
                >
                  <p className="poct-section-name">{snapshot.lab.name}</p>
                  <p className="list-meta">
                    {snapshot.lab.department_name}
                    <br />
                    {snapshot.lab.hospital_name}
                  </p>

                  <div className="poct-stat-row">
                    <div>
                      <strong>{snapshot.templateCount}</strong>
                      <span>Active templates</span>
                    </div>
                    <div>
                      <strong>{snapshot.assignmentCount}</strong>
                      <span>Assignments</span>
                    </div>
                    <div>
                      <strong>{snapshot.dueSoonCount}</strong>
                      <span>Due soon</span>
                    </div>
                    <div>
                      <strong>{snapshot.completedCount}</strong>
                      <span>Signed off</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="column is-5-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Trainer coverage</p>
              <h2 className="title is-5">Who is carrying POCT workload</h2>
            </div>
            <span className="tag is-success is-light">
              {poctTrainerCoverage.length} active trainers
            </span>
          </div>

          <div className="scroll-list poct-scroll-list">
            {poctTrainerCoverage.length === 0 ? (
              <p className="empty-state">
                Trainer activity will appear once POCT assignments or records
                are linked to trainers.
              </p>
            ) : (
              poctTrainerCoverage.map((trainer) => (
                <article className="list-card" key={trainer.user.id}>
                  <div>
                    <h3 className="list-title">{trainer.user.name}</h3>
                    <p className="list-meta">
                      {trainer.user.email}
                      <br />
                      {trainer.user.role === "admin"
                        ? "Training coordinator"
                        : "Trainer"}
                    </p>
                  </div>
                  <div className="tag-stack">
                    <span className="tag is-info is-light">
                      {trainer.assignedCount} assigned
                    </span>
                    <span className="tag is-success is-light">
                      {trainer.signedOffCount} records
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
