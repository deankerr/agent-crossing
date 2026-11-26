import * as Refusal from "@agent-crossing/world/Refusal";
import * as Schema from "effect/Schema";

import * as StreamFrame from "../StreamFrame.ts";

/** What the World object answers to a command. */
export const Verdict = Schema.TaggedUnion({
  /** The command's events, told in words with a map of what they touched. */
  Accepted: { text: Schema.String },
  Refused: { refusal: Refusal.Refusal },
});

/** What the World object's stream carries: its frames, and heartbeats that keep the call open. */
export const StreamItem = Schema.TaggedUnion({
  Frame: { frame: StreamFrame.StreamFrame },
  Heartbeat: {},
});
