import { tilesOf } from "@agent-crossing/world/event";
import type { WorldEvent } from "@agent-crossing/world/event";
import { evolve } from "@agent-crossing/world/evolve";
import { centre } from "@agent-crossing/world/grid";
import type { Username } from "@agent-crossing/world/values";
import type { Character, World } from "@agent-crossing/world/world";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

import { clockOffset, serverTime } from "./clock.ts";
import type { Connection, FeedMessage } from "./feed.ts";
import { sentenceFor } from "./sentence.ts";

export const LOG_LIMIT = 300;
export const SPEECH_MILLIS = 6000;
export const POP_MILLIS = 450;

export interface LogEntry {
  readonly key: string;
  readonly seq: number;
  readonly event: WorldEvent;
  readonly sentence: string;
}

export interface Synced {
  readonly world: World;
  readonly cursor: number;
  readonly clockOffset: number;
  readonly generation: number;
}

export interface ViewerState {
  readonly connection: Connection;
  readonly synced: Option.Option<Synced>;
  readonly log: readonly LogEntry[];
}

export const initialState = (connection: Connection) => {
  const state: ViewerState = { connection, log: [], synced: Option.none() };

  return state;
};

export const withConnection = (state: ViewerState, connection: Connection) =>
  ({ ...state, connection }) satisfies ViewerState;

const applied = (
  state: ViewerState,
  synced: Synced,
  seq: number,
  event: WorldEvent
) => {
  if (seq <= synced.cursor) {
    return state;
  }

  const entry: LogEntry = {
    event,
    key: `${synced.generation}:${seq}`,
    sentence: sentenceFor(event, synced.world),
    seq,
  };

  const next: ViewerState = {
    ...state,
    log: Arr.takeRight(Arr.append(state.log, entry), LOG_LIMIT),
    synced: Option.some({
      ...synced,
      cursor: seq,
      world: evolve(synced.world, event),
    }),
  };

  return next;
};

export const receive = (
  state: ViewerState,
  message: FeedMessage,
  localNow: number
) => {
  const next: ViewerState =
    message._tag === "Snapshot"
      ? {
          ...state,
          synced: Option.some({
            clockOffset: clockOffset(message.now, localNow),
            cursor: message.cursor,
            generation: Option.match(state.synced, {
              onNone: () => 0,
              onSome: (synced) => synced.generation + 1,
            }),
            world: message.world,
          }),
        }
      : Option.match(state.synced, {
          onNone: () => state,
          onSome: (synced) =>
            applied(state, synced, message.seq, message.event),
        });

  return next;
};

export const serverNowOf = (synced: Synced, localNow: number) =>
  serverTime(synced.clockOffset, localNow);

const latestBy = <A extends WorldEvent>(
  log: readonly LogEntry[],
  matches: (event: WorldEvent) => event is A
) =>
  Arr.findLast(log, (entry) => matches(entry.event)).pipe(
    Option.flatMap((entry) =>
      matches(entry.event) ? Option.some(entry.event) : Option.none<A>()
    )
  );

type Said = Extract<WorldEvent, { readonly _tag: "Said" }>;

type PresenceChange = Extract<
  WorldEvent,
  { readonly _tag: "Appeared" | "Vanished" }
>;

const saidBy =
  (username: Username) =>
  (event: WorldEvent): event is Said =>
    event._tag === "Said" && event.actor === username;

const presenceChangeOf =
  (username: Username) =>
  (event: WorldEvent): event is PresenceChange =>
    (event._tag === "Appeared" || event._tag === "Vanished") &&
    event.actor === username;

export const lastSaid = (log: readonly LogEntry[], username: Username) =>
  latestBy(log, saidBy(username));

export const speechAt = (
  log: readonly LogEntry[],
  username: Username,
  serverNow: number
) =>
  lastSaid(log, username).pipe(
    Option.filter(
      (said) => serverNow >= said.at && serverNow - said.at < SPEECH_MILLIS
    )
  );

const easeOutBack = (t: number) => {
  const overshoot = 1.7;
  const shifted = t - 1;

  return 1 + (overshoot + 1) * shifted ** 3 + overshoot * shifted ** 2;
};

const shareOf = (since: number, serverNow: number) =>
  Math.min(1, Math.max(0, (serverNow - since) / POP_MILLIS));

export const presenceScale = (
  character: Character,
  log: readonly LogEntry[],
  serverNow: number
) =>
  Option.match(latestBy(log, presenceChangeOf(character.username)), {
    onNone: () => (character.present ? 1 : 0),
    onSome: (change) => {
      if (character.present) {
        return change._tag === "Appeared"
          ? easeOutBack(shareOf(change.at, serverNow))
          : 1;
      }

      return change._tag === "Vanished"
        ? 1 - shareOf(change.at, serverNow) ** 2
        : 0;
    },
  });

export const isShown = (character: Character, log: readonly LogEntry[]) =>
  character.present ||
  Arr.some(
    log,
    (entry) =>
      entry.event._tag === "Vanished" &&
      entry.event.actor === character.username
  );

export const focusTileOf = (event: WorldEvent) =>
  Option.getOrElse(Arr.last(tilesOf(event)), () => centre);
