import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDateMetas, buildRows } from "../../src/utils/tracker-models";

describe("buildRows", () => {
  it("marks single and streak cells with expected classes", () => {
    const timeline = ["2026-01-16", "2026-01-17", "2026-01-18", "2026-01-19"];
    const rows = buildRows([
      { name: "Exercise", entries: ["2026-01-16", "2026-01-17", "2026-01-19"] }
    ], timeline);

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Exercise");

    const first = rows[0].cells[0];
    expect(first.className).toContain("quiddity-habit-tick--ticked");
    expect(first.className).toContain("quiddity-habit-tick--streak-start");

    const second = rows[0].cells[1];
    expect(second.className).toContain("quiddity-habit-tick--streak-end");
    expect(second.label).toBe("2");

    const third = rows[0].cells[2];
    expect(third.className).not.toContain("quiddity-habit-tick--ticked");

    const fourth = rows[0].cells[3];
    expect(fourth.className).toContain("quiddity-habit-tick--single");
    expect(fourth.label).toBe("");
  });

  it("applies weekend class to weekend timeline cells", () => {
    const timeline = ["2026-01-17", "2026-01-18", "2026-01-19"];
    const rows = buildRows([
      { name: "Weekend habit", entries: ["2026-01-17", "2026-01-19"] }
    ], timeline);

    expect(rows[0].cells[0].className).toContain("quiddity-habit-tick--weekend");
    expect(rows[0].cells[1].className).toContain("quiddity-habit-tick--weekend");
    expect(rows[0].cells[2].className).not.toContain("quiddity-habit-tick--weekend");
  });
});

describe("buildDateMetas", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 18, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets day token, weekend class, tooltip, and today class", () => {
    const metas = buildDateMetas(["2026-01-17", "2026-01-18", "2026-01-19"]);

    expect(metas[0].day).toBe("17");
    expect(metas[0].className).toContain("quiddity-habit-tracker__cell--weekend");

    expect(metas[1].className).toContain("quiddity-habit-tracker__cell--today");
    expect(metas[1].prettyDate).toBe("Sunday, January 18, 2026");

    expect(metas[2].className).not.toContain("quiddity-habit-tracker__cell--weekend");
  });
});
