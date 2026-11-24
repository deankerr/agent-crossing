import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Equal from "effect/Equal";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { Command } from "../src/command.ts";
import { evolveAll } from "../src/event.ts";
import { FeedFrame } from "../src/feed.ts";
import {
  changesFor,
  fromSnapshot,
  toSnapshot,
  WorldSnapshot,
} from "../src/snapshot.ts";
import { applyAll, emptyWorld } from "../src/world.ts";
import {
  cell,
  eventsOf,
  garden,
  runAll,
  span,
  spawn,
} from "./world.fixture.ts";

const world = runAll(
  [
    Command.cases.Generate.make({
      height: 12,
      origin: cell(2, 2),
      seed: 4,
      width: 12,
    }),
    spawn("sign", cell(0, 0), { text: "Welcome" }),
    Command.cases.RemoveIn.make({ kind: "sign", region: span(0, 0, 0, 0) }),
    spawn("block", cell(1, 0), { colour: "blue" }),
  ],
  garden
);

const snapshotJson = Schema.fromJsonString(Schema.toCodecJson(WorldSnapshot));

const framesJson = Schema.fromJsonString(
  Schema.toCodecJson(Schema.Array(FeedFrame))
);

describe("snapshots", () => {
  it("round-trip through JSON text to an equal world", () => {
    const restored = fromSnapshot(
      Result.getOrThrow(
        Result.flatMap(
          Schema.encodeUnknownResult(snapshotJson)(toSnapshot(world)),
          Schema.decodeUnknownResult(snapshotJson)
        )
      )
    );

    expect(toSnapshot(restored)).toStrictEqual(toSnapshot(world));
    expect(Equal.equals(restored.ground, world.ground)).toBeTruthy();
    expect(
      Equal.equals(restored.entitiesByCell, world.entitiesByCell)
    ).toBeTruthy();
  });

  it("keep the spawn count even when the newest entity is gone", () => {
    const removed = runAll(
      [Command.cases.RemoveIn.make({ region: span(1, 0, 1, 0) })],
      world
    );

    expect(fromSnapshot(toSnapshot(removed)).spawned).toBe(world.spawned);
  });

  it("rebuild the world from changesFor", () => {
    expect(toSnapshot(applyAll(emptyWorld, changesFor(world)))).toStrictEqual(
      toSnapshot(world)
    );
  });
});

describe("feed frames", () => {
  it("let a viewer rebuild the world and follow its events", () => {
    const followed = eventsOf(world, spawn("rock", cell(0, 1)));

    const sent: readonly FeedFrame[] = [
      FeedFrame.cases.Reset.make({}),
      FeedFrame.cases.Changes.make({ changes: changesFor(world) }),
      FeedFrame.cases.Ready.make({ cursor: 7 }),
      ...Arr.map(followed, (event, index) =>
        FeedFrame.cases.Happened.make({ event, seq: 8 + index })
      ),
    ];

    const frames = Result.getOrThrow(
      Result.flatMap(
        Schema.encodeUnknownResult(framesJson)(sent),
        Schema.decodeUnknownResult(framesJson)
      )
    );

    const viewed = Arr.reduce(frames, emptyWorld, (sofar, frame) =>
      FeedFrame.match(frame, {
        Changes: ({ changes }) => applyAll(sofar, changes),
        Happened: ({ event }) => evolveAll(sofar, [event]),
        Ready: () => sofar,
        Reset: () => emptyWorld,
      })
    );

    expect(toSnapshot(viewed)).toStrictEqual(
      toSnapshot(evolveAll(world, followed))
    );
  });
});
