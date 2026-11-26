# @agent-crossing/views

The world in words: pure functions from the world, or from its events, to text. An agent reads the world through these views, and the spectator page shows some of them too. The words used here are defined in the [glossary](../../GLOSSARY.md).

## Layout

Each public module is one file named for its view, imported as a namespace: `import * as MapView from "@agent-crossing/views/MapView"`.

| Module | What it holds |
| --- | --- |
| `MapView` | The map of a rectangle: a glyph map, a level map of the same cells and a legend |
| `SummaryView` | The world in a few lines: its extent, floors, water and entity counts |
| `CellView` | One cell's floor, any liquid and every other entity with its components |
| `EntityListView` | A list of entities in a region or the whole world, with its limits |
| `HistoryView` | The latest events, one line each, with its limits |
| `PrefabListView` | Every prefab with its glyph, label, layer and habitat |
| `EventText` | One event as a sentence |
| `ReplyView` | The reply to an accepted command: what its events did, where, and the map of that area |

`src/internal` holds the shared wording and the totals of a command's events; no other package imports it.

Imports point one way: views read `world` and `definitions`, and `server` and `web` read views. No text here names an MCP tool; advice about which tool to use belongs to the server.
