import * as Schema from "effect/Schema";

import * as Entity from "../Entity.ts";
import * as Event from "../Event.ts";

/**
 * Frames of the spectator stream. A spectator gathers the entities of every
 * `Entities` batch after `Reset`, builds its world from them once `Ready`
 * arrives, then applies every `Happened` event after `cursor`.
 */
export const FeedFrame = Schema.TaggedUnion({
  Reset: {},
  Entities: { entities: Schema.Array(Entity.Entity) },
  Ready: { cursor: Event.Seq },
  Happened: { seq: Event.Seq, event: Event.Event },
});
