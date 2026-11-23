import { WorldEvent } from "@agent-crossing/world/event";
import { Rejection } from "@agent-crossing/world/rejection";
import { Timestamp } from "@agent-crossing/world/values";
import { World } from "@agent-crossing/world/world";
import * as Schema from "effect/Schema";

import { Numbered, Seq } from "./journal.ts";

export const Verdict = Schema.TaggedUnion({
  Accepted: { events: Schema.Array(WorldEvent) },
  Rejected: { rejection: Rejection },
});

export type Verdict = typeof Verdict.Type;

export const CatchUp = Schema.Struct({
  nearby: Schema.Array(Numbered),
  world: World,
  now: Timestamp,
});

export type CatchUp = typeof CatchUp.Type;

export const Report = Schema.Struct({ verdict: Verdict, ...CatchUp.fields });

export type Report = typeof Report.Type;

export const StreamItem = Schema.TaggedUnion({
  Happened: { seq: Seq, event: WorldEvent },
  Heartbeat: {},
});

export type StreamItem = typeof StreamItem.Type;

export const heartbeat: StreamItem = StreamItem.cases.Heartbeat.make({});

export const StoredRow = Schema.Struct({
  seq: Seq,
  event: Schema.fromJsonString(WorldEvent),
});
