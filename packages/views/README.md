# @agent-crossing/views

The world in words: pure functions from the world, or from its events, to text. An agent reads the world through these views, and the spectator page shows some of them too. The words used here are defined in the [glossary](../../GLOSSARY.md).

## Layout

Each public module is one file named for what it shows, imported as a namespace: `import * as View from "@agent-crossing/views/View"`. The package exports only the modules that `server` and `web` read.

| Module | What it holds |
| --- | --- |
| `View` | What can be asked to see of the world, as a tagged union like `Command`, and `text`, which renders any view from the world, the latest events and the event count; `eventsNeeded` says how many events a view needs |
| `SummaryView` | The world in a few lines: its extent, floors, water and entity counts |
| `CellView` | One cell's floor, any liquid and every other entity with its components |
| `EventText` | One event as a sentence |
| `ReplyView` | The reply to an accepted command: what its events did, where, and the map of that rectangle |

`src/internal` holds the views that only `View` renders (`map-view.ts`, `entity-list-view.ts`, `history-view.ts`, `prefab-list-view.ts`), the shared wording and the totals of a command's events; no other package imports it.

Imports point one way: views read `world` and `definitions`, and `server` and `web` read views. No text here names an MCP tool; advice about which tool to use belongs to the server.
