import { FeedFrame } from "@agent-crossing/world/feed/frame";
import { Tally } from "@agent-crossing/world/history/tally";
import { Rejection } from "@agent-crossing/world/rules/rejection";
import { Area } from "@agent-crossing/world/state/area";
import * as Schema from "effect/Schema";

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

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
