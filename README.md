# Quiddity

Quiddity is an Obsidian plugin that turns one compact Markdown code block into an interactive habit timeline. All data lives inside the fenced block: no settings panel, no habit files, no generated config.

````md
```quiddity
title: Life System
from: 2026-01-16
days: 21
theme: violet

habits:
  - Exercise: 2026-01-16..2026-01-18, 2026-01-21, 2026-01-23
  - No Phone to Bed: 2026-01-16..2026-01-17, 2026-01-21..2026-01-23
  - OSS: 2026-01-24..2026-01-25, 2026-01-27, 2026-01-29..2026-02-05
```
````

Compact syntax is also supported:

````md
```quiddity
from: 2026-01-16
days: 21
theme: #a78bfa

Exercise: 16..18, 21, 23, 25, 27
OSS: 24..25, 27, 29..+8
```
````

## Development

```sh
npm install
npm run build
npm test
```

Enable the plugin from this folder inside your vault's `.obsidian/plugins/obsidian-quiddity` directory after building.
