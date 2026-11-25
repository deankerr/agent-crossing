import * as Arr from "effect/Array";
import * as Record from "effect/Record";
import * as Schema from "effect/Schema";

import { Made } from "./made/index.ts";
import { Nature } from "./nature/index.ts";
import { Terrain } from "./terrain/index.ts";

export { Nature } from "./nature/index.ts";

export { Terrain } from "./terrain/index.ts";

const { FlowerPatches, ...single } = Nature;

/** Every prefab in the world, from every category. */
export const prefabs = [
  ...Record.values(Terrain),
  ...Record.values(single),
  ...Record.values(FlowerPatches),
  ...Record.values(Made),
];

/** The stored name of a prefab. */
export const PrefabName = Schema.Literals(Arr.map(prefabs, (one) => one.name));

/** Every prefab by its stored name. */
export const prefabsByName: ReadonlyMap<
  typeof PrefabName.Type,
  (typeof prefabs)[number]
> = new Map(Arr.map(prefabs, (one) => [one.name, one] as const));
