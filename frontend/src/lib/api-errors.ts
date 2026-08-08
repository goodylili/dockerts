import { isFormField } from "@/lib/schema";
import type { BioFormValues } from "@/lib/schema";

export interface FieldError {
  field: keyof BioFormValues;
  message: string;
}

interface ParsedError {
  /** Message to show at the top of the form. */
  message: string;
  /** Errors that map onto a specific form control. */
  fieldErrors: FieldError[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Extracts the last string segment of a FastAPI `loc` tuple. */
function locToField(loc: unknown): keyof BioFormValues | null {
  if (!Array.isArray(loc)) return null;
  for (let i = loc.length - 1; i >= 0; i -= 1) {
    const part = loc[i];
    if (typeof part === "string" && isFormField(part)) return part;
  }
  return null;
}

function capitalise(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

/**
 * Turns a backend/proxy error response into a banner message plus per-field
 * errors. Handles FastAPI's 422 shape and the contract's coded error shape.
 */
export function parseApiError(status: number, body: unknown): ParsedError {
  const detail = isRecord(body) ? body.detail : undefined;

  if (status === 422 && Array.isArray(detail)) {
    const fieldErrors: FieldError[] = [];
    const orphans: string[] = [];

    for (const entry of detail) {
      if (!isRecord(entry)) continue;
      const message =
        typeof entry.msg === "string" ? capitalise(entry.msg) : "Invalid value";
      const field = locToField(entry.loc);
      if (field) {
        fieldErrors.push({ field, message });
      } else {
        orphans.push(message);
      }
    }

    return {
      message:
        orphans.length > 0
          ? orphans.join(" ")
          : "Please fix the highlighted fields and try again.",
      fieldErrors,
    };
  }

  if (status === 409) {
    return {
      message:
        "This submission key was already used with different details. Reload the page and fill the form again to record a new person.",
      fieldErrors: [],
    };
  }

  if (isRecord(detail) && typeof detail.message === "string") {
    return { message: detail.message, fieldErrors: [] };
  }

  if (typeof detail === "string") {
    return { message: detail, fieldErrors: [] };
  }

  if (status === 502 || status === 503) {
    return {
      message:
        "The records service is unreachable right now. Your details were not saved — please try again.",
      fieldErrors: [],
    };
  }

  return {
    message: `Something went wrong (HTTP ${status}). Please try again.`,
    fieldErrors: [],
  };
}
