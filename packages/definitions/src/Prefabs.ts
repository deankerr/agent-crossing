import * as Arr from "effect/Array";
import * as Record from "effect/Record";
import * as Schema from "effect/Schema";

import { Made } from "./internal/made/index.ts";
import { Nature } from "./internal/nature/index.ts";
import { Terrain } from "./internal/terrain/index.ts";

export { Nature } from "./internal/nature/index.ts";

export { Terrain } from "./internal/terrain/index.ts";

const { FlowerPatches, ...single } = Nature;

/** Every prefab in the world, from every category. */
export const all = [
  ...Record.values(Terrain),
  ...Record.values(single),
  ...Record.values(FlowerPatches),
  ...Record.values(Made),
];

/** The stored name of a prefab. */
export const Name = Schema.Literals(Arr.map(all, (one) => one.name));

/** Every prefab by its stored name. */
export const byName: ReadonlyMap<typeof Name.Type, (typeof all)[number]> =
  new Map(Arr.map(all, (one) => [one.name, one] as const));
