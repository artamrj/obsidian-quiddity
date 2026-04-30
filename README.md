# Quiddity

Quiddity is an Obsidian plugin that renders one strict Markdown habit block as an interactive timeline. All habit data lives inside the fenced block.

````md
```quiddity
from: 2026-01-16
days: 21

habits:
  - Exercise: 2026-01-16, 2026-01-18..2026-01-20
  - Reading: 2026-01-16..2026-01-18, 2026-01-21
```
````

## Syntax

Quiddity intentionally supports one canonical format:

- `from` must be a full ISO date: `YYYY-MM-DD`.
- `days` must be a positive whole number.
- habits must be listed under `habits:`.
- entries must be full ISO dates or full ISO ranges: `YYYY-MM-DD` or `YYYY-MM-DD..YYYY-MM-DD`.

Old compact habit lines, `theme`, `title`, per-habit colors, day-only shortcuts, and `..+N` ranges are no longer supported.

## Development

```sh
npm install
npm run build
npm test
```

Enable the plugin from this folder inside your vault's `.obsidian/plugins/obsidian-quiddity` directory after building.
