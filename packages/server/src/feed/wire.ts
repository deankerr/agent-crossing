import { WorldEvent } from "@agent-crossing/world/engine/editing/event";
import { FeedFrame } from "@agent-crossing/world/engine/feed";
import { Rejection } from "@agent-crossing/world/engine/rules/rejection";
import type { Entity } from "@agent-crossing/world/engine/state/entity";
import { changesFor } from "@agent-crossing/world/engine/state/snapshot";
import {
  entityOf,
  isFloor,
  isLiquid,
} from "@agent-crossing/world/engine/state/world";
import type { World } from "@agent-crossing/world/engine/state/world";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { Area } from "../admin/affected.ts";

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
 * floors count as erased cells, other removed entities as removed things.
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

/** What the World object answers to a command. */
export const Verdict = Schema.TaggedUnion({
  Accepted: {
    /** One sentence per event, in order. */
    sentences: Schema.Array(Schema.String),
    changes: Count,
    tally: Tally,
    /** The cells the edit touched, when it touched any. */
    edited: Schema.optionalKey(Area),
  },
  Rejected: { rejection: Rejection },
});

/** What the World object's feed carries: frames for spectators, and heartbeats that keep the call open. */
export const FeedItem = Schema.TaggedUnion({
  Frame: { frame: FeedFrame },
  Heartbeat: {},
});

/** No `Changes` frame carries more changes than this. */
export const FRAME_MAX_CHANGES = 1000;

/**
 * The frames that open a feed: `Reset`, the world as batches of changes from
 * the empty world, then `Ready` with the sequence number of the last event
 * the world includes.
 */
export const openingFrames = (world: World, cursor: number) => {
  const frames: readonly (typeof FeedFrame.Type)[] = [
    FeedFrame.cases.Reset.make({}),
    ...Arr.map(Arr.chunksOf(changesFor(world), FRAME_MAX_CHANGES), (changes) =>
      FeedFrame.cases.Changes.make({ changes })
    ),
    FeedFrame.cases.Ready.make({ cursor }),
  ];

  return frames;
};
