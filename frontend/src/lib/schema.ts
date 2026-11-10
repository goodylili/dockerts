import { z } from "zod";

import {
  BLOOD_TYPES,
  LIMITS,
  SEX_VALUES,
  calculateAge,
  isPastDate,
  parseIsoDate,
  type BioRecordInput,
  type Sex,
} from "@/lib/bio";

/**
 * Every control in the form is a string-valued DOM input, so the schema takes
 * strings and produces the JSON payload the backend expects. Constraints mirror
 * CONTRACT.md exactly.
 */

const optionalText = (max: number, label: string) =>
  z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length <= max, {
      message: `${label} must be ${max} characters or fewer`,
    })
    .transform((value) => (value === "" ? null : value));

const decimal = (label: string, min: number, max: number) =>
  z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value !== "", { message: `${label} is required` })
    .refine((value) => value === "" || /^\d+(\.\d+)?$/.test(value), {
      message: `${label} must be a number`,
    })
    .transform((value) => Number(value))
    .refine((value) => Number.isFinite(value) && value >= min && value <= max, {
      message: `${label} must be between ${min} and ${max}`,
    });

export const bioFormSchema = z.object({
  full_name: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length >= LIMITS.fullName.min, {
      message: "Full name is required",
    })
    .refine((value) => value.length <= LIMITS.fullName.max, {
      message: `Full name must be ${LIMITS.fullName.max} characters or fewer`,
    }),

  email: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .refine((value) => value !== "", { message: "Email is required" })
    .refine((value) => value === "" || z.email().safeParse(value).success, {
      message: "Enter a valid email address",
    }),

  phone: optionalText(LIMITS.phone.max, "Phone"),

  date_of_birth: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value !== "", { message: "Date of birth is required" })
    .refine((value) => value === "" || parseIsoDate(value) !== null, {
      message: "Enter a valid date",
    })
    .refine((value) => parseIsoDate(value) === null || isPastDate(value), {
      message: "Date of birth must be in the past",
    })
    .refine(
      (value) => {
        const age = calculateAge(value);
        return age === null || age <= LIMITS.maxAge;
      },
      { message: `Age must be ${LIMITS.maxAge} or under` },
    ),

  sex: z
    .string()
    .refine((value) => (SEX_VALUES as readonly string[]).includes(value), {
      message: "Select a sex",
    })
    .transform((value) => value as Sex),

  height_cm: decimal("Height", LIMITS.heightCm.min, LIMITS.heightCm.max),
  weight_kg: decimal("Weight", LIMITS.weightKg.min, LIMITS.weightKg.max),

  blood_type: z
    .string()
    .transform((value) => value.trim())
    .refine(
      (value) =>
        value === "" || (BLOOD_TYPES as readonly string[]).includes(value),
      { message: "Select a valid blood type" },
    )
    .transform((value) =>
      value === "" ? null : (value as (typeof BLOOD_TYPES)[number]),
    ),

  allergies: optionalText(LIMITS.allergies.max, "Allergies"),
  medical_notes: optionalText(LIMITS.medicalNotes.max, "Medical notes"),

  country: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .refine((value) => value === "" || /^[A-Z]{2}$/.test(value), {
      message: "Country must be a 2-letter ISO code",
    })
    .transform((value) => (value === "" ? null : value)),
});

/** What the form controls hold (all strings). */
export type BioFormValues = z.input<typeof bioFormSchema>;

/** What a successful parse produces — the backend payload. */
export type BioFormPayload = z.output<typeof bioFormSchema>;

// Compile-time guarantee that the parsed output matches the contract payload.
const _payloadMatchesContract: BioRecordInput = null as unknown as BioFormPayload;
void _payloadMatchesContract;

export const emptyBioForm: BioFormValues = {
  full_name: "",
  email: "",
  phone: "",
  date_of_birth: "",
  sex: "",
  height_cm: "",
  weight_kg: "",
  blood_type: "",
  allergies: "",
  medical_notes: "",
  country: "",
};

/** Field names the server may report validation errors against. */
export const FORM_FIELDS = Object.keys(emptyBioForm) as (keyof BioFormValues)[];

export function isFormField(name: string): name is keyof BioFormValues {
  return (FORM_FIELDS as string[]).includes(name);
}
