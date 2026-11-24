import { formatCell } from "@agent-crossing/world/cell";
import { isAquatic } from "@agent-crossing/world/components";
import { nounOf } from "@agent-crossing/world/entity";
import { groundKinds, traitsOf } from "@agent-crossing/world/ground";
import { kindDefaults, kindNames } from "@agent-crossing/world/kind";
import type { Rejection } from "@agent-crossing/world/rejection";
import * as Arr from "effect/Array";
import * as Match from "effect/Match";

const listed = (names: readonly string[]) => Arr.join(names, ", ");

const article = (noun: string) =>
  /^[aeiou]/u.test(noun) ? `an ${noun}` : `a ${noun}`;

const aquaticKinds = Arr.filter(kindNames, (kind) =>
  isAquatic(kindDefaults(kind))
);

const unlayeredKinds = Arr.filter(
  kindNames,
  (kind) => kindDefaults(kind).layer === undefined
);

const wetGround = Arr.filter(groundKinds, (kind) => traitsOf(kind).wet);

const dryGround = Arr.filter(groundKinds, (kind) => !traitsOf(kind).wet);

/** Why a command did nothing, and what would work instead. */
export const rejectionText = (rejection: Rejection) =>
  Match.value(rejection).pipe(
    Match.tagsExhaustive({
      LayerTaken: ({ cell, layer, occupant }) =>
        `The ${layer} layer of cell ${formatCell(cell)} is taken by ${occupant.id}, ${article(nounOf(occupant))} (${occupant.kind}). Each cell holds at most one thing per layer (object or cover). Choose another cell, or move or remove ${occupant.id} first. Things with no layer (${listed(unlayeredKinds)}) may share any cell.`,
      NoGround: ({ cell }) =>
        `Cell ${formatCell(cell)} has no ground, so it is outside the world. Choose a cell inside the world (world_summary gives its extent), or paint ground there first with paint_ground.`,
      UnknownEntity: ({ entity }) =>
        `There is no entity ${entity}: it may have been removed. find_entities and inspect_cell list the ids of what is there.`,
      UnsuitableGround: ({ cell, ground, needsWater }) =>
        needsWater
          ? `That is an aquatic thing, and cell ${formatCell(cell)} is ${traitsOf(ground).noun}, not water. Aquatic things go only on wet ground (${listed(wetGround)}): choose a water cell, or paint this one water first.`
          : `Cell ${formatCell(cell)} is ${traitsOf(ground).noun}, and only aquatic things (${listed(aquaticKinds)}) may stand on water. Choose dry ground (${listed(dryGround)}), or paint this cell first.`,
    })
  );
