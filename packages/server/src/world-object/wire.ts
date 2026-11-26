import { FeedFrame } from "@agent-crossing/world/feed/frame";
import * as Refusal from "@agent-crossing/world/Refusal";
import * as Schema from "effect/Schema";

/** What the World object answers to a command. */
export const Verdict = Schema.TaggedUnion({
  /** The command's events, told in words with a map of what they touched. */
  Accepted: { text: Schema.String },
  Refused: { refusal: Refusal.Refusal },
});

/** What the World object's feed carries: frames for spectators, and heartbeats that keep the call open. */
export const FeedItem = Schema.TaggedUnion({
  Frame: { frame: FeedFrame },
  Heartbeat: {},
});
