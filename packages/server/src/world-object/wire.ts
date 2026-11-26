import { FeedFrame } from "@agent-crossing/world/feed/frame";
import * as Refusal from "@agent-crossing/world/Refusal";
import * as Span from "@agent-crossing/world/Span";
import * as Tally from "@agent-crossing/world/Tally";
import * as Schema from "effect/Schema";

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/** What the World object answers to a command. */
export const Verdict = Schema.TaggedUnion({
  Accepted: {
    /** One sentence per event, in order. */
    sentences: Schema.Array(Schema.String),
    changes: Count,
    tally: Tally.Tally,
    /** The cells the edit touched, when it touched any. */
    edited: Schema.optionalKey(Span.Area),
  },
  Rejected: { rejection: Refusal.Refusal },
});

/** What the World object's feed carries: frames for spectators, and heartbeats that keep the call open. */
export const FeedItem = Schema.TaggedUnion({
  Frame: { frame: FeedFrame },
  Heartbeat: {},
});
