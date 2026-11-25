import * as Arr from "effect/Array";

import { formatCell } from "../../schema/cell.ts";
import { WorldEvent } from "../editing/event.ts";
import { nounOf } from "../state/entity.ts";
import type { Entity } from "../state/entity.ts";
import { isFloor, isLiquid } from "../state/world.ts";
import { article, cellsWord, thingsWord } from "./words.ts";

const painted = (by: string, floors: readonly (typeof Entity.Type)[]) => {
  const nouns = Arr.dedupe(Arr.map(floors, nounOf));
  const [only] = nouns;

  return nouns.length === 1
    ? `${by} painted ${cellsWord(floors.length)} with ${only}`
    : `${by} painted ${cellsWord(floors.length)}`;
};

const poured = (by: string, liquids: readonly (typeof Entity.Type)[]) => {
  const nouns = Arr.dedupe(Arr.map(liquids, nounOf));
  const [only] = nouns;

  return nouns.length === 1
    ? `${by} poured ${only} over ${cellsWord(liquids.length)}`
    : `${by} poured liquids over ${cellsWord(liquids.length)}`;
};

/** One sentence for the history log. */
export const eventText = (event: typeof WorldEvent.Type) =>
  WorldEvent.match(event, {
    Changed: ({ by, entity }) => `${by} changed ${entity}`,
    Moved: ({ by, entity, to }) => `${by} moved ${entity} to ${formatCell(to)}`,
    Removed: ({ by, entities }) =>
      entities.length === 1
        ? `${by} removed ${entities[0]}`
        : `${by} removed ${thingsWord(entities.length)}`,
    Spawned: ({ by, entities }) => {
      if (Arr.every(entities, isFloor)) {
        return painted(by, entities);
      }

      if (Arr.every(entities, isLiquid)) {
        return poured(by, entities);
      }

      return entities.length === 1
        ? `${by} put ${article(nounOf(entities[0]))} at ${formatCell(entities[0].cell)}`
        : `${by} placed ${thingsWord(entities.length)}`;
    },
    Updated: ({ by, entities }) => {
      if (Arr.every(entities, isFloor)) {
        return painted(by, entities);
      }

      return entities.length === 1
        ? `${by} changed ${entities[0].id}`
        : `${by} changed ${thingsWord(entities.length)}`;
    },
  });
