import * as Prefabs from "@agent-crossing/definitions/Prefabs";
import * as Cell from "@agent-crossing/world/Cell";
import * as Entity from "@agent-crossing/world/Entity";
import type * as Refusal from "@agent-crossing/world/Refusal";
import * as Arr from "effect/Array";
import * as Match from "effect/Match";

const listed = (names: readonly string[]) => Arr.join(names, ", ");

const article = (noun: string) =>
  /^[aeiou]/u.test(noun) ? `an ${noun}` : `a ${noun}`;

const namesWhere = (
  keep: (components: (typeof Prefabs.all)[number]["components"]) => boolean
) =>
  Arr.map(
    Arr.filter(Prefabs.all, (one) => keep(one.components)),
    (one) => one.name
  );

const unlayered = namesWhere((components) => components.layer === undefined);

const liquids = namesWhere((components) => components.layer === "liquid");

const waterDwellers = namesWhere(
  (components) =>
    components.layer !== "floor" &&
    components.layer !== "liquid" &&
    Entity.habitat(components).includes("water")
);

/** Why a command did nothing, and what would work instead. */
export const refusalText = (refusal: typeof Refusal.Refusal.Type) =>
  Match.value(refusal).pipe(
    Match.tagsExhaustive({
      LayerTaken: ({ cell, layer, occupant }) =>
        `The ${layer} layer of cell ${Cell.format(cell)} is taken by ${occupant.id}, ${article(Entity.components(occupant).label.noun)} (${occupant.prefab}). Each cell holds at most one entity per layer (floor, liquid, cover or object). Choose another cell, or move or remove ${occupant.id} first; to change a floor, use fill_region. Entities with no layer (${listed(unlayered)}) may share any cell.`,
      NoFloor: ({ cell }) =>
        `Cell ${Cell.format(cell)} has no floor, so it is outside the world. Choose a cell inside the world (world_summary gives its extent), or lay a floor there first with fill_region.`,
      UnknownEntity: ({ entity }) =>
        `There is no entity ${entity}: it may have been removed. find_entities and inspect_cell list the ids of what is there.`,
      UnsuitablePlace: ({ cell, habitat, place }) =>
        place === "water"
          ? `Cell ${Cell.format(cell)} is water, and that entity's habitat is ${Arr.join(habitat, " and ")}. Only entities whose habitat includes water (${listed(waterDwellers)}) may be in water. Choose land, or remove the liquid (${listed(liquids)}) there first with clear_region and that prefab.`
          : `Cell ${Cell.format(cell)} is land, and that entity's habitat is ${Arr.join(habitat, " and ")}. Choose a water cell, or put a liquid there first with fill_region.`,
    })
  );
