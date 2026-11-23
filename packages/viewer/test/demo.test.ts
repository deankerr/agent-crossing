import type { WorldEvent } from "@agent-crossing/world/event";
import { evolveAll } from "@agent-crossing/world/evolve";
import { entityCount, presentCharacters } from "@agent-crossing/world/world";
import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Result from "effect/Result";

import { DEMO_SEED, openDemo, step, STEP_MILLIS } from "../src/demo.ts";
import type { Demo } from "../src/demo.ts";
import { decodeFrame, worldFrame } from "../src/feed.ts";

const START = 1_764_000_000_000;
const TEN_MINUTES = 600_000;

const run = (seed: number, millis: number) => {
  const opened = openDemo(seed, START);

  return Arr.reduce(
    Arr.makeBy(
      millis / STEP_MILLIS,
      (index) => START + (index + 1) * STEP_MILLIS
    ),
    { demo: opened, events: Arr.empty<WorldEvent>(), opened },
    (
      sofar: { demo: Demo; events: readonly WorldEvent[]; opened: Demo },
      at
    ) => {
      const stepped = step(sofar.demo, at);

      return {
        ...sofar,
        demo: stepped.demo,
        events: Arr.appendAll(sofar.events, stepped.events),
      };
    }
  );
};

const played = run(DEMO_SEED, TEN_MINUTES);

describe(openDemo, () => {
  it("opens on a world with everyone present and things already made", () => {
    const { world } = played.opened.server;

    expect(presentCharacters(world).length).toBeGreaterThanOrEqual(4);
    expect(entityCount(world)).toBeGreaterThan(5);
  });

  it("is reproducible from its seed", () => {
    expect(run(DEMO_SEED, 30_000).events).toStrictEqual(
      run(DEMO_SEED, 30_000).events
    );
    expect(run(DEMO_SEED + 1, 30_000).events).not.toStrictEqual(
      run(DEMO_SEED, 30_000).events
    );
  });
});

describe(step, () => {
  it("shows every kind of event within ten minutes", () => {
    expect(
      new Set(Arr.map(played.events, (event) => event._tag))
    ).toStrictEqual(
      new Set([
        "Appeared",
        "Created",
        "Destroyed",
        "PickedUp",
        "PutDown",
        "Renamed",
        "Said",
        "Vanished",
        "WalkStarted",
      ])
    );
  });

  it("numbers events in order so a viewer can follow along", () => {
    expect(played.demo.seq - played.opened.seq).toBe(played.events.length);
  });

  it("emits events that survive the wire and replay to the same world", () => {
    const decoded = Arr.map(played.events, (event, index) =>
      Result.getOrThrow(
        decodeFrame(Result.getOrThrow(worldFrame({ event, seq: index + 1 })))
      )
    );

    expect(
      evolveAll(
        played.opened.server.world,
        Arr.flatMap(decoded, (message) =>
          message._tag === "Applied" ? [message.event] : []
        )
      )
    ).toStrictEqual(played.demo.server.world);
  });
});
