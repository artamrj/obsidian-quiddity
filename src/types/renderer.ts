export type CellModel = {
  date: string;
  active: boolean;
  className: string;
  label: string;
};

export type RowModel = {
  name: string;
  cells: CellModel[];
};

export type DateMeta = {
  date: string;
  day: string;
  className: string;
  prettyDate: string;
};
