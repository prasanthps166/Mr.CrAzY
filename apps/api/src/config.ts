import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("*"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  STORAGE_BACKEND: z.enum(["file", "postgres"]).optional(),
  DATABASE_URL: z.string().url().optional(),
  FILE_STORAGE_PATH: z.string().optional()
});

const parsedConfig = envSchema.parse(process.env);

const resolvedStorageBackend =
  parsedConfig.STORAGE_BACKEND ??
  (parsedConfig.DATABASE_URL ? "postgres" : "file");

if (resolvedStorageBackend === "postgres" && !parsedConfig.DATABASE_URL) {
  throw new Error("DATABASE_URL is required when STORAGE_BACKEND=postgres");
}

export const config = {
  ...parsedConfig,
  STORAGE_BACKEND: resolvedStorageBackend
};

