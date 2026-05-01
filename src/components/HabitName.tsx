export type HabitNameProps = {
  name: string;
};

export function HabitName({ name }: HabitNameProps) {
  return (
    <div className="quiddity-habit-tracker__cell quiddity-habit-tracker__cell--name" title={name}>
      <span className="quiddity-habit-tracker__name-text">{name}</span>
    </div>
  );
}
