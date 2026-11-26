import * as Arr from "effect/Array";

import { WorldEvent } from "../history/event.ts";
import { formatCell } from "../schema/cell.ts";
import { nounOf } from "../state/entity.ts";
import type { Entity } from "../state/entity.ts";
import { isFloor, isLiquid } from "../state/world.ts";
import { article, cellsWord, entitiesWord } from "./words.ts";

const painted = (floors: readonly (typeof Entity.Type)[]) => {
  const nouns = Arr.dedupe(Arr.map(floors, nounOf));
  const [only] = nouns;

  return nouns.length === 1
    ? `Painted ${cellsWord(floors.length)} with ${only}`
    : `Painted ${cellsWord(floors.length)}`;
};

const poured = (liquids: readonly (typeof Entity.Type)[]) => {
  const nouns = Arr.dedupe(Arr.map(liquids, nounOf));
  const [only] = nouns;

  return nouns.length === 1
    ? `Poured ${only} over ${cellsWord(liquids.length)}`
    : `Poured liquids over ${cellsWord(liquids.length)}`;
};

/** One sentence for the history log. */
export const eventText = (event: typeof WorldEvent.Type) =>
  WorldEvent.match(event, {
    Changed: ({ entity }) => `Changed ${entity}`,
    Moved: ({ entity, to }) => `Moved ${entity} to ${formatCell(to)}`,
    Removed: ({ entities }) =>
      entities.length === 1
        ? `Removed ${entities[0]}`
        : `Removed ${entitiesWord(entities.length)}`,
    Spawned: ({ entities }) => {
      if (Arr.every(entities, isFloor)) {
        return painted(entities);
      }

      if (Arr.every(entities, isLiquid)) {
        return poured(entities);
      }

      return entities.length === 1
        ? `Put ${article(nounOf(entities[0]))} at ${formatCell(entities[0].cell)}`
        : `Placed ${entitiesWord(entities.length)}`;
    },
    Updated: ({ entities }) => {
      if (Arr.every(entities, isFloor)) {
        return painted(entities);
      }

      return entities.length === 1
        ? `Changed ${entities[0].id}`
        : `Changed ${entitiesWord(entities.length)}`;
    },
  });
