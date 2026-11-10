/** Server-only helpers for talking to the FastAPI backend. */

export const DEFAULT_BACKEND_URL = "http://localhost:8000";

/** Reads `BACKEND_URL` at request time (never at module load / build time). */
export function backendUrl(): string {
  const raw = process.env.BACKEND_URL?.trim();
  const base = raw && raw !== "" ? raw : DEFAULT_BACKEND_URL;
  return base.replace(/\/+$/, "");
}

export interface ErrorBody {
  detail: { code: string; message: string };
}

export function errorBody(code: string, message: string): ErrorBody {
  return { detail: { code, message } };
}

/** 502 payload used whenever the backend cannot be reached. */
export const BACKEND_UNREACHABLE = errorBody(
  "backend_unreachable",
  "The records service is unreachable. Please try again in a moment.",
);
