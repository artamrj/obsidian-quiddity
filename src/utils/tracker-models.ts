import { toDisplayDay } from "../parser";
import type { DateMeta, RowModel } from "../types/renderer";
import { formatPrettyDate, isWeekendDate, toLocalDateKey } from "./date-utils";

type HabitInput = {
  name: string;
  entries: string[];
};

export function buildRows(habits: HabitInput[], timeline: string[]): RowModel[] {
  return habits.map((habit) => {
    const activeDates = new Set(habit.entries);

    return {
      name: habit.name,
      cells: timeline.map((date, index) => {
        const active = activeDates.has(date);
        const previousActive = index > 0 && activeDates.has(timeline[index - 1]);
        const nextActive = index < timeline.length - 1 && activeDates.has(timeline[index + 1]);
        const streakLength = active ? countStreakLength(activeDates, timeline, index) : 0;
        const isStreak = active && (previousActive || nextActive);
        const className = [
          "quiddity-habit-tracker__cell",
          "quiddity-habit-tick",
          active ? "quiddity-habit-tick--ticked" : "",
          active && !previousActive && !nextActive ? "quiddity-habit-tick--single" : "",
          isStreak ? "quiddity-habit-tick--streak" : "",
          active && !previousActive && nextActive ? "quiddity-habit-tick--streak-start" : "",
          active && previousActive && nextActive ? "quiddity-habit-tick--streak-middle" : "",
          active && previousActive && !nextActive ? "quiddity-habit-tick--streak-end" : "",
          isWeekendDate(date) ? "quiddity-habit-tick--weekend" : ""
        ].filter(Boolean).join(" ");

        return {
          date,
          active,
          className,
          label: active && previousActive && !nextActive && streakLength > 1 ? String(streakLength) : ""
        };
      })
    };
  });
}

export function buildDateMetas(timeline: string[]): DateMeta[] {
  const today = toLocalDateKey(new Date());

  return timeline.map((date) => {
    const isWeekend = isWeekendDate(date);
    const className = [
      "quiddity-habit-tracker__cell",
      "quiddity-habit-tracker__cell--date",
      isWeekend ? "quiddity-habit-tracker__cell--weekend" : "",
      date === today ? "quiddity-habit-tracker__cell--today" : ""
    ].filter(Boolean).join(" ");

    return {
      date,
      day: toDisplayDay(date),
      className,
      prettyDate: formatPrettyDate(date)
    };
  });
}

function countStreakLength(activeDates: Set<string>, timeline: string[], index: number): number {
  let start = index;
  let end = index;

  while (start > 0 && activeDates.has(timeline[start - 1])) start -= 1;
  while (end < timeline.length - 1 && activeDates.has(timeline[end + 1])) end += 1;

  return end - start + 1;
}
