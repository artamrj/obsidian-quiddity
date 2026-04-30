import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

rmSync(".test-dist", { recursive: true, force: true });
mkdirSync(".test-dist", { recursive: true });

execFileSync("npx", [
  "esbuild",
  "src/parser.ts",
  "src/updater.ts",
  "--bundle",
  "--platform=node",
  "--format=esm",
  "--alias:obsidian=./tests/obsidian-stub.mjs",
  "--out-extension:.js=.mjs",
  "--outdir=.test-dist"
], { stdio: "inherit" });

const parser = await import(pathToFileURL(`${process.cwd()}/.test-dist/parser.mjs`));
const updater = await import(pathToFileURL(`${process.cwd()}/.test-dist/updater.mjs`));

const canonical = `from = 2026-01-16
days = 21

habits = [
  ["Exercise", ["2026-01-16..2026-01-18", "2026-01-21", "2026-01-23"]],
  ["Reading", ["2026-01-17", "2026-01-17", "2026-01-19"]],
  ["Vitamins", ["nope", "2026-01-20..2026-01-22"]],
]`;

const parsed = parser.parseQuiddity(canonical, new Date(Date.UTC(2026, 0, 16)));
assert.equal(parsed.config.from, "2026-01-16");
assert.equal(parsed.config.days, 21);
assert.equal(parsed.timeline.at(0), "2026-01-16");
assert.equal(parsed.timeline.at(-1), "2026-02-05");
assert.deepEqual(parsed.config.habits[0].entries, [
  "2026-01-16",
  "2026-01-17",
  "2026-01-18",
  "2026-01-21",
  "2026-01-23"
]);
assert.deepEqual(parsed.config.habits[1].entries, [
  "2026-01-17",
  "2026-01-19"
]);
assert.deepEqual(parsed.config.habits[2].entries, [
  "2026-01-20",
  "2026-01-21",
  "2026-01-22"
]);
assert.equal(parsed.diagnostics.length, 1);
assert.match(parsed.diagnostics[0].message, /Could not parse entry/);

const quotedFrom = parser.parseQuiddity(`from = "2026-01-16"
days = 2
habits = [["Exercise", ["2026-01-16"]]]`);
assert.equal(quotedFrom.config.from, "2026-01-16");

const invalidToml = parser.parseQuiddity(`from: 2026-01-16
days: 3

habits:
  - Exercise: 2026-01-16`);
assert.equal(invalidToml.config.habits.length, 0);
assert.match(invalidToml.diagnostics[0].message, /Invalid TOML/);

const invalidTypes = parser.parseQuiddity(`from = 123
days = "21"
habits = "Exercise"`);
assert.equal(invalidTypes.diagnostics.length, 3);
assert.match(invalidTypes.diagnostics[0].message, /from must be/);
assert.match(invalidTypes.diagnostics[1].message, /days must be/);
assert.match(invalidTypes.diagnostics[2].message, /habits must be/);

const invalidHabits = parser.parseQuiddity(`from = 2026-01-16
days = 3
habits = [
  ["Exercise"],
  [123, ["2026-01-16"]],
  ["Reading", [2026-01-16]],
  ["Vitamins", "2026-01-16"],
]`);
assert.equal(invalidHabits.config.habits.length, 2);
assert.equal(invalidHabits.diagnostics.length, 4);
assert.match(invalidHabits.diagnostics[0].message, /must be \[name, entries\]/);
assert.match(invalidHabits.diagnostics[1].message, /non-empty string name/);
assert.match(invalidHabits.diagnostics[2].message, /entries must contain only strings/);
assert.match(invalidHabits.diagnostics[3].message, /entries must be an array/);

const missingHabits = parser.parseQuiddity(`from = 2026-01-16
days = 3`);
assert.equal(missingHabits.config.habits.length, 0);
assert.match(missingHabits.diagnostics[0].message, /habits must be/);

const shortcuts = parser.parseQuiddity(`from = 2026-01-16
days = 3
habits = [["Exercise", ["16", "2026-01-16..+3", "2026-01-18..2026-01-17"]]]`);
assert.equal(shortcuts.config.habits[0].entries.length, 0);
assert.equal(shortcuts.diagnostics.length, 3);

assert.equal(parser.serializeEntries([
  "2026-01-17",
  "2026-01-16",
  "2026-01-16",
  "2026-01-18",
  "bad"
]), "2026-01-16..2026-01-18");
assert.equal(parser.serializeEntriesArray([
  "2026-01-17",
  "2026-01-16",
  "2026-01-18"
]), `["2026-01-16..2026-01-18"]`);

const added = updater.toggleHabitDateInSource(canonical, "Exercise", "2026-01-19");
assert.match(added, /^ {2}\["Exercise", \["2026-01-16\.\.2026-01-19", "2026-01-21", "2026-01-23"\]\],/m);
assert.match(added, /^\s+\["Reading"/m);

const removed = updater.toggleHabitDateInSource(added, "Exercise", "2026-01-17");
assert.match(removed, /^ {2}\["Exercise", \["2026-01-16", "2026-01-18\.\.2026-01-19", "2026-01-21", "2026-01-23"\]\],/m);

const multiline = `from = 2026-01-16
days = 3
habits = [
  [
    "Exercise",
    [
      "2026-01-16",
      "2026-01-18",
    ],
  ],
]`;
const normalized = updater.toggleHabitDateInSource(multiline, "Exercise", "2026-01-17");
assert.match(normalized, /^ {2}\["Exercise", \["2026-01-16\.\.2026-01-18"\]\],/m);
assert.doesNotMatch(normalized, /^\s+"2026-01-18",/m);

const noteContent = `Before

\`\`\`quiddity
from = 2026-01-16
days = 3
habits = [
  ["Exercise", ["2026-01-16"]],
]
\`\`\`

After`;
const fakeFile = { extension: "md", path: "habit.md" };
let modifiedContent = "";
const fakeApp = {
  vault: {
    getAbstractFileByPath(path) {
      return path === fakeFile.path ? fakeFile : null;
    },
    async read(file) {
      assert.equal(file, fakeFile);
      return noteContent;
    },
    async modify(file, content) {
      assert.equal(file, fakeFile);
      modifiedContent = content;
    }
  }
};
const fakeCtx = {
  sourcePath: fakeFile.path,
  getSectionInfo() {
    return { lineStart: 2, lineEnd: 8 };
  }
};
const replaced = await updater.replaceQuiddityBlockInFile(
  fakeApp,
  fakeCtx,
  {},
  `from = 2026-01-16
days = 3
habits = [
  ["Exercise", ["2026-01-16..2026-01-18"]],
]`
);
assert.equal(replaced, true);
assert.equal(modifiedContent, `Before

\`\`\`quiddity
from = 2026-01-16
days = 3
habits = [
  ["Exercise", ["2026-01-16..2026-01-18"]],
]
\`\`\`

After`);

const missingSection = await updater.replaceQuiddityBlockInFile(
  fakeApp,
  { ...fakeCtx, getSectionInfo: () => null },
  {},
  canonical
);
assert.equal(missingSection, false);

console.log("parser-updater tests passed");
