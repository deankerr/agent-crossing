import * as Schema from "effect/Schema";

import * as Change from "../Change.ts";
import * as Event from "../Event.ts";

/**
 * Frames of the spectator stream. A spectator starts from the empty world on
 * `Reset`, applies each `Changes` batch, and once `Ready` arrives evolves its
 * world with every `Happened` event after `cursor`.
 */
export const FeedFrame = Schema.TaggedUnion({
  Reset: {},
  Changes: { changes: Schema.Array(Change.Change) },
  Ready: { cursor: Event.Seq },
  Happened: { seq: Event.Seq, event: Event.Event },
});
