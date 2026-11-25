import * as Arr from "effect/Array";

import { changesFor } from "../state/snapshot.ts";
import type { World } from "../state/world.ts";
import { FeedFrame } from "./frame.ts";

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
