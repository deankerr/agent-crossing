import { World } from "@agent-crossing/world/world";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

import { Seq, Told } from "./journal.ts";

export const Snapshot = Schema.Struct({
  cursor: Seq,
  now: Schema.Int,
  world: World,
});

export type Snapshot = typeof Snapshot.Type;

const SnapshotJson = Schema.fromJsonString(Snapshot);

const WorldMessageJson = Schema.fromJsonString(Told);

const encodeSnapshot = Schema.encodeEffect(SnapshotJson);
const encodeWorldMessage = Schema.encodeEffect(WorldMessageJson);

export interface Message {
  readonly event: string;
  readonly id?: string | undefined;
  readonly data: string;
}

export const frame = ({ data, event, id }: Message) =>
  Arr.join(
    [
      `event: ${event}`,
      ...(id === undefined ? [] : [`id: ${id}`]),
      ...Arr.map(Str.split(data, /\r\n|\r|\n/u), (line) => `data: ${line}`),
      "",
      "",
    ],
    "\n"
  );

export const comment = (text: string) => `: ${text}\n\n`;

export const snapshotFrame = (snapshot: Snapshot) =>
  Effect.map(encodeSnapshot(snapshot), (data) =>
    frame({ data, event: "snapshot" })
  );

export const worldFrame = (told: Told) =>
  Effect.map(encodeWorldMessage(told), (data) =>
    frame({ data, event: "world", id: `${told.seq}` })
  );

const decodeCursor = Schema.decodeUnknownResult(
  Schema.FiniteFromString.pipe(Schema.decodeTo(Seq))
);

export const cursorFrom = (
  query: string | undefined,
  lastEventId: string | undefined
) => {
  const given = query ?? lastEventId;

  return given === undefined
    ? Result.succeed(Option.none<Seq>())
    : Result.mapBoth(decodeCursor(given), {
        onFailure: () => given,
        onSuccess: Option.some,
      });
};
