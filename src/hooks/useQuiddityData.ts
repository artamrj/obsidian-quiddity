import { useMemo } from "react";
import { parseQuiddity } from "../parser";
import { buildDateMetas, buildRows } from "../utils/tracker-models";

export function useQuiddityData(source: string) {
  const parsed = useMemo(() => parseQuiddity(source), [source]);
  const dateMetas = useMemo(() => buildDateMetas(parsed.timeline), [parsed.timeline]);
  const rows = useMemo(() => buildRows(parsed.config.habits, parsed.timeline), [
    parsed.config.habits,
    parsed.timeline
  ]);
  const longestHabitName = useMemo(() => Math.max(0, ...rows.map((row) => row.name.length)), [rows]);

  return { parsed, dateMetas, rows, longestHabitName };
}
