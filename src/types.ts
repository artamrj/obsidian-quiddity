export type SourceStyle = "compact" | "habits-block";

export type QuiddityConfig = {
  title?: string;
  from: string;
  days: number;
  theme: string;
  habits: Habit[];
};

export type Habit = {
  name: string;
  entries: string[];
  color?: string;
};

export type ParseDiagnostic = {
  line: number;
  message: string;
};

export type ParsedQuiddity = {
  config: QuiddityConfig;
  timeline: string[];
  diagnostics: ParseDiagnostic[];
  sourceStyle: SourceStyle;
};

export type SourceHabitLine = {
  name: string;
  entriesText: string;
  lineIndex: number;
  indent: string;
  bullet: boolean;
};

export type SourceDocument = {
  source: string;
  sourceStyle: SourceStyle;
  metaLines: string[];
  habitLines: SourceHabitLine[];
};
