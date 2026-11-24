import { FeedFrame } from "@agent-crossing/world/feed";
import { changesFor } from "@agent-crossing/world/snapshot";
import {
  cellCount,
  emptyWorld,
  entityCount,
  groundAt,
} from "@agent-crossing/world/world";
import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

import {
  HISTORY_LIMIT,
  initialFeedState,
  receive,
  statusOf,
  withConnection,
} from "../src/feed-state.ts";
import type { FeedState } from "../src/feed-state.ts";
import { cell, eventsOf, paintRect, runAll, spawn } from "./world.fixture.ts";

const garden = runAll([
  paintRect(cell(-2, -2), cell(2, 2), "grass", 1),
  spawn("oak", cell(0, 0)),
]);

const reset = FeedFrame.cases.Reset.make({});
const ready = (cursor: number) => FeedFrame.cases.Ready.make({ cursor });

const snapshot = (cursor: number) => [
  reset,
  ...Arr.map(Arr.chunksOf(changesFor(garden), 7), (changes) =>
    FeedFrame.cases.Changes.make({ changes })
  ),
  ready(cursor),
];

const fold = (frames: readonly FeedFrame[], state = initialFeedState("live")) =>
  Arr.reduce(frames, state, receive);

const shownWorld = (state: FeedState) => Option.getOrThrow(state.shown).world;

const painting = eventsOf(garden, paintRect(cell(3, 0), cell(3, 0), "sand", 0));

const happened = (seq: number) =>
  Arr.map(painting, (event, index) =>
    FeedFrame.cases.Happened.make({ event, seq: seq + index })
  );

describe(receive, () => {
  it("shows nothing until the snapshot is ready", () => {
    const frames = snapshot(4);
    const loading = fold(Arr.dropRight(frames, 1));

    expect(Option.isNone(loading.shown)).toBeTruthy();
    expect(statusOf(loading)).toBe("loading");
    expect(Option.map(loading.loading, cellCount)).toStrictEqual(
      Option.some(25)
    );
  });

  it("swaps the whole snapshot in on Ready", () => {
    const state = fold(snapshot(4));
    const shown = Option.getOrThrow(state.shown);

    expect(shown).toMatchObject({ cursor: 4, generation: 0 });
    expect(cellCount(shown.world)).toBe(25);
    expect(entityCount(shown.world)).toBe(1);
    expect(Option.isNone(state.loading)).toBeTruthy();
    expect(statusOf(state)).toBe("live");
  });

  it("applies a later event at once and logs it newest first", () => {
    const state = fold([...snapshot(4), ...happened(5)]);

    expect(Option.getOrThrow(state.shown).cursor).toBe(5);
    expect(
      Option.map(groundAt(shownWorld(state), cell(3, 0)), (g) => g.kind)
    ).toStrictEqual(Option.some("sand"));
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toMatchObject({
      cell: Option.some(cell(3, 0)),
      key: "0:5",
      kind: "GroundPainted",
      seq: 5,
      sentence: "tester painted 1 cell with sand",
    });
  });

  it("ignores events it has already seen and events before any snapshot", () => {
    const once = fold([...snapshot(4), ...happened(5)]);
    const twice = fold(happened(5), once);

    expect(twice).toBe(once);
    expect(fold(happened(1))).toStrictEqual(initialFeedState("live"));
    expect(fold(happened(3), fold(snapshot(4)))).toStrictEqual(
      fold(snapshot(4))
    );
  });

  it("keeps the old world on screen while a reconnect reloads", () => {
    const before = fold([...snapshot(4), ...happened(5)]);
    const reloading = fold([reset], before);

    expect(statusOf(reloading)).toBe("reloading");
    expect(reloading.shown).toBe(before.shown);

    const after = fold(Arr.drop(snapshot(9), 1), reloading);
    const shown = Option.getOrThrow(after.shown);

    expect(shown).toMatchObject({ cursor: 9, generation: 1 });
    expect(cellCount(shown.world)).toBe(25);
    expect(after.history).toHaveLength(1);
  });

  it("ignores changes and Ready that arrive without a Reset", () => {
    const state = fold([
      FeedFrame.cases.Changes.make({ changes: changesFor(garden) }),
      ready(1),
    ]);

    expect(state).toStrictEqual(initialFeedState("live"));
  });

  it("caps the history", () => {
    const frames = Arr.makeBy(HISTORY_LIMIT + 5, (index) =>
      FeedFrame.cases.Happened.make({
        event: Option.getOrThrow(Arr.head(painting)),
        seq: 5 + index,
      })
    );

    const state = fold([...snapshot(4), ...frames]);

    expect(state.history).toHaveLength(HISTORY_LIMIT);
    expect(state.history[0]?.seq).toBe(HISTORY_LIMIT + 9);
  });

  it("starts from the empty world on Reset", () => {
    const state = fold([reset, ready(0)]);

    expect(shownWorld(state)).toStrictEqual(emptyWorld);
  });
});

describe(statusOf, () => {
  it("reports the connection until it is live", () => {
    expect(statusOf(initialFeedState("connecting"))).toBe("connecting");
    expect(statusOf(withConnection(fold(snapshot(1)), "reconnecting"))).toBe(
      "reconnecting"
    );
    expect(statusOf(fold(snapshot(1), initialFeedState("demo")))).toBe("demo");
  });
});
