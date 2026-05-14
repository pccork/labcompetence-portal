import nodemailer from "nodemailer";

export type EmailProvider = "disabled" | "smtp" | "resend";

export interface OutboundEmail {
  html: string;
  subject: string;
  text: string;
  to: string;
}

export interface TrainingRequestReplyEmailInput {
  coordinatorName?: string | null;
  deviceName: string;
  hospitalName: string;
  location?: string | null;
  replyStatus: "scheduled" | "cancelled";
  replyMessage?: string | null;
  timeDetails?: string | null;
  traineeEmail: string;
  traineeName: string;
}

export interface TrainingRequestTrainerNotificationEmailInput {
  coordinatorUrl?: string | null;
  deviceName: string;
  hospitalName: string;
  location?: string | null;
  requestedAt: Date | string;
  staffType: string;
  timeDetails?: string | null;
  traineeEmail: string;
  traineeHospitalName: string;
  traineeName: string;
  trainerEmail: string;
  trainerName: string;
}

export interface TrainingAssignmentReminderEmailInput {
  departmentName: string;
  hospitalName: string;
  nextDueAt: Date | string;
  reminderKind: "due_soon" | "overdue";
  templateName: string;
  traineeEmail: string;
  traineeName: string;
  trainingUnitName: string;
}

export interface EmailService {
  isConfigured(): boolean;
  sendMail(email: OutboundEmail): Promise<void>;
  sendTrainingAssignmentReminderEmail(
    input: TrainingAssignmentReminderEmailInput,
  ): Promise<void>;
  sendTrainingRequestReplyEmail(
    input: TrainingRequestReplyEmailInput,
  ): Promise<void>;
  sendTrainingRequestTrainerNotificationEmail(
    input: TrainingRequestTrainerNotificationEmailInput,
  ): Promise<void>;
}

