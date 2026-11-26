# @agent-crossing/generator

A program outside the world that turns a seed and biomes into commands. It reads the world package only for its shapes and commands, and reaches the live world over MCP like any other caller. The words used here are defined in the [glossary](../../GLOSSARY.md).

## Layout

Each module is one file named for its noun, imported as a namespace. Nothing imports this package, so it exports nothing.

| Module | What it holds |
| --- | --- |
| `Biome` | The shape of a biome, `make` to write one and `weighted` for a choice between prefabs |
| `Biomes` | The biomes written in it, each by name, and `all` |
| `Landscape` | `entities`, a seeded landscape for a rectangle as the entities to place, and its `MIN_SIZE` and `MAX_SIZE` |

`src/internal` holds one file per biome and the seeded random numbers. The same seed always gives the same landscape.

A biome is a recipe for generating a region, and how often something appears is the biome's to say:

```ts
export const Meadow = Biome.make({
  name: "meadow",
  floor: Prefabs.Terrain.Meadow,
  grows: [
    [Flowers, 0.16],
    [Prefabs.Nature.TallGrass, 0.12],
    [Prefabs.Nature.Oak, 0.01],
  ],
  extras: [],
});
```

At most one entry of `grows` is placed per cell. Each entry of `extras` is rolled on its own and may share the cell. An entry is a prefab or a choice between prefabs, made with `Biome.weighted`.

## Generate a world

```sh
pnpm --filter @agent-crossing/generator generate <seed> <width> <height> [<x> <y>]
pnpm --filter @agent-crossing/generator generate 7 64 48          # from 0,0
pnpm --filter @agent-crossing/generator generate 7 64 48 -32 -24  # from -32,-24
```

Width and height are 8 to 256 cells; `x y` is the north-west corner, 0 0 if left out. The program computes the landscape, then calls the MCP tools: `clear_region` with the terrain removed over the rectangle, then `place_entities` in batches of at most `Command.PLACE_MAX_ENTITIES`, floors first, then liquids, then everything else, so each entity finds the floor or water it needs already there. Each tool's arguments are the encoded command without its `_tag`, and its name is the command's tag in snake case.

It prints one line per call and a final line, and exits 0 when done, 1 when a call was refused (the refusal is on stderr) and 2 on bad arguments or a failed call. It reads `AGENT_CROSSING_URL`, the Api's address, from the environment or the `.env` at the root of the repository.

Run the tests with `pnpm --filter @agent-crossing/generator test`.
