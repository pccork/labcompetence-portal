import { Pool } from "pg";

import { EmailService } from "./email-service";
import { withEmailDispatchGuard } from "./email-dispatch-service";
import {
  listNonPocTrainingAssignmentsForReminders,
  TrainingAssignmentReminderCandidate,
} from "./training-assignment-service";

function buildAssignmentReminderDedupeKey(
  assignment: TrainingAssignmentReminderCandidate,
) {
  const dueAt = new Date(assignment.next_due_at).toISOString();

  return [
    "training_assignment_reminder",
    assignment.id,
    assignment.reminder_kind,
    dueAt,
  ].join(":");
}

export async function sendNonPocTrainingReminders(
  db: Pool,
  emailService: EmailService,
  input: {
    dueWithinDays: number;
    hospitalId?: number | undefined;
    trainingUnitIds?: number[] | undefined;
    dryRun?: boolean | undefined;
  },
) {
  const candidates = await listNonPocTrainingAssignmentsForReminders(
    db,
    input.dueWithinDays,
    input.hospitalId,
    input.trainingUnitIds,
  );

  const summary = {
    dueSoon: candidates.filter((candidate) => candidate.reminder_kind === "due_soon")
      .length,
    overdue: candidates.filter((candidate) => candidate.reminder_kind === "overdue")
      .length,
    duplicatesSkipped: 0,
    emailsSent: 0,
    preview: candidates.map((candidate) => ({
      assignmentId: candidate.id,
      reminderKind: candidate.reminder_kind,
      templateName: candidate.template_name,
      traineeEmail: candidate.trainee_email,
      traineeName: candidate.trainee_name,
      nextDueAt: candidate.next_due_at,
    })),
  };

  if (input.dryRun) {
    return summary;
  }

  for (const candidate of candidates) {
    const dedupeKey = buildAssignmentReminderDedupeKey(candidate);
    const sendResult = await withEmailDispatchGuard(db, {
      dedupeKey,
      entityId: candidate.id,
      entityType: "training_assignment",
      notificationType: `training_assignment_${candidate.reminder_kind}`,
      payloadSummary: {
        nextDueAt: new Date(candidate.next_due_at).toISOString(),
        reminderKind: candidate.reminder_kind,
        templateName: candidate.template_name,
      },
      recipientEmail: candidate.trainee_email,
      send: () =>
        emailService.sendTrainingAssignmentReminderEmail({
          departmentName: candidate.department_name,
          hospitalName: candidate.lab_hospital_name,
          nextDueAt: candidate.next_due_at,
          reminderKind: candidate.reminder_kind,
          templateName: candidate.template_name,
          traineeEmail: candidate.trainee_email,
          traineeName: candidate.trainee_name,
          trainingUnitName: candidate.lab_name,
        }),
    });

    if (sendResult.duplicate) {
      summary.duplicatesSkipped += 1;
      continue;
    }

    summary.emailsSent += 1;
  }

  return summary;
}
