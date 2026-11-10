"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/form-controls";
import { parseApiError } from "@/lib/api-errors";
import {
  BLOOD_TYPES,
  LIMITS,
  SEX_LABELS,
  SEX_VALUES,
  bmiCategory,
  calculateAge,
  calculateBmi,
  isPastDate,
} from "@/lib/bio";
import { COUNTRIES } from "@/lib/countries";
import {
  bioFormSchema,
  emptyBioForm,
  type BioFormPayload,
  type BioFormValues,
} from "@/lib/schema";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "created"; name: string }
  | { kind: "replayed"; name: string }
  | { kind: "error"; message: string };

/** RFC 4122 v4 UUID, with a fallback for non-secure contexts. */
function newIdempotencyKey(): string {
  const webCrypto = globalThis.crypto as Crypto | undefined;
  if (webCrypto && typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (webCrypto) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const toneClasses: Record<string, string> = {
  low: "text-amber-600 dark:text-amber-400",
  normal: "text-emerald-600 dark:text-emerald-400",
  raised: "text-amber-600 dark:text-amber-400",
  high: "text-rose-600 dark:text-rose-400",
};

export function BioForm({ onSaved }: { onSaved: () => void }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  /**
   * One idempotency key per form fill. It survives double-clicks, validation
   * failures and network retries, and is only rotated after a successful save
   * clears the form — so a retry can never create a second record.
   */
  const idempotencyKey = useRef<string | null>(null);
  const keyForThisFill = () => {
    idempotencyKey.current ??= newIdempotencyKey();
    return idempotencyKey.current;
  };

  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BioFormValues, unknown, BioFormPayload>({
    resolver: zodResolver(bioFormSchema),
    defaultValues: emptyBioForm,
    mode: "onBlur",
  });

  const [dob, rawHeight, rawWeight] = useWatch({
    control,
    name: ["date_of_birth", "height_cm", "weight_kg"],
  });
  const height = Number(rawHeight);
  const weight = Number(rawWeight);

  const age = dob && isPastDate(dob) ? calculateAge(dob) : null;
  const bmi = calculateBmi(height, weight);
  const category = bmi === null ? null : bmiCategory(bmi);

  const onSubmit = useCallback(
    async (payload: BioFormPayload) => {
      setStatus({ kind: "submitting" });

      let response: Response;
      try {
        response = await fetch("/api/bio-records", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "Idempotency-Key": keyForThisFill(),
          },
          body: JSON.stringify(payload),
        });
      } catch {
        setStatus({
          kind: "error",
          message:
            "Could not reach the server. Check your connection and try again — retrying is safe, it will not create a duplicate.",
        });
        return;
      }

      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      if (response.ok) {
        const replayed = response.status === 200;
        idempotencyKey.current = null;
        reset(emptyBioForm);
        setStatus({
          kind: replayed ? "replayed" : "created",
          name: payload.full_name,
        });
        onSaved();
        return;
      }

      const parsed = parseApiError(response.status, body);
      for (const fieldError of parsed.fieldErrors) {
        setError(fieldError.field, {
          type: "server",
          message: fieldError.message,
        });
      }
      setStatus({ kind: "error", message: parsed.message });
    },
    [onSaved, reset, setError],
  );

  const busy = isSubmitting || status.kind === "submitting";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      noValidate
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur sm:p-8 dark:border-slate-800 dark:bg-slate-900/60"
    >
      <fieldset disabled={busy} className="space-y-8">
        <legend className="sr-only">Biodata intake</legend>

        <section aria-labelledby="section-identity" className="space-y-4">
          <h2
            id="section-identity"
            className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
          >
            Identity
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Full name"
              required
              autoComplete="name"
              placeholder="Ada Lovelace"
              maxLength={LIMITS.fullName.max}
              error={errors.full_name?.message}
              {...register("full_name")}
            />
            <TextField
              label="Email"
              required
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="ada@example.com"
              error={errors.email?.message}
              {...register("email")}
            />
            <TextField
              label="Phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+234 801 234 5678"
              maxLength={LIMITS.phone.max}
              hint={`Up to ${LIMITS.phone.max} characters.`}
              error={errors.phone?.message}
              {...register("phone")}
            />
            <SelectField
              label="Country"
              hint="ISO-3166 alpha-2 code is stored."
              error={errors.country?.message}
              {...register("country")}
            >
              <option value="">Not specified</option>
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name} ({country.code})
                </option>
              ))}
            </SelectField>
          </div>
        </section>

        <section aria-labelledby="section-body" className="space-y-4">
          <h2
            id="section-body"
            className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
          >
            Body metrics
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <TextField
              label="Date of birth"
              required
              type="date"
              max={today}
              autoComplete="bday"
              error={errors.date_of_birth?.message}
              {...register("date_of_birth")}
            />
            <SelectField
              label="Sex"
              required
              error={errors.sex?.message}
              {...register("sex")}
            >
              <option value="">Select…</option>
              {SEX_VALUES.map((value) => (
                <option key={value} value={value}>
                  {SEX_LABELS[value]}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Height (cm)"
              required
              type="number"
              inputMode="decimal"
              step="0.1"
              min={LIMITS.heightCm.min}
              max={LIMITS.heightCm.max}
              placeholder="170"
              error={errors.height_cm?.message}
              {...register("height_cm")}
            />
            <TextField
              label="Weight (kg)"
              required
              type="number"
              inputMode="decimal"
              step="0.1"
              min={LIMITS.weightKg.min}
              max={LIMITS.weightKg.max}
              placeholder="62.5"
              error={errors.weight_kg?.message}
              {...register("weight_kg")}
            />
          </div>

          <div
            aria-live="polite"
            className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 dark:bg-slate-950/60"
          >
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                Age
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {age === null ? "—" : `${age} yrs`}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                BMI
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {bmi === null ? "—" : bmi.toFixed(1)}{" "}
                {category ? (
                  <span
                    className={`text-sm font-medium ${toneClasses[category.tone]}`}
                  >
                    {category.label}
                  </span>
                ) : null}
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="section-medical" className="space-y-4">
          <h2
            id="section-medical"
            className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
          >
            Medical
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              label="Blood type"
              fieldClassName="sm:col-span-2 sm:max-w-xs"
              error={errors.blood_type?.message}
              {...register("blood_type")}
            >
              <option value="">Unknown</option>
              {BLOOD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </SelectField>
            <TextAreaField
              label="Allergies"
              rows={4}
              maxLength={LIMITS.allergies.max}
              placeholder="Penicillin, peanuts…"
              hint={`Up to ${LIMITS.allergies.max} characters.`}
              error={errors.allergies?.message}
              {...register("allergies")}
            />
            <TextAreaField
              label="Medical notes"
              rows={4}
              maxLength={LIMITS.medicalNotes.max}
              placeholder="Ongoing conditions, medication, anything a clinician should know."
              hint={`Up to ${LIMITS.medicalNotes.max} characters.`}
              error={errors.medical_notes?.message}
              {...register("medical_notes")}
            />
          </div>
        </section>
      </fieldset>

      <div className="mt-8 flex flex-col gap-4 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <StatusBanner status={status} />
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              reset(emptyBioForm);
              idempotencyKey.current = null;
              setStatus({ kind: "idle" });
            }}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:ring-4 focus-visible:ring-slate-400/20 focus-visible:outline-none disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:ring-4 focus-visible:ring-indigo-500/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
          >
            {busy ? (
              <>
                <Spinner />
                Saving…
              </>
            ) : (
              "Save record"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
    />
  );
}

function StatusBanner({ status }: { status: Status }) {
  if (status.kind === "idle" || status.kind === "submitting") {
    return (
      <p
        aria-live="polite"
        className="text-sm text-slate-500 dark:text-slate-400"
      >
        {status.kind === "submitting"
          ? "Saving your details…"
          : "Fields marked * are required."}
      </p>
    );
  }

  const isError = status.kind === "error";
  const message = isError
    ? status.message
    : status.kind === "replayed"
      ? `${status.name} was already recorded — no duplicate was created.`
      : `Saved ${status.name}.`;

  return (
    <p
      role={isError ? "alert" : "status"}
      aria-live="polite"
      className={`rounded-lg px-3 py-2 text-sm font-medium ${
        isError
          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
      }`}
    >
      {message}
    </p>
  );
}
