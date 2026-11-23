import { describe, expect, it } from "@effect/vitest";
import * as Result from "effect/Result";
import * as Str from "effect/String";

import { decodeFrame, snapshotFrame, worldFrame } from "../src/feed.ts";
import { alice, meadow, said } from "./world.fixture.ts";

const recordedSnapshot = `{"cursor":41,"now":1764000000000,"world":{"characters":{"alice":{"username":"alice","displayName":"Mossy","present":true,"motion":{"_tag":"Walking","path":[{"x":16,"y":16},{"x":17,"y":16},{"x":17,"y":17}],"startedAt":1763999999000}},"bob":{"username":"bob","displayName":"bob","present":false,"motion":{"_tag":"Standing","tile":{"x":3,"y":4}}}},"entities":{"e1":{"id":"e1","item":{"_tag":"Sign","text":"Welcome"},"location":{"_tag":"Ground","tile":{"x":12,"y":9}}},"e2":{"id":"e2","item":{"_tag":"Flower","colour":"pink"},"location":{"_tag":"Carried","by":"alice"}}},"entitiesCreated":2}}`;

const recordedWalk = `{"seq":42,"event":{"_tag":"WalkStarted","actor":"alice","at":1764000000500,"path":[{"x":17,"y":17},{"x":18,"y":17}]}}`;

const recordedPickUp = `{"seq":43,"event":{"_tag":"PickedUp","actor":"bob","at":1764000001000,"entity":"e1","tile":{"x":12,"y":9}}}`;

describe(decodeFrame, () => {
  it("decodes a recorded snapshot into the world schema", () => {
    const decoded = Result.getOrThrow(
      decodeFrame({ data: recordedSnapshot, event: "snapshot" })
    );

    expect(decoded).toMatchObject({
      _tag: "Snapshot",
      cursor: 41,
      now: 1_764_000_000_000,
      world: {
        characters: {
          alice: {
            motion: {
              _tag: "Walking",
              path: [
                { x: 16, y: 16 },
                { x: 17, y: 16 },
                { x: 17, y: 17 },
              ],
              startedAt: 1_763_999_999_000,
            },
          },
        },
        entities: { e2: { location: { _tag: "Carried", by: "alice" } } },
      },
    });
  });

  it("decodes recorded world events with their sequence numbers", () => {
    const walk = Result.getOrThrow(
      decodeFrame({ data: recordedWalk, event: "world" })
    );

    const pickUp = Result.getOrThrow(
      decodeFrame({ data: recordedPickUp, event: "world" })
    );

    expect(walk).toMatchObject({
      _tag: "Applied",
      event: { _tag: "WalkStarted", actor: "alice" },
      seq: 42,
    });
    expect(pickUp).toMatchObject({
      _tag: "Applied",
      event: { _tag: "PickedUp", entity: "e1" },
      seq: 43,
    });
  });

  it("rejects JSON that is not well formed", () => {
    expect(
      Result.isFailure(decodeFrame({ data: "{not json", event: "world" }))
    ).toBeTruthy();
  });

  it("rejects messages that break the world rules", () => {
    const offTheMap = Str.replace('"x":18', '"x":40')(recordedWalk);
    const unknownColour = Str.replace('"pink"', '"teal"')(recordedSnapshot);

    expect(
      Result.isFailure(decodeFrame({ data: offTheMap, event: "world" }))
    ).toBeTruthy();
    expect(
      Result.isFailure(decodeFrame({ data: unknownColour, event: "snapshot" }))
    ).toBeTruthy();
  });

  it("rejects frames with an unknown event name", () => {
    const decoded = decodeFrame({ data: recordedWalk, event: "gossip" });

    expect(Result.isFailure(decoded)).toBeTruthy();
    expect(Result.getFailure(decoded)).toMatchObject({
      _tag: "Some",
      value: { _tag: "UnknownFrame", event: "gossip" },
    });
  });
});

describe("encoding frames", () => {
  it("round trips a snapshot through its JSON encoding", () => {
    const frame = Result.getOrThrow(
      snapshotFrame({ cursor: 7, now: 123, world: meadow })
    );

    expect(Result.getOrThrow(decodeFrame(frame))).toStrictEqual({
      _tag: "Snapshot",
      cursor: 7,
      now: 123,
      world: meadow,
    });
  });

  it("round trips a world event through its JSON encoding", () => {
    const event = said(alice, "Hello neighbour!", 99);
    const frame = Result.getOrThrow(worldFrame({ event, seq: 8 }));

    expect(frame.event).toBe("world");
    expect(Result.getOrThrow(decodeFrame(frame))).toStrictEqual({
      _tag: "Applied",
      event,
      seq: 8,
    });
  });
});
