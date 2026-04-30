# Quiddity

Quiddity is an Obsidian plugin that renders one TOML habit block as an interactive timeline. All habit data lives inside the fenced block.

````md
```quiddity
from = 2026-01-16
days = 21

habits = [
  ["Exercise", ["2026-01-16", "2026-01-18..2026-01-20"]],
  ["Reading", ["2026-01-16..2026-01-18", "2026-01-21"]],
]
```
````

## Syntax

Quiddity intentionally supports one TOML format:

- `from` must be a TOML local date or a string in `YYYY-MM-DD` format.
- `days` must be a positive integer.
- `habits` must be an array of `[name, entries]` pairs.
- habit names must be strings.
- entries must be strings using `YYYY-MM-DD` or `YYYY-MM-DD..YYYY-MM-DD`.

Old `from:`, `days:`, and `habits:` syntax is no longer supported.

## Development

```sh
npm install
npm run build
npm test
```

Enable the plugin from this folder inside your vault's `.obsidian/plugins/obsidian-quiddity` directory after building.
