import type { ParseDiagnostic } from "../types";

export type DiagnosticsPanelProps = {
  diagnostics: ParseDiagnostic[];
};

export function DiagnosticsPanel({ diagnostics }: DiagnosticsPanelProps) {
  if (diagnostics.length === 0) return null;

  return (
    <div className="quiddity-diagnostics" role="status">
      {diagnostics.map((diagnostic, index) => (
        <div key={`${diagnostic.line}-${index}`} className="quiddity-diagnostics__item quiddity-diagnostics__item--error">
          Line {diagnostic.line}: {diagnostic.message}
        </div>
      ))}
    </div>
  );
}
