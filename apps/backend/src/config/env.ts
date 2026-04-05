import dotenv from "dotenv";

dotenv.config();

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
