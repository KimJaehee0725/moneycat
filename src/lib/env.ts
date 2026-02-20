import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_COOKIE_NAME: z.string().min(1).default("moneycat_session"),
  APP_TIMEZONE: z.string().default("Asia/Seoul"),
  APP_CURRENCY: z.string().default("KRW"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function env(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse({
    DATABASE_URL:
      process.env.DATABASE_URL ??
      (process.env.NODE_ENV === "production"
        ? undefined
        : "postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public"),
    AUTH_SECRET:
      process.env.AUTH_SECRET ??
      (process.env.NODE_ENV === "production"
        ? undefined
        : "development-secret-development-secret-1234"),
    AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME,
    APP_TIMEZONE: process.env.APP_TIMEZONE,
    APP_CURRENCY: process.env.APP_CURRENCY,
  });

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid environment variables: ${message}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
