import * as Prefabs from "@agent-crossing/definitions/Prefabs";
import * as Arr from "effect/Array";

import { habitatOf } from "../rules/placement.ts";

const prefabLine = ({ components, name }: (typeof Prefabs.all)[number]) => {
  const { label, layer } = components;

  const parts = Arr.filter(
    [
      `"${label.noun}"`,
      layer === undefined ? "no layer" : `layer ${layer}`,
      layer === "floor" || layer === "liquid"
        ? ""
        : `habitat ${Arr.join(habitatOf(components), " and ")}`,
      components.obstacle === true ? "obstacle" : "",
    ],
    (part) => part !== ""
  );

  return `${label.glyph} ${name}: ${Arr.join(parts, ", ")}`;
};

/** Every prefab with its glyph, label, layer and habitat. */
export const prefabsText = () =>
  Arr.join(
    [
      "Prefabs (glyph, name: label, layer, habitat). A cell holds at most one entity per layer (floor, liquid, cover, object); entities with no layer share freely. A floor puts a cell in the world, and a liquid over it makes the place water instead of land. An entity may be only where its habitat allows. Any component can be overridden per entity, for example colors or text.",
      ...Arr.map(Prefabs.all, prefabLine),
    ],
    "\n"
  );
