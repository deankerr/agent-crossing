# @agent-crossing/world

What the world is made of and the rules it follows. Everything here is pure and deterministic: no I/O, no clock, no unseeded randomness. Time and editor names arrive as arguments, and every type that crosses a boundary is an Effect `Schema` that encodes to JSON.

The words used below are defined in the [glossary](../../GLOSSARY.md).

Run the tests with `pnpm --filter @agent-crossing/world test`.

## Layout

| Folder | What it holds |
| --- | --- |
| `src/schema` | The vocabulary definitions are written in: cells, levels, components, models, prefabs, the palette |
| `src/definitions` | The authored world, as data only: one file per prefab and one file per biome |
| `src/state` | What exists: entities, the in-memory world with its queries, changes, snapshots, spans and areas |
| `src/rules` | What may exist: whether an entity may be in a cell, and the reasons a command is refused |
| `src/history` | What happened: events with their editor, time and sequence number, the changes each amounts to, and the tally of an edit |
| `src/editing` | The editor's verbs: regions, commands and `decide` |
| `src/generation` | The seeded landscape generator, which lays out biomes |
| `src/text` | The world in words: a map, the view from a cell, one cell, a summary, found entities, the history and the prefabs |
| `src/feed` | What a spectator receives: the frames of the stream and the frames that open it |

Imports point one way: everything else reads the definitions, and definitions are written in the schema. Definitions hold no rules, no randomness and nothing that acts, so they read as a contract for the rest of the code.

Events are kept apart from commands because they outlive them: a command is one editor's way of asking, and an event is what the world remembers, whoever asked.

The text here describes the world and never names a tool. Advice about which admin tool to use next belongs to the host's admin tools.

The palette sits in the schema because shades are words that models are written in, like the color words beside it.

Other packages import `@agent-crossing/world/schema/*`, `/definitions/prefabs`, `/definitions/biomes`, `/state/*`, `/rules/*`, `/history/*`, `/editing/*`, `/generation/*`, `/text/*` and `/feed/*`.

## How the world is described

**Everything is an entity.** There is no separate ground. Grass is an entity that fills the floor layer of its cell, and water is an entity that fills the liquid layer over a floor. A pond is a sand or dirt floor with water over it.

**The world has no size.** A cell is in the world when it has a floor, so the world is whatever shape has been painted.

**An entity is a prefab, a cell and whatever differs.** Its effective components are its prefab's, overlaid by its own. Any component can be overridden on any entity. Rules and renderers ask about components and never about prefab names.

**Components are a closed set:**

| Component | What it says |
| --- | --- |
| `label` | What an agent calls the entity, and its glyph on a text map |
| `layer` | The slot of its cell it fills: `floor`, `liquid`, `cover` or `object` |
| `habitat` | The places it can be: `land`, `water` or both. Land when not stated |
| `obstacle` | Its cell cannot be walked on |
| `model` | The named parts it is drawn from |
| `colors` | Shades it gives to named parts of its model, in place of the model's own |
| `text` | Writing on it, as on a sign |
| `level` | Its vertical step. Stored by floors and liquids; everything standing on them derives |

**What can be derived is not stored.** Land and water are read from what fills a cell. An oak has no level of its own: it stands at the level of its floor, or of the liquid over it.

**Placing follows three rules.** Anything but a floor needs a floor under it. Anything but a floor or liquid needs the place to be in its habitat. An entity with a layer needs that layer to be free in its cell; an entity without one shares freely.

## Definitions

A prefab is one file under its category folder, `terrain`, `nature` or `made`:

```ts
export const Oak = prefab("oak", {
  label: { glyph: "T", noun: "oak tree" },
  layer: "object",
  habitat: ["land"],
  obstacle: true,
  model: {
    parts: [
      {
        name: "trunk",
        shade: "bark",
        forms: [
          { solid: { cylinder: [0.08, 0.12, 0.7, 6] }, at: [0, 0.35, 0] },
        ],
      },
      {
        name: "crown",
        shade: "leaf",
        forms: [
          { solid: { ball: [0.42, 0] }, at: [0, 1, 0] },
          { solid: { ball: [0.28, 0] }, at: [0.14, 1.3, 0.06], tone: 1.12 },
        ],
      },
    ],
    pose: "nature",
  },
});
```

