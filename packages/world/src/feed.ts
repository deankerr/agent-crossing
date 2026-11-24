import * as Schema from "effect/Schema";

import { Change } from "./change.ts";
import { WorldEvent } from "./event.ts";

/** The position of an event in the world's history. */
export const Seq = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

export type Seq = typeof Seq.Type;

/**
 * Frames of the spectator stream. A viewer starts from the empty world on
 * `Reset`, applies each `Changes` batch, and once `Ready` arrives evolves its
 * world with every `Happened` event after `cursor`.
 */
export const FeedFrame = Schema.TaggedUnion({
  Reset: {},
  Changes: { changes: Schema.Array(Change) },
  Ready: { cursor: Seq },
  Happened: { seq: Seq, event: WorldEvent },
});

export type FeedFrame = typeof FeedFrame.Type;
