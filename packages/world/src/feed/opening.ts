import * as Arr from "effect/Array";

import * as World from "../World.ts";
import { FeedFrame } from "./frame.ts";

const FRAME_MAX_CHANGES = 1000;

/**
 * The frames that open a feed: `Reset`, the world as batches of changes from
 * the empty world, then `Ready` with the sequence number of the last event
 * the world includes.
 */
export const openingFrames = (world: World.World, cursor: number) => {
  const frames: readonly (typeof FeedFrame.Type)[] = [
    FeedFrame.cases.Reset.make({}),
    ...Arr.map(
      Arr.chunksOf(World.changesFor(world), FRAME_MAX_CHANGES),
      (changes) => FeedFrame.cases.Changes.make({ changes })
    ),
    FeedFrame.cases.Ready.make({ cursor }),
  ];

  return frames;
};
