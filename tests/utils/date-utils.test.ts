import { describe, expect, it } from "vitest";
import { formatPrettyDate, isWeekendDate, toLocalDateKey, toUtcDate } from "../../src/utils/date-utils";

describe("toUtcDate", () => {
  it("parses a valid ISO date", () => {
    const parsed = toUtcDate("2026-01-16");

    expect(parsed).toBeInstanceOf(Date);
    expect(parsed?.toISOString()).toBe("2026-01-16T00:00:00.000Z");
  });

  it("returns null for invalid date shapes", () => {
    expect(toUtcDate("2026-1-16")).toBeNull();
    expect(toUtcDate("nope")).toBeNull();
  });

  it("returns null for impossible calendar dates", () => {
    expect(toUtcDate("2026-02-30")).toBeNull();
    expect(toUtcDate("2025-13-01")).toBeNull();
  });
});

describe("toLocalDateKey", () => {
  it("formats local date as YYYY-MM-DD", () => {
    const date = new Date(2026, 0, 6);

    expect(toLocalDateKey(date)).toBe("2026-01-06");
  });
});

describe("isWeekendDate", () => {
  it("detects weekend dates", () => {
    expect(isWeekendDate("2026-01-17")).toBe(true);
    expect(isWeekendDate("2026-01-18")).toBe(true);
  });

  it("returns false for weekdays and invalid dates", () => {
    expect(isWeekendDate("2026-01-19")).toBe(false);
    expect(isWeekendDate("bad")).toBe(false);
  });
});

describe("formatPrettyDate", () => {
  it("formats valid dates for tooltips", () => {
    expect(formatPrettyDate("2026-01-16")).toBe("Friday, January 16, 2026");
  });

  it("returns original token for invalid values", () => {
    expect(formatPrettyDate("bad")).toBe("bad");
  });
});
