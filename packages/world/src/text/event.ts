import * as Arr from "effect/Array";

import * as Cell from "../Cell.ts";
import * as Entity from "../Entity.ts";
import * as Event from "../Event.ts";
import { article, cellsWord, entitiesWord } from "./words.ts";

const painted = (floors: readonly (typeof Entity.Entity.Type)[]) => {
  const nouns = Arr.dedupe(Arr.map(floors, Entity.nounOf));
  const [only] = nouns;

  return nouns.length === 1
    ? `Painted ${cellsWord(floors.length)} with ${only}`
    : `Painted ${cellsWord(floors.length)}`;
};

const poured = (liquids: readonly (typeof Entity.Entity.Type)[]) => {
  const nouns = Arr.dedupe(Arr.map(liquids, Entity.nounOf));
  const [only] = nouns;

  return nouns.length === 1
    ? `Poured ${only} over ${cellsWord(liquids.length)}`
    : `Poured liquids over ${cellsWord(liquids.length)}`;
};

/** One sentence for the history log. */
export const eventText = (event: typeof Event.Event.Type) =>
  Event.Event.match(event, {
    Changed: ({ entity }) => `Changed ${entity}`,
    Moved: ({ entity, to }) => `Moved ${entity} to ${Cell.format(to)}`,
    Removed: ({ entities }) =>
      entities.length === 1
        ? `Removed ${entities[0]}`
        : `Removed ${entitiesWord(entities.length)}`,
    Spawned: ({ entities }) => {
      if (Arr.every(entities, Entity.isFloor)) {
        return painted(entities);
      }

      if (Arr.every(entities, Entity.isLiquid)) {
        return poured(entities);
      }

      return entities.length === 1
        ? `Put ${article(Entity.nounOf(entities[0]))} at ${Cell.format(entities[0].cell)}`
        : `Placed ${entitiesWord(entities.length)}`;
    },
    Updated: ({ entities }) => {
      if (Arr.every(entities, Entity.isFloor)) {
        return painted(entities);
      }

      return entities.length === 1
        ? `Changed ${entities[0].id}`
        : `Changed ${entitiesWord(entities.length)}`;
    },
  });
