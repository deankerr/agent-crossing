import { WorldEvent } from "@agent-crossing/world/event";
import { Timestamp } from "@agent-crossing/world/values";
import { World } from "@agent-crossing/world/world";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

export const SNAPSHOT_FRAME = "snapshot";
export const WORLD_FRAME = "world";

export interface Frame {
  readonly event: string;
  readonly data: string;
}

const snapshotFields = { cursor: Schema.Int, now: Timestamp, world: World };
const appliedFields = { event: WorldEvent, seq: Schema.Int };

export const FeedMessage = Schema.TaggedUnion({
  Applied: appliedFields,
  Snapshot: snapshotFields,
});

export type FeedMessage = typeof FeedMessage.Type;

const SnapshotBody = Schema.Struct(snapshotFields);
const AppliedBody = Schema.Struct(appliedFields);

export type SnapshotBody = typeof SnapshotBody.Type;

export type AppliedBody = typeof AppliedBody.Type;

const SnapshotJson = Schema.fromJsonString(SnapshotBody);
const AppliedJson = Schema.fromJsonString(AppliedBody);

const decodeSnapshotJson = Schema.decodeUnknownResult(SnapshotJson);
const decodeAppliedJson = Schema.decodeUnknownResult(AppliedJson);
const encodeSnapshotJson = Schema.encodeResult(SnapshotJson);
const encodeAppliedJson = Schema.encodeResult(AppliedJson);

export class UnknownFrame extends Schema.TaggedError<
  UnknownFrame,
  { readonly brand: unique symbol }
>()("UnknownFrame", { event: Schema.String }) {}

type Decoded = Result.Result<FeedMessage, Schema.SchemaError | UnknownFrame>;

export const decodeFrame = (frame: Frame) => {
  if (frame.event === SNAPSHOT_FRAME) {
    const snapshot: Decoded = Result.map(
      decodeSnapshotJson(frame.data),
      (body) => FeedMessage.cases.Snapshot.make(body)
    );

    return snapshot;
  }

  if (frame.event === WORLD_FRAME) {
    const applied: Decoded = Result.map(decodeAppliedJson(frame.data), (body) =>
      FeedMessage.cases.Applied.make(body)
    );

    return applied;
  }

  const unknown: Decoded = Result.fail(
    new UnknownFrame({ event: frame.event })
  );

  return unknown;
};

const toFrame = (event: string) => (data: string) =>
  ({ data, event }) satisfies Frame;

export const snapshotFrame = (body: SnapshotBody) =>
  Result.map(encodeSnapshotJson(body), toFrame(SNAPSHOT_FRAME));

export const worldFrame = (body: AppliedBody) =>
  Result.map(encodeAppliedJson(body), toFrame(WORLD_FRAME));

export type Connection = "connecting" | "live" | "reconnecting" | "demo";

export interface FeedListener {
  readonly onFrame: (frame: Frame) => void;
  readonly onConnection: (connection: Connection) => void;
}

export type WorldFeed = (listener: FeedListener) => () => void;