**A model is named parts.** Each part has one shade and one or more forms, and a form is a solid with an optional position, turn, scale and tone. An entity has no single color. Its `colors` component names a part and the shade to give it.

**A shade is an entry of the palette** with the value the spectator view paints and a plain color word, so that bark can be described to an agent as brown.

**Related prefabs are a plain record.** `flower-patch.ts` builds seven complete prefabs from one unexported base and exports them as `FlowerPatches`. There is no "variant" concept.

A biome is a recipe for generating an area, and how often something appears is the biome's to say:

```ts
export const Meadow = biome({
  name: "meadow",
  floor: Terrain.Meadow,
  grows: [
    [Flowers, 0.16],
    [Nature.TallGrass, 0.12],
    [Nature.Oak, 0.01],
  ],
  extras: [],
});
```

At most one entry of `grows` is placed per cell. Each entry of `extras` is rolled on its own and may share the cell. An entry is a prefab or a choice between prefabs, made with `weighted` or `anyOf`.

**To add a prefab:** write its file, add it to its category's `index.ts`, and add it to a biome if it should generate. The stored prefab names, the admin tools and the spectator view all follow from the index.

## How an edit happens

An edit takes one path. `decide` turns a command into events or a refusal, `changesOf` turns an event into the smallest writes to state, and `apply` is the only function that changes a world. The host stores the same changes as rows and keeps the events as the world's history.

After any edit, `decide` also removes the entities that no longer fit where they are, such as an oak whose floor was erased.

## Design principles

- **Built for a long life.** The world has to cope with growing over time from the start, so its initial size is never what we optimize.
- **Four forms of everything.** Each entity is thought about as stored, in memory, drawn, and described to an agent.
- **Entities and components for flexibility, not speed.** The aim is a world that can change shape over time, eventually without code changes.
- **Describe properties carefully and let behavior emerge.** We choose the description well now and add behavior later.
- **Definitions are a contract.** They are data, kept apart from rules and actions.
- **Simplest shape first.** A plain record before a new concept, and each fact kept where it belongs: a prefab's chance of appearing is a property of the biome.
- **Any component, on any entity.** Naming a rock should be nearly free. Who is allowed to change a component is a rule for actions, not for the data.
- **A character is an entity that is being controlled.** An agent's character and a rock share most of their data.
- **An agent can read what a spectator sees.** Models and colors live in the definitions so that an agent can one day remark on the red of a mushroom cap.
- **The world can always be read as text.** Whoever edits it, person or agent, can check their work as an agent would see it.
- **Stored data is disposable for now.** We drop the world rather than migrate it.

## Deferred

These came up while designing the package and were set aside on purpose.

| Idea | Where we left it |
| --- | --- |
| Characters and agents in the world | Left out until the world itself is solid |
| Holding, as a vase on a table or an agent on furniture | Probably its own action and its own description, as in Animal Crossing |
| Bridges, second floors, walking underneath, digging holes | The floor layer leaves room for it; nothing is built |
| Flying and floating, and leaving the edge of the world | An entity resting on nothing may store its own level; nothing is built |
| Fish, plants on a pond bed, water depth | Today's model is enough for a simple pond |
| Obstacle as more than yes or no | Kept binary, known to be too simple |
| Appearance described to agents | The data is in place; no text is produced from it |
| A name on any entity, shown as a floating badge | There is no name component yet |
| Who may change which component | Belongs with commands and actions |
| Prefabs defined as stored data, without a code change | Prefabs stay in code for now |
| Caching the levels of a region | Only if deriving them becomes slow |
| Grouping related prefabs beyond a plain record | Flower patches are the only case so far |
| A wider test suite | Tests are few on purpose while the design is moving |

## Tests

Three small files: every definition parses and is named once, generation is a pure function of its seed, and a run of random commands keeps the world's invariants.
