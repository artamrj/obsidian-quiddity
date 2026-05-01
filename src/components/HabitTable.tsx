import React from "react";
import type { CSSProperties } from "react";
import type { RowModel, DateMeta } from "../types/renderer";
import { HabitGrid } from "./HabitGrid";
import { HabitNameColumn } from "./HabitNameColumn";

export type HabitTableProps = {
  rows: RowModel[];
  dateMetas: DateMeta[];
  longestHabitName: number;
  isUpdating: boolean;
  onToggle: (habitName: string, date: string) => void;
  scrollContainerRef: { current: HTMLDivElement | null };
  onScroll: () => void;
};

export function HabitTable({
  rows,
  dateMetas,
  longestHabitName,
  isUpdating,
  onToggle,
  scrollContainerRef,
  onScroll
}: HabitTableProps) {
  return (
    <div
      className="quiddity-habit-tracker__table"
      style={{
        "--quiddity-habit-date-columns": dateMetas.length,
        "--quiddity-habit-name-width": `clamp(96px, ${longestHabitName + 3}ch, var(--quiddity-habit-name-max-width))`
      } as CSSProperties}
    >
      <HabitNameColumn rows={rows} />
      <HabitGrid
        rows={rows}
        dateMetas={dateMetas}
        isUpdating={isUpdating}
        onToggle={onToggle}
        scrollContainerRef={scrollContainerRef}
        onScroll={onScroll}
      />
    </div>
  );
}
