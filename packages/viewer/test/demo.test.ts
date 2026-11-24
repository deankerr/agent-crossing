import { evolveAll } from "@agent-crossing/world/event";
import type { WorldEvent } from "@agent-crossing/world/event";
import { FeedFrame } from "@agent-crossing/world/feed";
import {
  bounds,
  cellCount,
  emptyWorld,
  entityCount,
} from "@agent-crossing/world/world";
import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

import {
  DEMO_SEED,
  DEMO_SIZE,
  demoCommand,
  demoEdit,
  demoWorld,
  snapshotFrames,
} from "../src/demo.ts";
import { initialFeedState, receive } from "../src/feed-state.ts";

const params = (query: string) => new URLSearchParams(query);

describe(demoCommand, () => {
  it("defaults to the demo seed and a 64 × 64 landscape centred on 0,0", () => {
    expect(demoCommand(params("demo"))).toMatchObject({
      height: DEMO_SIZE,
      origin: { x: -32, y: -32 },
      seed: DEMO_SEED,
      width: DEMO_SIZE,
    });
  });

  it("reads the seed and a square or rectangular size", () => {
    expect(demoCommand(params("demo&seed=7&size=20"))).toMatchObject({
      height: 20,
      origin: { x: -10, y: -10 },
      seed: 7,
      width: 20,
    });
    expect(demoCommand(params("demo&size=40x16"))).toMatchObject({
      height: 16,
      origin: { x: -20, y: -8 },
      width: 40,
    });
  });

  it("falls back to the defaults for sizes the rules refuse", () => {
    expect(demoCommand(params("demo&seed=x&size=3"))).toMatchObject({
      height: DEMO_SIZE,
      seed: DEMO_SEED,
      width: DEMO_SIZE,
    });
  });
});

describe(demoWorld, () => {
  const generate = demoCommand(params("demo&seed=11&size=24"));
  const world = demoWorld(generate);

  it("covers the generated rectangle, with negative coordinates", () => {
    expect(cellCount(world)).toBe(24 * 24);
    expect(entityCount(world)).toBeGreaterThan(0);
    expect(bounds(world)).toStrictEqual(
      Option.some({ maxX: 11, maxY: 11, minX: -12, minY: -12 })
    );
  });

  it("is the same world for the same seed", () => {
    expect(demoWorld(generate)).toStrictEqual(world);
  });

  it("reaches a viewer whole through snapshot frames", () => {
    const frames = snapshotFrames(world, 0);
    const state = Arr.reduce(frames, initialFeedState("demo"), receive);

    expect(frames[0]).toStrictEqual(FeedFrame.cases.Reset.make({}));
    expect(Option.map(state.shown, (shown) => shown.world)).toStrictEqual(
      Option.some(world)
    );
  });

  it("makes scripted edits the rules accept", () => {
    const edits = Arr.makeBy(9, (step) => step);

    const result = Arr.reduce(
      edits,
      { events: Arr.empty<WorldEvent>(), world },
      (sofar, step) => {
        const events = demoEdit(sofar.world, generate, step, 1000 + step);

        return {
          events: [...sofar.events, ...events],
          world: evolveAll(sofar.world, events),
        };
      }
    );

    expect(result.events.length).toBeGreaterThanOrEqual(6);
    expect(entityCount(result.world)).toBeGreaterThan(entityCount(world));
    expect(demoEdit(world, generate, 0, 1000)).toStrictEqual(
      demoEdit(world, generate, 0, 1000)
    );
  });

  it("gives up quietly on a world with no ground", () => {
    expect(demoEdit(emptyWorld, generate, 0, 0)).toStrictEqual([]);
  });
});
