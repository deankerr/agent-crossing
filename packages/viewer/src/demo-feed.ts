import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Result from "effect/Result";
import * as Schedule from "effect/Schedule";

import type { LocalClock } from "./clock.ts";
import { openDemo, step, STEP_MILLIS } from "./demo.ts";
import { snapshotFrame, worldFrame } from "./feed.ts";
import type { WorldFeed } from "./feed.ts";

export interface DemoFeedOptions {
  readonly seed: number;
  readonly clock: LocalClock;
  readonly serverSkew: number;
}

export const demoFeed = ({ clock, seed, serverSkew }: DemoFeedOptions) => {
  const serverNow = () => Math.round(clock() + serverSkew);

  const feed: WorldFeed = (listener) => {
    const openedAt = serverNow();
    let demo = openDemo(seed, openedAt);

    listener.onConnection("demo");

    listener.onFrame(
      Result.getOrThrow(
        snapshotFrame({
          cursor: demo.seq,
          now: openedAt,
          world: demo.server.world,
        })
      )
    );

    const tick = () => {
      const cursor = demo.seq;
      const stepped = step(demo, serverNow());
      ({ demo } = stepped);

      Arr.forEach(stepped.events, (event, index) => {
        listener.onFrame(
          Result.getOrThrow(worldFrame({ event, seq: cursor + index + 1 }))
        );
      });
    };

    const running = Effect.runFork(
      Effect.repeat(Effect.sync(tick), Schedule.spaced(STEP_MILLIS))
    );

    return () => {
      Effect.runFork(Fiber.interrupt(running));
    };
  };

  return feed;
};
