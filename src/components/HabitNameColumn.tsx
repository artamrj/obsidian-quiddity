import type { RowModel } from "../types/renderer";
import { HabitName } from "./HabitName";

export type HabitNameColumnProps = {
  rows: RowModel[];
};

export function HabitNameColumn({ rows }: HabitNameColumnProps) {
  return (
    <div className="quiddity-habit-tracker__names">
      <div className="quiddity-habit-tracker__cell quiddity-habit-tracker__cell--name quiddity-habit-tracker__cell--corner" aria-hidden="true" />
      {rows.map((row) => (
        <HabitName key={row.name} name={row.name} />
      ))}
    </div>
  );
}
