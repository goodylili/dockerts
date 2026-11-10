import { describe, expect, it } from "vitest";

import {
  bmiCategory,
  calculateAge,
  calculateBmi,
  isPastDate,
  parseIsoDate,
} from "@/lib/bio";

const NOW = new Date(2026, 7, 8); // 2026-08-08 local time

describe("parseIsoDate", () => {
  it("accepts a well-formed date", () => {
    expect(parseIsoDate("1990-05-02")).toEqual({
      year: 1990,
      month: 5,
      day: 2,
    });
  });

  it("rejects malformed and impossible dates", () => {
    expect(parseIsoDate("")).toBeNull();
    expect(parseIsoDate("02/05/1990")).toBeNull();
    expect(parseIsoDate("1990-13-01")).toBeNull();
    expect(parseIsoDate("2023-02-30")).toBeNull();
    expect(parseIsoDate("2023-2-3")).toBeNull();
  });
});

describe("calculateAge", () => {
  it("counts whole years", () => {
    expect(calculateAge("1990-05-02", NOW)).toBe(36);
  });

  it("does not count a birthday that has not happened yet", () => {
    expect(calculateAge("1990-12-31", NOW)).toBe(35);
  });

  it("counts a birthday that is today", () => {
    expect(calculateAge("2000-08-08", NOW)).toBe(26);
  });

  it("does not count a birthday one day away", () => {
    expect(calculateAge("2000-08-09", NOW)).toBe(25);
  });

  it("returns null for an unparseable date", () => {
    expect(calculateAge("not-a-date", NOW)).toBeNull();
  });
});

describe("isPastDate", () => {
  it("is false for today and the future", () => {
    expect(isPastDate("2026-08-08", NOW)).toBe(false);
    expect(isPastDate("2030-01-01", NOW)).toBe(false);
  });

  it("is true for yesterday", () => {
    expect(isPastDate("2026-08-07", NOW)).toBe(true);
  });
});

describe("calculateBmi", () => {
  it("computes kg/m² rounded to one decimal", () => {
    expect(calculateBmi(170, 62.5)).toBe(21.6);
    expect(calculateBmi(180, 81)).toBe(25);
  });

  it("rejects non-positive or non-finite input", () => {
    expect(calculateBmi(0, 70)).toBeNull();
    expect(calculateBmi(170, 0)).toBeNull();
    expect(calculateBmi(Number.NaN, 70)).toBeNull();
  });
});

describe("bmiCategory", () => {
  it("labels the standard bands", () => {
    expect(bmiCategory(17).tone).toBe("low");
    expect(bmiCategory(22).tone).toBe("normal");
    expect(bmiCategory(27).tone).toBe("raised");
    expect(bmiCategory(35).tone).toBe("high");
  });
});
