import { describe, expect, it } from "vitest";

import { bioFormSchema, emptyBioForm, isFormField } from "@/lib/schema";
import type { BioFormValues } from "@/lib/schema";

const valid: BioFormValues = {
  full_name: "  Ada Lovelace  ",
  email: "  Ada@Example.COM ",
  phone: "+2348012345678",
  date_of_birth: "1990-05-02",
  sex: "female",
  height_cm: "170",
  weight_kg: "62.5",
  blood_type: "O+",
  allergies: "",
  medical_notes: "",
  country: "ng",
};

function errorFor(values: Partial<BioFormValues>, field: keyof BioFormValues) {
  const result = bioFormSchema.safeParse({ ...valid, ...values });
  expect(result.success).toBe(false);
  if (result.success) throw new Error("expected failure");
  const issue = result.error.issues.find((i) => i.path[0] === field);
  expect(issue, `expected an issue on ${field}`).toBeDefined();
  return issue!.message;
}

describe("bioFormSchema — happy path", () => {
  it("normalises and produces the contract payload", () => {
    const result = bioFormSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data).toEqual({
      full_name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "+2348012345678",
      date_of_birth: "1990-05-02",
      sex: "female",
      height_cm: 170,
      weight_kg: 62.5,
      blood_type: "O+",
      allergies: null,
      medical_notes: null,
      country: "NG",
    });
  });

  it("maps blank optional fields to null", () => {
    const result = bioFormSchema.safeParse({
      ...valid,
      phone: "   ",
      blood_type: "",
      country: "",
      allergies: "  peanuts ",
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.phone).toBeNull();
    expect(result.data.blood_type).toBeNull();
    expect(result.data.country).toBeNull();
    expect(result.data.allergies).toBe("peanuts");
  });
});

describe("bioFormSchema — required fields", () => {
  it("rejects an empty form", () => {
    const result = bioFormSchema.safeParse(emptyBioForm);
    expect(result.success).toBe(false);
  });

  it("requires a full name of 1..200 characters", () => {
    expect(errorFor({ full_name: "   " }, "full_name")).toMatch(/required/i);
    expect(errorFor({ full_name: "a".repeat(201) }, "full_name")).toMatch(
      /200/,
    );
    expect(
      bioFormSchema.safeParse({ ...valid, full_name: "a".repeat(200) }).success,
    ).toBe(true);
  });

  it("requires a valid email", () => {
    expect(errorFor({ email: "" }, "email")).toMatch(/required/i);
    expect(errorFor({ email: "not-an-email" }, "email")).toMatch(/valid email/i);
  });

  it("requires a known sex value", () => {
    expect(errorFor({ sex: "" }, "sex")).toMatch(/select a sex/i);
    expect(errorFor({ sex: "other" }, "sex")).toMatch(/select a sex/i);
    for (const sex of ["male", "female", "intersex", "prefer_not_to_say"]) {
      expect(bioFormSchema.safeParse({ ...valid, sex }).success).toBe(true);
    }
  });
});

describe("bioFormSchema — date of birth", () => {
  it("rejects malformed dates", () => {
    expect(errorFor({ date_of_birth: "" }, "date_of_birth")).toMatch(
      /required/i,
    );
    expect(errorFor({ date_of_birth: "1990-02-30" }, "date_of_birth")).toMatch(
      /valid date/i,
    );
  });

  it("rejects dates that are not in the past", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(errorFor({ date_of_birth: today }, "date_of_birth")).toMatch(
      /in the past/i,
    );
    expect(errorFor({ date_of_birth: "2999-01-01" }, "date_of_birth")).toMatch(
      /in the past/i,
    );
  });

  it("rejects an age above 130", () => {
    const tooOld = new Date();
    tooOld.setFullYear(tooOld.getFullYear() - 131);
    expect(
      errorFor({ date_of_birth: tooOld.toISOString().slice(0, 10) }, "date_of_birth"),
    ).toMatch(/130/);
  });

  it("accepts an age of exactly 130", () => {
    const edge = new Date();
    edge.setFullYear(edge.getFullYear() - 130);
    edge.setDate(edge.getDate() + 1);
    expect(
      bioFormSchema.safeParse({
        ...valid,
        date_of_birth: edge.toISOString().slice(0, 10),
      }).success,
    ).toBe(true);
  });
});

describe("bioFormSchema — measurements", () => {
  it("enforces the height range", () => {
    expect(errorFor({ height_cm: "" }, "height_cm")).toMatch(/required/i);
    expect(errorFor({ height_cm: "abc" }, "height_cm")).toMatch(/number/i);
    expect(errorFor({ height_cm: "29.9" }, "height_cm")).toMatch(/30 and 300/);
    expect(errorFor({ height_cm: "300.1" }, "height_cm")).toMatch(/30 and 300/);
    expect(bioFormSchema.safeParse({ ...valid, height_cm: "30" }).success).toBe(
      true,
    );
    expect(bioFormSchema.safeParse({ ...valid, height_cm: "300" }).success).toBe(
      true,
    );
  });

  it("enforces the weight range", () => {
    expect(errorFor({ weight_kg: "1.9" }, "weight_kg")).toMatch(/2 and 650/);
    expect(errorFor({ weight_kg: "651" }, "weight_kg")).toMatch(/2 and 650/);
    expect(bioFormSchema.safeParse({ ...valid, weight_kg: "2" }).success).toBe(
      true,
    );
    expect(bioFormSchema.safeParse({ ...valid, weight_kg: "650" }).success).toBe(
      true,
    );
  });
});

describe("bioFormSchema — optional fields", () => {
  it("enforces blood type enum", () => {
    expect(errorFor({ blood_type: "C+" }, "blood_type")).toMatch(/blood type/i);
    for (const type of ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]) {
      expect(
        bioFormSchema.safeParse({ ...valid, blood_type: type }).success,
      ).toBe(true);
    }
  });

  it("enforces text length caps", () => {
    expect(errorFor({ phone: "1".repeat(33) }, "phone")).toMatch(/32/);
    expect(errorFor({ allergies: "a".repeat(2001) }, "allergies")).toMatch(
      /2000/,
    );
    expect(
      errorFor({ medical_notes: "a".repeat(5001) }, "medical_notes"),
    ).toMatch(/5000/);
  });

  it("requires a two-letter country code", () => {
    expect(errorFor({ country: "NGA" }, "country")).toMatch(/2-letter/);
    expect(errorFor({ country: "1" }, "country")).toMatch(/2-letter/);
  });
});

describe("isFormField", () => {
  it("recognises writable fields only", () => {
    expect(isFormField("email")).toBe(true);
    expect(isFormField("height_cm")).toBe(true);
    expect(isFormField("id")).toBe(false);
    expect(isFormField("body")).toBe(false);
  });
});
