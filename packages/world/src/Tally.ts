import * as Arr from "effect/Array";
import * as Schema from "effect/Schema";

import * as Entity from "./Entity.ts";
import * as Event from "./Event.ts";

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/** How much an edit did, summed over its events. */
export const Tally = Schema.Struct({
  painted: Count,
  poured: Count,
  erased: Count,
  placed: Count,
  moved: Count,
  changed: Count,
  removed: Count,
});

type Counts = typeof Tally.Type;

export const none: Counts = {
  changed: 0,
  erased: 0,
  moved: 0,
  painted: 0,
  placed: 0,
  poured: 0,
  removed: 0,
};

type Present = typeof Entity.Entity.Type;

const countOf = (
  entities: readonly Present[],
  keep: (entity: Present) => boolean
) => Arr.filter(entities, keep).length;

const isOther = (entity: Present) =>
  !Entity.isFloor(entity) && !Entity.isLiquid(entity);

/**
 * The tally with one more event. Removed floors count as erased cells,
 * everything else removed as removed entities.
 */
export const tallied = (tally: Counts, event: typeof Event.Event.Type) =>
  Event.Event.match(event, {
    EntitiesChanged: ({ entities }) => ({
      ...tally,
      changed:
        tally.changed + countOf(entities, (entity) => !Entity.isFloor(entity)),
      painted: tally.painted + countOf(entities, Entity.isFloor),
    }),
    EntitiesPlaced: ({ entities }) => ({
      ...tally,
      painted: tally.painted + countOf(entities, Entity.isFloor),
      placed: tally.placed + countOf(entities, isOther),
      poured: tally.poured + countOf(entities, Entity.isLiquid),
    }),
    EntitiesRemoved: ({ entities }) => {
      const floors = countOf(entities, Entity.isFloor);

      return {
        ...tally,
        erased: tally.erased + floors,
        removed: tally.removed + entities.length - floors,
      };
    },
    EntityMoved: () => ({ ...tally, moved: tally.moved + 1 }),
  }) satisfies Counts;
