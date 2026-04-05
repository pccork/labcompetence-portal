import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";

import { env } from "../config/env";
import {
  createEmailService,
  EmailService,
} from "../services/email-service";

declare module "fastify" {
  interface FastifyInstance {
    emailService: EmailService;
  }
}

const emailPlugin: FastifyPluginAsync = async (fastify) => {
  const emailService = createEmailService({
    provider: env.EMAIL_PROVIDER,
    ...(env.EMAIL_FROM ? { fromEmail: env.EMAIL_FROM } : {}),
    ...(env.APP_BASE_URL ? { appBaseUrl: env.APP_BASE_URL } : {}),
    ...(env.RESEND_API_KEY ? { resendApiKey: env.RESEND_API_KEY } : {}),
    ...(env.SMTP_HOST ? { smtpHost: env.SMTP_HOST } : {}),
    smtpPort: env.SMTP_PORT,
    smtpSecure: env.SMTP_SECURE,
    ...(env.SMTP_USER ? { smtpUser: env.SMTP_USER } : {}),
    ...(env.SMTP_PASS ? { smtpPass: env.SMTP_PASS } : {}),
  });

  fastify.decorate("emailService", emailService);
};

export default fp(emailPlugin);
