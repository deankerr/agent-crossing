import { WorldEvent } from "@agent-crossing/world/event";
import { FeedFrame } from "@agent-crossing/world/feed";
import { Rejection } from "@agent-crossing/world/rejection";
import { changesFor } from "@agent-crossing/world/snapshot";
import type { World } from "@agent-crossing/world/world";
import * as Arr from "effect/Array";
import * as Schema from "effect/Schema";

import { Area } from "./affected.ts";

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/** How much an edit did, summed over its events. */
export const Tally = Schema.Struct({
  painted: Count,
  erased: Count,
  placed: Count,
  moved: Count,
  changed: Count,
  removed: Count,
});

export type Tally = typeof Tally.Type;

const noTally: Tally = {
  changed: 0,
  erased: 0,
  moved: 0,
  painted: 0,
  placed: 0,
  removed: 0,
};

const tallied = (tally: Tally, event: WorldEvent) =>
  WorldEvent.match(event, {
    Changed: () => ({ ...tally, changed: tally.changed + 1 }),
    GroundErased: ({ cells }) => ({
      ...tally,
      erased: tally.erased + cells.length,
    }),
    GroundPainted: ({ tiles }) => ({
      ...tally,
      painted: tally.painted + tiles.length,
    }),
    Moved: () => ({ ...tally, moved: tally.moved + 1 }),
    Removed: ({ entities }) => ({
      ...tally,
      removed: tally.removed + entities.length,
    }),
    Spawned: ({ entities }) => ({
      ...tally,
      placed: tally.placed + entities.length,
    }),
  });

export const tallyOf = (events: readonly WorldEvent[]) =>
  Arr.reduce(events, noTally, tallied);

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

export type Verdict = typeof Verdict.Type;

/** What the World object's feed carries: frames for spectators, and heartbeats that keep the call open. */
export const FeedItem = Schema.TaggedUnion({
  Frame: { frame: FeedFrame },
  Heartbeat: {},
});

export type FeedItem = typeof FeedItem.Type;

/** No `Changes` frame carries more changes than this. */
export const FRAME_MAX_CHANGES = 1000;

/**
 * The frames that open a feed: `Reset`, the world as batches of changes from
 * the empty world, then `Ready` with the sequence number of the last event
 * the world includes.
 */
export const openingFrames = (world: World, cursor: number) => {
  const frames: readonly FeedFrame[] = [
    FeedFrame.cases.Reset.make({}),
    ...Arr.map(Arr.chunksOf(changesFor(world), FRAME_MAX_CHANGES), (changes) =>
      FeedFrame.cases.Changes.make({ changes })
    ),
    FeedFrame.cases.Ready.make({ cursor }),
  ];

  return frames;
};
