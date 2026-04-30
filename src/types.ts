export type QuiddityConfig = {
  from: string;
  days: number;
  habits: Habit[];
};

export type Habit = {
  name: string;
  entries: string[];
};

export type ParseDiagnostic = {
  line: number;
  message: string;
};

export type ParsedQuiddity = {
  config: QuiddityConfig;
  timeline: string[];
  diagnostics: ParseDiagnostic[];
};

export type SourceHabitLine = {
  name: string;
  entriesText: string;
  lineIndex: number;
  indent: string;
};

export type SourceDocument = {
  source: string;
  metaLines: SourceMetaLine[];
  habitLines: SourceHabitLine[];
};

export type SourceMetaLine = {
  key: string;
  value: string;
  lineIndex: number;
};
