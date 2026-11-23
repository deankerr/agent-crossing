import type { WorldEvent } from "@agent-crossing/world/event";
import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

import { FeedMessage } from "../src/feed.ts";
import {
  initialState,
  LOG_LIMIT,
  POP_MILLIS,
  presenceScale,
  receive,
  speechAt,
  SPEECH_MILLIS,
} from "../src/viewer-state.ts";
import type { ViewerState } from "../src/viewer-state.ts";
import {
  alice,
  appeared,
  bob,
  createdBlock,
  meadow,
  said,
  vanished,
} from "./world.fixture.ts";

const snapshot = (cursor: number, now: number) =>
  FeedMessage.cases.Snapshot.make({ cursor, now, world: meadow });

const applied = (seq: number, event: WorldEvent) =>
  FeedMessage.cases.Applied.make({ event, seq });

const syncedOf = (state: ViewerState) => Option.getOrThrow(state.synced);

describe(receive, () => {
  it("takes the clock offset from the snapshot", () => {
    const state = receive(initialState("live"), snapshot(10, 5000), 3000);

    expect(syncedOf(state)).toMatchObject({
      clockOffset: 2000,
      cursor: 10,
      generation: 0,
    });
  });

  it("ignores events before the first snapshot", () => {
    const state = receive(
      initialState("live"),
      applied(1, said(alice, "hi")),
      0
    );

    expect(state).toStrictEqual(initialState("live"));
  });

  it("applies later events and logs them in plain language", () => {
    const state = Arr.reduce(
      [
        snapshot(10, 0),
        applied(11, said(alice, "Hello")),
        applied(12, createdBlock(2, 13, 9)),
      ],
      initialState("live"),
      (sofar, message) => receive(sofar, message, 0)
    );

    expect(syncedOf(state).cursor).toBe(12);
    expect(syncedOf(state).world.entities.e2).toBeDefined();
    expect(Arr.map(state.log, (entry) => entry.sentence)).toStrictEqual([
      "Mossy says: Hello",
      "Mossy made a red block at 13,9",
    ]);
  });

  it("skips events the snapshot already contains", () => {
    const state = receive(
      receive(initialState("live"), snapshot(10, 0), 0),
      applied(10, said(alice, "old news")),
      0
    );

    expect(state.log).toHaveLength(0);
  });

  it("replaces the world on a fresh snapshot but keeps the log", () => {
    const before = receive(
      receive(initialState("live"), snapshot(10, 0), 0),
      applied(11, said(alice, "Hello")),
      0
    );

    const after = receive(before, snapshot(3, 100), 50);

    expect(syncedOf(after)).toMatchObject({
      clockOffset: 50,
      cursor: 3,
      generation: 1,
    });
    expect(after.log).toHaveLength(1);
  });

  it("keeps the log to its limit", () => {
    const state = Arr.reduce(
      Arr.makeBy(LOG_LIMIT + 5, (index) =>
        applied(index + 1, said(bob, `line ${index}`))
      ),
      receive(initialState("live"), snapshot(0, 0), 0),
      (sofar, message) => receive(sofar, message, 0)
    );

    expect(state.log).toHaveLength(LOG_LIMIT);
    expect(state.log.at(-1)?.sentence).toBe(`bob says: line ${LOG_LIMIT + 4}`);
  });
});

const withLog = (events: readonly WorldEvent[]) =>
  Arr.reduce(
    events,
    receive(initialState("live"), snapshot(0, 0), 0),
    (sofar, event, index) => receive(sofar, applied(index + 1, event), 0)
  );

describe(speechAt, () => {
  const state = withLog([
    said(alice, "First", 1000),
    said(alice, "Second", 2000),
  ]);

  it("shows the latest line for a while", () => {
    expect(
      Option.map(speechAt(state.log, alice, 2500), (line) => line.text)
    ).toStrictEqual(Option.some("Second"));
  });

  it("drops the bubble once the line is old", () => {
    expect(
      Option.isNone(speechAt(state.log, alice, 2000 + SPEECH_MILLIS))
    ).toBeTruthy();
    expect(Option.isNone(speechAt(state.log, bob, 2500))).toBeTruthy();
  });
});

describe(presenceScale, () => {
  const character = Option.getOrThrow(
    Option.fromNullishOr(meadow.characters.alice)
  );

  it("shows characters from the snapshot at full size", () => {
    expect(presenceScale(character, [], 0)).toBe(1);
    expect(presenceScale({ ...character, present: false }, [], 0)).toBe(0);
  });

  it("pops in after appearing", () => {
    const { log } = withLog([appeared(alice, 16, 16, 1000)]);

    expect(presenceScale(character, log, 1000)).toBeCloseTo(0);
    expect(presenceScale(character, log, 1000 + POP_MILLIS)).toBeCloseTo(1);
  });

  it("fades out after vanishing", () => {
    const { log } = withLog([vanished(alice, 1000)]);
    const gone = { ...character, present: false };

    expect(presenceScale(gone, log, 1000)).toBe(1);
    expect(presenceScale(gone, log, 1000 + POP_MILLIS / 2)).toBeCloseTo(0.75);
    expect(presenceScale(gone, log, 1000 + POP_MILLIS)).toBe(0);
  });
});
