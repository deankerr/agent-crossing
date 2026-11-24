import { Change } from "@agent-crossing/world/change";
import { Command } from "@agent-crossing/world/command";
import { EntityId } from "@agent-crossing/world/entity";
import { WorldEvent } from "@agent-crossing/world/event";
import { FeedFrame } from "@agent-crossing/world/feed";
import { changesFor, toSnapshot } from "@agent-crossing/world/snapshot";
import { applyAll, emptyWorld } from "@agent-crossing/world/world";
import { assert, describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";

import { sseComment, sseFrame } from "../src/sse.ts";
import { FRAME_MAX_CHANGES, openingFrames, tallyOf } from "../src/wire.ts";
import { cell, claude, eventsOf, runAll } from "./world.fixture.ts";

describe("tallies", () => {
  it("sum what each event did", () => {
    const events = eventsOf(
      emptyWorld,
      Command.cases.Generate.make({
        height: 40,
        origin: cell(0, 0),
        seed: 3,
        width: 40,
      })
    );

    const tally = tallyOf(events);

    expect(tally.painted).toBe(1600);
    expect(tally.placed).toBeGreaterThan(0);
    expect(tally.removed + tally.erased + tally.moved + tally.changed).toBe(0);
  });
});

describe("opening frames", () => {
  const big = runAll([
    Command.cases.Generate.make({
      height: 48,
      origin: cell(0, 0),
      seed: 1,
      width: 48,
    }),
  ]);

  const frames = openingFrames(big, 12);

  it("reset, then batches of changes, then ready with the cursor", () => {
    expect(frames[0]?._tag).toBe("Reset");
    expect(frames.at(-1)).toStrictEqual(
      FeedFrame.cases.Ready.make({ cursor: 12 })
    );

    const batches = Arr.filter(frames, (frame) => frame._tag === "Changes");
    expect(batches.length).toBeGreaterThan(1);
    expect(
      Arr.every(
        batches,
        (frame) =>
          frame._tag === "Changes" && frame.changes.length <= FRAME_MAX_CHANGES
      )
    ).toBeTruthy();
  });

  it("rebuild the world from the empty world", () => {
    const changes = Arr.flatMap(frames, (frame) =>
      frame._tag === "Changes" ? frame.changes : []
    );

    expect(changes).toStrictEqual(changesFor(big));
    expect(toSnapshot(applyAll(emptyWorld, changes))).toStrictEqual(
      toSnapshot(big)
    );
  });

  it("of an empty world still reset and say ready", () => {
    expect(
      Arr.map(openingFrames(emptyWorld, 0), (frame) => frame._tag)
    ).toStrictEqual(["Reset", "Changes", "Ready"]);
  });
});

describe("server-sent events", () => {
  it.effect("frame a reset as one data line with no id", () =>
    Effect.map(sseFrame(FeedFrame.cases.Reset.make({})), (text) => {
      assert.strictEqual(text, 'data: {"_tag":"Reset"}\n\n');
    })
  );

  it.effect("give happened frames their sequence number as id", () =>
    Effect.map(
      sseFrame(
        FeedFrame.cases.Happened.make({
          event: WorldEvent.cases.Moved.make({
            at: 5,
            by: claude,
            entity: EntityId.make("e3"),
            to: cell(1, 2),
          }),
          seq: 4,
        })
      ),
      (text) => {
        assert.strictEqual(
          text,
          'id: 4\ndata: {"_tag":"Happened","seq":4,"event":{"_tag":"Moved","at":5,"by":"claude","entity":"e3","to":{"x":1,"y":2}}}\n\n'
        );
      }
    )
  );

  it.effect("keep text with line breaks on one data line", () =>
    Effect.map(
      sseFrame(
        FeedFrame.cases.Changes.make({
          changes: [
            Change.cases.EntityPut.make({
              entity: {
                cell: cell(0, 0),
                components: { text: "line one\nline two" },
                id: EntityId.make("e1"),
                kind: "sign",
              },
            }),
          ],
        })
      ),
      (text) => {
        assert.strictEqual(
          Arr.filter(Str.split(text, "\n"), (line) => line !== "").length,
          1
        );
      }
    )
  );

  it("write comments for keep-alives", () => {
    expect(sseComment("keep-alive")).toBe(": keep-alive\n\n");
  });
});
