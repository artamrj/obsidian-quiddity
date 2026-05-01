import type { RowModel, DateMeta } from "../types/renderer";

export type HabitGridProps = {
  rows: RowModel[];
  dateMetas: DateMeta[];
  isUpdating: boolean;
  onToggle: (habitName: string, date: string) => void;
  scrollContainerRef: { current: HTMLDivElement | null };
  onScroll: () => void;
};

export function HabitGrid({
  rows,
  dateMetas,
  isUpdating,
  onToggle,
  scrollContainerRef,
  onScroll
}: HabitGridProps) {
  return (
    <div
      className="quiddity-habit-tracker__timeline"
      ref={scrollContainerRef}
      onScroll={onScroll}
    >
      <div className="quiddity-habit-tracker__dates-grid">
        {dateMetas.map((dateMeta) => (
          <div
            key={dateMeta.date}
            className={dateMeta.className}
            data-quiddity-pretty-date={dateMeta.prettyDate}
            title={dateMeta.prettyDate}
          >
            <span className="quiddity-habit-tracker__date-number">{dateMeta.day}</span>
          </div>
        ))}

        {rows.map((row) => row.cells.map((cell) => (
          <button
            key={`${row.name}-${cell.date}`}
            aria-label={`${row.name} ${cell.date} ${cell.active ? "completed" : "not completed"}`}
            className={cell.className}
            disabled={isUpdating}
            onClick={() => void onToggle(row.name, cell.date)}
            type="button"
          >
            <span className="quiddity-habit-tick__inner">{cell.label}</span>
          </button>
        )))}
      </div>
    </div>
  );
}
