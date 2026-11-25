import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import type { Entity } from "../state/entity.ts";
import { entityOf, isFloor, isLiquid } from "../state/world.ts";
import type { World } from "../state/world.ts";
import { WorldEvent } from "./event.ts";

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

export const noTally: Counts = {
  changed: 0,
  erased: 0,
  moved: 0,
  painted: 0,
  placed: 0,
  poured: 0,
  removed: 0,
};

const countOf = (
  entities: readonly (typeof Entity.Type)[],
  keep: (entity: typeof Entity.Type) => boolean
) => Arr.filter(entities, keep).length;

const isOther = (entity: typeof Entity.Type) =>
  !isFloor(entity) && !isLiquid(entity);

/**
 * The tally with one more event, given the world it happens to. Removed
 * floors count as erased cells, everything else removed as removed entities.
 */
export const tallied = (
  tally: Counts,
  world: World,
  event: typeof WorldEvent.Type
) =>
  WorldEvent.match(event, {
    Changed: () => ({ ...tally, changed: tally.changed + 1 }),
    Moved: () => ({ ...tally, moved: tally.moved + 1 }),
    Removed: ({ entities }) => {
      const floors = Arr.filter(entities, (id) =>
        Option.exists(entityOf(world, id), isFloor)
      ).length;

      return {
        ...tally,
        erased: tally.erased + floors,
        removed: tally.removed + entities.length - floors,
      };
    },
    Spawned: ({ entities }) => ({
      ...tally,
      painted: tally.painted + countOf(entities, isFloor),
      placed: tally.placed + countOf(entities, isOther),
      poured: tally.poured + countOf(entities, isLiquid),
    }),
    Updated: ({ entities }) => ({
      ...tally,
      changed: tally.changed + countOf(entities, (entity) => !isFloor(entity)),
      painted: tally.painted + countOf(entities, isFloor),
    }),
  }) satisfies Counts;
