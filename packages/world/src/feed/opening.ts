import * as Arr from "effect/Array";

import * as World from "../World.ts";
import { FeedFrame } from "./frame.ts";

const FRAME_MAX_ENTITIES = 1000;

/**
 * The frames that open a feed: `Reset`, the world's entities in batches,
 * oldest first, then `Ready` with the sequence number of the last event the
 * world includes.
 */
export const openingFrames = (world: World.World, cursor: number) => {
  const frames: readonly (typeof FeedFrame.Type)[] = [
    FeedFrame.cases.Reset.make({}),
    ...Arr.map(
      Arr.chunksOf(World.entities(world), FRAME_MAX_ENTITIES),
      (entities) => FeedFrame.cases.Entities.make({ entities })
    ),
    FeedFrame.cases.Ready.make({ cursor }),
  ];

  return frames;
};
