import { WorldEvent } from "@agent-crossing/world/event";
import { centre } from "@agent-crossing/world/grid";
import { Username } from "@agent-crossing/world/values";
import { emptyWorld } from "@agent-crossing/world/world";
import { assert, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import {
  comment,
  cursorFrom,
  frame,
  snapshotFrame,
  worldFrame,
} from "../src/sse.ts";

const alice = Username.make("alice");

describe("server-sent events", () => {
  it("frames an event with its name, id and one data line per line", () => {
    expect(frame({ data: "a\nb", event: "world", id: "7" })).toBe(
      "event: world\nid: 7\ndata: a\ndata: b\n\n"
    );
    expect(comment("keep-alive")).toBe(": keep-alive\n\n");
  });

  it.effect("frames a snapshot as the viewer expects", () =>
    Effect.map(
      snapshotFrame({ cursor: 3, now: 1000, world: emptyWorld }),
      (framed) => {
        assert.strictEqual(
          framed,
          'event: snapshot\ndata: {"cursor":3,"now":1000,"world":{"characters":{},"entities":{},"entitiesCreated":0}}\n\n'
        );
      }
    )
  );

  it.effect("frames a world event as the viewer expects", () =>
    Effect.map(
      worldFrame({
        event: WorldEvent.cases.Appeared.make({
          actor: alice,
          at: 5,
          tile: centre,
        }),
        seq: 4,
      }),
      (framed) => {
        assert.strictEqual(
          framed,
          'event: world\nid: 4\ndata: {"seq":4,"event":{"_tag":"Appeared","actor":"alice","at":5,"tile":{"x":16,"y":16}}}\n\n'
        );
      }
    )
  );

  it("takes the cursor from the query, then Last-Event-ID", () => {
    expect(cursorFrom("12", "3")).toStrictEqual(
      Result.succeed(Option.some(12))
    );
    expect(cursorFrom(undefined, "3")).toStrictEqual(
      Result.succeed(Option.some(3))
    );
    expect(cursorFrom(undefined, undefined)).toStrictEqual(
      Result.succeed(Option.none())
    );
  });

  it("rejects a cursor that is not a sequence number", () => {
    expect(cursorFrom("-1", undefined)).toStrictEqual(Result.fail("-1"));
    expect(cursorFrom("1.5", undefined)).toStrictEqual(Result.fail("1.5"));
    expect(cursorFrom("soon", undefined)).toStrictEqual(Result.fail("soon"));
  });
});
