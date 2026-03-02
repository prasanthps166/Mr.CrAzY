import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";

type LogLevel = "info" | "warn" | "error";
type LogMetadata = Record<string, unknown>;

function safeSerialize(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({
      level: "error",
      event: "logging.serialize_failure",
      timestamp: new Date().toISOString(),
    });
  }
}

function writeLog(level: LogLevel, event: string, metadata: LogMetadata = {}) {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  const line = safeSerialize(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

function toErrorPayload(error: unknown) {
  if (error instanceof Error) {
    return {
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack ?? null,
    };
  }

  return {
    error_name: "UnknownError",
    error_message: String(error),
    error_stack: null,
  };
}

export function getRequestId(request: NextRequest) {
  const headerId = request.headers.get("x-request-id")?.trim() || request.headers.get("x-correlation-id")?.trim();
  return headerId || randomUUID();
}

export function logInfo(event: string, metadata: LogMetadata = {}) {
  writeLog("info", event, metadata);
}

export function logWarn(event: string, metadata: LogMetadata = {}) {
  writeLog("warn", event, metadata);
}

export function logError(event: string, error: unknown, metadata: LogMetadata = {}) {
  writeLog("error", event, {
    ...metadata,
    ...toErrorPayload(error),
  });
}