interface EmailServiceOptions {
  appBaseUrl?: string | undefined;
  fromEmail?: string | undefined;
  provider: EmailProvider;
  resendApiKey?: string | undefined;
  smtpHost?: string | undefined;
  smtpPass?: string | undefined;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string | undefined;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeLine(value?: string | null) {
  return value?.trim() || "To be confirmed";
}

function formatDate(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toISOString().slice(0, 10);
}

function buildTrainingAssignmentReminderEmail(
  input: TrainingAssignmentReminderEmailInput,
  appBaseUrl?: string,
): OutboundEmail {
  const formattedDueDate = formatDate(input.nextDueAt);
  const isOverdue = input.reminderKind === "overdue";
  const subjectPrefix = isOverdue ? "Training overdue" : "Training due soon";
  const summary = isOverdue
    ? `Your ${input.templateName} training is overdue.`
    : `Your ${input.templateName} training is due soon.`;
  const guidance = isOverdue
    ? "Please arrange completion as soon as possible."
    : "Please arrange completion before the due date.";
  const cta = appBaseUrl
    ? `You can review your training in the portal here: ${appBaseUrl}`
    : null;

  const lines = [
    `Hello ${input.traineeName},`,
    "",
    summary,
    "",
    `Training item: ${input.templateName}`,
    `Section / device: ${input.trainingUnitName}`,
    `Department: ${input.departmentName}`,
    `Hospital: ${input.hospitalName}`,
    `Due date: ${formattedDueDate}`,
    "",
    guidance,
    ...(cta ? ["", cta] : []),
  ];

  return {
    to: input.traineeEmail,
    subject: `${subjectPrefix}: ${input.templateName}`,
    text: lines.join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #102a43;">
        <p>${escapeHtml(`Hello ${input.traineeName},`)}</p>
        <p>${escapeHtml(summary)}</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tbody>
            <tr><td style="padding: 6px 12px 6px 0;"><strong>Training item</strong></td><td>${escapeHtml(input.templateName)}</td></tr>
            <tr><td style="padding: 6px 12px 6px 0;"><strong>Section / device</strong></td><td>${escapeHtml(input.trainingUnitName)}</td></tr>
            <tr><td style="padding: 6px 12px 6px 0;"><strong>Department</strong></td><td>${escapeHtml(input.departmentName)}</td></tr>
            <tr><td style="padding: 6px 12px 6px 0;"><strong>Hospital</strong></td><td>${escapeHtml(input.hospitalName)}</td></tr>
            <tr><td style="padding: 6px 12px 6px 0;"><strong>Due date</strong></td><td>${escapeHtml(formattedDueDate)}</td></tr>
          </tbody>
        </table>
        <p>${escapeHtml(guidance)}</p>
        ${
          cta
            ? `<p><a href="${escapeHtml(appBaseUrl || "")}">${escapeHtml(cta)}</a></p>`
            : ""
        }
      </div>
    `,
  };
}

function buildTrainingReplyEmail(
  input: TrainingRequestReplyEmailInput,
  appBaseUrl?: string,
): OutboundEmail {
  const location = normalizeLine(input.location);
  const timeDetails = normalizeLine(input.timeDetails);
  const coordinatorName = input.coordinatorName?.trim() || "the POCT coordinator";
  const replyMessage = input.replyMessage?.trim();
  const subjectPrefix =
    input.replyStatus === "scheduled"
      ? "POCT training scheduled"
      : "POCT training update";
  const subject = `${subjectPrefix}: ${input.deviceName} (${input.hospitalName})`;
  const greeting = `Hello ${input.traineeName},`;
  const summary =
    input.replyStatus === "scheduled"
      ? `Your POCT training request for ${input.deviceName} at ${input.hospitalName} has been scheduled.`
      : `Your POCT training request for ${input.deviceName} at ${input.hospitalName} has been updated.`;
  const cta = appBaseUrl
    ? `You can return to the portal here: ${appBaseUrl}`
    : null;
  const messageLines = [
    greeting,
    "",
    summary,
    "",
    `Device / pathway: ${input.deviceName}`,
    `Location: ${location}`,
    `Date and time: ${timeDetails}`,
    `Coordinator: ${coordinatorName}`,
    ...(replyMessage ? ["", `Coordinator message: ${replyMessage}`] : []),
    ...(cta ? ["", cta] : []),
    "",
    "Please contact the POCT coordinator if you can no longer attend.",
  ];

  return {
    to: input.traineeEmail,
    subject,
    text: messageLines.join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #102a43;">
        <p>${escapeHtml(greeting)}</p>
        <p>${escapeHtml(summary)}</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tbody>
            <tr><td style="padding: 6px 12px 6px 0;"><strong>Device / pathway</strong></td><td>${escapeHtml(input.deviceName)}</td></tr>
            <tr><td style="padding: 6px 12px 6px 0;"><strong>Location</strong></td><td>${escapeHtml(location)}</td></tr>
            <tr><td style="padding: 6px 12px 6px 0;"><strong>Date and time</strong></td><td>${escapeHtml(timeDetails)}</td></tr>
            <tr><td style="padding: 6px 12px 6px 0;"><strong>Coordinator</strong></td><td>${escapeHtml(coordinatorName)}</td></tr>
          </tbody>
        </table>
        ${
          replyMessage
            ? `<p><strong>Coordinator message:</strong><br/>${escapeHtml(replyMessage)}</p>`
            : ""
        }
        ${
          cta
            ? `<p><a href="${escapeHtml(appBaseUrl || "")}">${escapeHtml(cta)}</a></p>`
            : ""
        }
        <p>Please contact the POCT coordinator if you can no longer attend.</p>
      </div>
    `,
  };
}

function buildTrainingRequestTrainerNotificationEmail(
  input: TrainingRequestTrainerNotificationEmailInput,
  appBaseUrl?: string,
): OutboundEmail {
  const location = normalizeLine(input.location);
  const timeDetails = normalizeLine(input.timeDetails);
  const requestedAt = formatDate(input.requestedAt);
  const portalUrl = input.coordinatorUrl || appBaseUrl;
  const subject = `POCT training request: ${input.deviceName} (${input.traineeName})`;
  const greeting = `Hello ${input.trainerName},`;
  const summary = `${input.traineeName} has requested POCT training for ${input.deviceName}.`;
  const action =
    "Please contact the trainee to arrange the training event, then update the POCT request desk with the agreed date, time, and location.";
  const cta = portalUrl
    ? `Open the POCT request desk here: ${portalUrl}`
    : null;
  const messageLines = [
    greeting,
    "",
    summary,
    "",
    `Trainee: ${input.traineeName}`,
    `Trainee email: ${input.traineeEmail}`,
    `Trainee hospital: ${input.traineeHospitalName}`,
    `Staff type: ${input.staffType}`,
    `Device / pathway: ${input.deviceName}`,
    `POCT hospital: ${input.hospitalName}`,
    `Preferred location: ${location}`,
    `Preferred date and time: ${timeDetails}`,
    `Requested: ${requestedAt}`,
    "",
    action,
    ...(cta ? ["", cta] : []),
  ];

  return {
    to: input.trainerEmail,
    subject,
    text: messageLines.join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #102a43;">
        <p>${escapeHtml(greeting)}</p>
        <p>${escapeHtml(summary)}</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tbody>
            <tr><td style="padding: 6px 12px 6px 0;"><strong>Trainee</strong></td><td>${escapeHtml(input.traineeName)}</td></tr>
            <tr><td style="padding: 6px 12px 6px 0;"><strong>Trainee email</strong></td><td>${escapeHtml(input.traineeEmail)}</td></tr>
            <tr><td style="padding: 6px 12px 6px 0;"><strong>Trainee hospital</strong></td><td>${escapeHtml(input.traineeHospitalName)}</td></tr>
            <tr><td style="padding: 6px 12px 6px 0;"><strong>Staff type</strong></td><td>${escapeHtml(input.staffType)}</td></tr>
            <tr><td style="padding: 6px 12px 6px 0;"><strong>Device / pathway</strong></td><td>${escapeHtml(input.deviceName)}</td></tr>
            <tr><td style="padding: 6px 12px 6px 0;"><strong>POCT hospital</strong></td><td>${escapeHtml(input.hospitalName)}</td></tr>
            <tr><td style="padding: 6px 12px 6px 0;"><strong>Preferred location</strong></td><td>${escapeHtml(location)}</td></tr>
            <tr><td style="padding: 6px 12px 6px 0;"><strong>Preferred date and time</strong></td><td>${escapeHtml(timeDetails)}</td></tr>
            <tr><td style="padding: 6px 12px 6px 0;"><strong>Requested</strong></td><td>${escapeHtml(requestedAt)}</td></tr>
          </tbody>
        </table>
        <p>${escapeHtml(action)}</p>
        ${
          cta
            ? `<p><a href="${escapeHtml(portalUrl || "")}">${escapeHtml(cta)}</a></p>`
            : ""
        }
      </div>
    `,
  };
}

class DisabledEmailService implements EmailService {
  isConfigured() {
    return false;
  }

  async sendMail(_email: OutboundEmail) {}

  async sendTrainingAssignmentReminderEmail(
    _input: TrainingAssignmentReminderEmailInput,
  ) {}

  async sendTrainingRequestReplyEmail(
    _input: TrainingRequestReplyEmailInput,
  ) {}

  async sendTrainingRequestTrainerNotificationEmail(
    _input: TrainingRequestTrainerNotificationEmailInput,
  ) {}
}

class SmtpEmailService implements EmailService {
  private transporter;

  constructor(
    private readonly fromEmail: string,
    options: {
      host: string;
      pass?: string;
      port: number;
      secure: boolean;
      user?: string;
    },
    private readonly appBaseUrl?: string,
  ) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth:
        options.user || options.pass
          ? {
              user: options.user,
              pass: options.pass,
            }
          : undefined,
    });
  }

  isConfigured() {
    return true;
  }

  async sendMail(email: OutboundEmail) {
    await this.transporter.sendMail({
      from: this.fromEmail,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  }

  async sendTrainingAssignmentReminderEmail(
    input: TrainingAssignmentReminderEmailInput,
  ) {
    await this.sendMail(
      buildTrainingAssignmentReminderEmail(input, this.appBaseUrl),
    );
  }

  async sendTrainingRequestReplyEmail(input: TrainingRequestReplyEmailInput) {
    await this.sendMail(buildTrainingReplyEmail(input, this.appBaseUrl));
  }

  async sendTrainingRequestTrainerNotificationEmail(
    input: TrainingRequestTrainerNotificationEmailInput,
  ) {
    await this.sendMail(
      buildTrainingRequestTrainerNotificationEmail(input, this.appBaseUrl),
    );
  }
}

class ResendEmailService implements EmailService {
  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
    private readonly appBaseUrl?: string,
  ) {}

  isConfigured() {
    return true;
  }

  async sendMail(email: OutboundEmail) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.fromEmail,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
    });

    if (!response.ok) {
      const payload = await response.text();
      throw new Error(`Resend request failed: ${payload}`);
    }
  }

  async sendTrainingAssignmentReminderEmail(
    input: TrainingAssignmentReminderEmailInput,
  ) {
    await this.sendMail(
      buildTrainingAssignmentReminderEmail(input, this.appBaseUrl),
    );
  }

  async sendTrainingRequestReplyEmail(input: TrainingRequestReplyEmailInput) {
    await this.sendMail(buildTrainingReplyEmail(input, this.appBaseUrl));
  }

  async sendTrainingRequestTrainerNotificationEmail(
    input: TrainingRequestTrainerNotificationEmailInput,
  ) {
    await this.sendMail(
      buildTrainingRequestTrainerNotificationEmail(input, this.appBaseUrl),
    );
  }
}

export function createEmailService(
  options: EmailServiceOptions,
): EmailService {
  if (options.provider === "disabled") {
    return new DisabledEmailService();
  }

  if (options.provider === "smtp") {
    if (!options.fromEmail || !options.smtpHost || !options.smtpPort) {
      throw new Error(
        "SMTP email mode requires EMAIL_FROM, SMTP_HOST, and SMTP_PORT",
      );
    }

    return new SmtpEmailService(
      options.fromEmail,
      {
        host: options.smtpHost,
        port: options.smtpPort,
        secure: options.smtpSecure ?? false,
        ...(options.smtpUser ? { user: options.smtpUser } : {}),
        ...(options.smtpPass ? { pass: options.smtpPass } : {}),
      },
      options.appBaseUrl,
    );
  }

  if (!options.fromEmail || !options.resendApiKey) {
    throw new Error(
      "Resend email mode requires EMAIL_FROM and RESEND_API_KEY",
    );
  }

  return new ResendEmailService(
    options.resendApiKey,
    options.fromEmail,
    options.appBaseUrl,
  );
}
