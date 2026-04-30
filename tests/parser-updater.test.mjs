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

const compact = `from: 2026-01-16
days: 21
theme: violet

Exercise: 16..18, 21, 23, 25, 27
OSS: 24..25, 27, 29..+8
Reading: nope`;

const parsedCompact = parser.parseQuiddity(compact, new Date(Date.UTC(2026, 0, 16)));
assert.equal(parsedCompact.sourceStyle, "compact");
assert.equal(parsedCompact.timeline.at(0), "2026-01-16");
assert.equal(parsedCompact.timeline.at(-1), "2026-02-05");
assert.deepEqual(parsedCompact.config.habits[0].entries, [
  "2026-01-16",
  "2026-01-17",
  "2026-01-18",
  "2026-01-21",
  "2026-01-23",
  "2026-01-25",
  "2026-01-27"
]);
assert.deepEqual(parsedCompact.config.habits[1].entries.slice(-8), [
  "2026-01-29",
  "2026-01-30",
  "2026-01-31",
  "2026-02-01",
  "2026-02-02",
  "2026-02-03",
  "2026-02-04",
  "2026-02-05"
]);
assert.equal(parsedCompact.diagnostics.length, 1);
assert.match(parsedCompact.diagnostics[0].message, /Could not parse entry/);

const coloredHabit = parser.parseQuiddity(`from: 2026-01-16
days: 3

Exercise [#7dd3fc]: 16, 16, 17`);
assert.equal(coloredHabit.config.habits[0].name, "Exercise");
assert.equal(coloredHabit.config.habits[0].color, "#7dd3fc");
assert.deepEqual(coloredHabit.config.habits[0].entries, [
  "2026-01-16",
  "2026-01-17"
]);
assert.equal(parser.serializeEntries([
  "2026-01-17",
  "2026-01-16",
  "2026-01-16",
  "2026-01-18"
]), "2026-01-16..2026-01-18");

const habitsBlock = `title: Life System
from: 2026-01-16
days: 21
theme: green

habits:
  - Exercise: 2026-01-16..2026-01-18, 2026-01-21
  - Vitamins: 23, 29..31, 2..3`;

const parsedBlock = parser.parseQuiddity(habitsBlock);
assert.equal(parsedBlock.sourceStyle, "habits-block");
assert.equal(parsedBlock.config.title, "Life System");
assert.deepEqual(parsedBlock.config.habits[1].entries, [
  "2026-01-23",
  "2026-01-29",
  "2026-01-30",
  "2026-01-31",
  "2026-02-02",
  "2026-02-03"
]);

const added = updater.toggleHabitDateInSource(habitsBlock, "Vitamins", "2026-02-04");
assert.match(added, / {2}- Vitamins: .*2026-02-02\.\.2026-02-04/);

const removed = updater.toggleHabitDateInSource(added, "Vitamins", "2026-01-30");
assert.match(removed, /2026-01-29, 2026-01-31/);
assert.match(removed, / {2}- Vitamins:/);

const compactAdded = updater.toggleHabitDateInSource(compact, "Exercise", "2026-01-19");
assert.match(compactAdded, /^Exercise: 2026-01-16\.\.2026-01-19/m);
assert.doesNotMatch(compactAdded, /^- Exercise:/m);

const blockAdded = updater.toggleHabitDateInSource(habitsBlock, "Exercise", "2026-01-22");
assert.match(blockAdded, /^ {2}- Exercise: 2026-01-16\.\.2026-01-18, 2026-01-21\.\.2026-01-22/m);

console.log("parser-updater tests passed");
