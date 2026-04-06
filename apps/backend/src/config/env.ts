import dotenv from "dotenv";

dotenv.config();

function getBooleanEnv(name: string, defaultValue = false): boolean {
  const value = getOptionalEnv(name);

  if (!value) {
    return defaultValue;
  }

  return value === "true";
}

function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function getEnv(name: string): string {
  const value = getOptionalEnv(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  PORT: Number(process.env.PORT ?? 3000),
  DATABASE_URL: getEnv("DATABASE_URL"),
  JWT_SECRET: getEnv("JWT_SECRET"),
  APP_BASE_URL: getOptionalEnv("APP_BASE_URL"),
  AUTH_LOCAL_ENABLED: getBooleanEnv("AUTH_LOCAL_ENABLED", true),
  AUTH_MICROSOFT_ENABLED: getBooleanEnv(
    "AUTH_MICROSOFT_ENABLED",
    false
  ),
  MICROSOFT_TENANT_ID: getOptionalEnv("MICROSOFT_TENANT_ID"),
  MICROSOFT_CLIENT_ID: getOptionalEnv("MICROSOFT_CLIENT_ID"),
  MICROSOFT_CLIENT_SECRET: getOptionalEnv("MICROSOFT_CLIENT_SECRET"),
  MICROSOFT_ALLOWED_EMAIL_DOMAIN: getOptionalEnv(
    "MICROSOFT_ALLOWED_EMAIL_DOMAIN"
  ),
  EMAIL_PROVIDER:
    (getOptionalEnv("EMAIL_PROVIDER") as
      | "disabled"
      | "smtp"
      | "resend"
      | undefined) ?? "disabled",
  EMAIL_FROM: getOptionalEnv("EMAIL_FROM"),
  RESEND_API_KEY: getOptionalEnv("RESEND_API_KEY"),
  SMTP_HOST: getOptionalEnv("SMTP_HOST"),
  SMTP_PORT: Number(getOptionalEnv("SMTP_PORT") ?? 1025),
  SMTP_SECURE: getOptionalEnv("SMTP_SECURE") === "true",
  SMTP_USER: getOptionalEnv("SMTP_USER"),
  SMTP_PASS: getOptionalEnv("SMTP_PASS"),
};
