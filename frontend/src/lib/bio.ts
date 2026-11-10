/**
 * Domain constants and pure helpers shared by the form, the list and the tests.
 * Mirrors the `bio_records` contract in CONTRACT.md.
 */

export const SEX_VALUES = [
  "male",
  "female",
  "intersex",
  "prefer_not_to_say",
] as const;

export type Sex = (typeof SEX_VALUES)[number];

export const SEX_LABELS: Record<Sex, string> = {
  male: "Male",
  female: "Female",
  intersex: "Intersex",
  prefer_not_to_say: "Prefer not to say",
};

export const BLOOD_TYPES = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;

export type BloodType = (typeof BLOOD_TYPES)[number];

export const LIMITS = {
  fullName: { min: 1, max: 200 },
  phone: { max: 32 },
  heightCm: { min: 30, max: 300 },
  weightKg: { min: 2, max: 650 },
  allergies: { max: 2000 },
  medicalNotes: { max: 5000 },
  maxAge: 130,
} as const;

/** The writable payload sent to `POST /api/bio-records`. */
export interface BioRecordInput {
  full_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string;
  sex: Sex;
  height_cm: number;
  weight_kg: number;
  blood_type: BloodType | null;
  allergies: string | null;
  medical_notes: string | null;
  country: string | null;
}

/** The resource shape returned by the backend. */
export interface BioRecord extends BioRecordInput {
  id: string;
  age: number;
  bmi: number;
  created_at: string;
  updated_at: string;
}

export interface BioRecordList {
  items: BioRecord[];
  total: number;
  limit: number;
  offset: number;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a `YYYY-MM-DD` string into its calendar parts, returning `null` when
 * the string is malformed or the date does not exist (e.g. `2023-02-30`).
 */
export function parseIsoDate(
  value: string,
): { year: number; month: number; day: number } | null {
  const match = ISO_DATE.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/**
 * Whole years between `dob` and `now`. Returns `null` for an unparseable date
 * and a negative number for dates in the future (callers decide what to do).
 */
export function calculateAge(dob: string, now: Date = new Date()): number | null {
  const parts = parseIsoDate(dob);
  if (!parts) return null;
  let age = now.getFullYear() - parts.year;
  const monthDiff = now.getMonth() + 1 - parts.month;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < parts.day)) {
    age -= 1;
  }
  return age;
}

/** True when `dob` is strictly before today (local calendar day). */
export function isPastDate(dob: string, now: Date = new Date()): boolean {
  const parts = parseIsoDate(dob);
  if (!parts) return false;
  const value = Date.UTC(parts.year, parts.month - 1, parts.day);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return value < today;
}

/** BMI in kg/m², rounded to 1 decimal place. `null` for non-positive input. */
export function calculateBmi(
  heightCm: number,
  weightKg: number,
): number | null {
  if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg)) return null;
  if (heightCm <= 0 || weightKg <= 0) return null;
  const metres = heightCm / 100;
  return Math.round((weightKg / (metres * metres)) * 10) / 10;
}

export interface BmiCategory {
  label: string;
  tone: "low" | "normal" | "raised" | "high";
}

export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return { label: "Underweight", tone: "low" };
  if (bmi < 25) return { label: "Healthy range", tone: "normal" };
  if (bmi < 30) return { label: "Overweight", tone: "raised" };
  return { label: "Obese", tone: "high" };
}
