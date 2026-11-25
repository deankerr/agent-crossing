import { prefabs } from "@agent-crossing/world/definitions/prefabs";
import { habitatOf } from "@agent-crossing/world/engine/rules/placement";
import type { Rejection } from "@agent-crossing/world/engine/rules/rejection";
import { nounOf } from "@agent-crossing/world/engine/state/entity";
import { formatCell } from "@agent-crossing/world/schema/cell";
import * as Arr from "effect/Array";
import * as Match from "effect/Match";

const listed = (names: readonly string[]) => Arr.join(names, ", ");

const article = (noun: string) =>
  /^[aeiou]/u.test(noun) ? `an ${noun}` : `a ${noun}`;

const namesWhere = (
  keep: (components: (typeof prefabs)[number]["components"]) => boolean
) =>
  Arr.map(
    Arr.filter(prefabs, (one) => keep(one.components)),
    (one) => one.name
  );

const unlayered = namesWhere((components) => components.layer === undefined);

const liquids = namesWhere((components) => components.layer === "liquid");

const waterDwellers = namesWhere(
  (components) =>
    components.layer !== "floor" &&
    components.layer !== "liquid" &&
    habitatOf(components).includes("water")
);

/** Why a command did nothing, and what would work instead. */
export const rejectionText = (rejection: typeof Rejection.Type) =>
  Match.value(rejection).pipe(
    Match.tagsExhaustive({
      LayerTaken: ({ cell, layer, occupant }) =>
        `The ${layer} layer of cell ${formatCell(cell)} is taken by ${occupant.id}, ${article(nounOf(occupant))} (${occupant.prefab}). Each cell holds at most one entity per layer (floor, liquid, cover or object). Choose another cell, or move or remove ${occupant.id} first; to change a floor, use paint_floor. Entities with no layer (${listed(unlayered)}) may share any cell.`,
      NoFloor: ({ cell }) =>
        `Cell ${formatCell(cell)} has no floor, so it is outside the world. Choose a cell inside the world (world_summary gives its extent), or lay a floor there first with paint_floor.`,
      UnknownEntity: ({ entity }) =>
        `There is no entity ${entity}: it may have been removed. find_entities and inspect_cell list the ids of what is there.`,
      UnsuitablePlace: ({ cell, habitat, place }) =>
        place === "water"
          ? `Cell ${formatCell(cell)} is water, and that entity's habitat is ${Arr.join(habitat, " and ")}. Only entities whose habitat includes water (${listed(waterDwellers)}) may be in water. Choose land, or remove the liquid (${listed(liquids)}) there first with remove_entities and a prefab.`
          : `Cell ${formatCell(cell)} is land, and that entity's habitat is ${Arr.join(habitat, " and ")}. Choose a water cell, or pour a liquid there first with pour_liquid.`,
    })
  );
