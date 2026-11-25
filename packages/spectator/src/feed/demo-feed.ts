import { FeedFrame } from "@agent-crossing/world/feed/frame";
import { evolve } from "@agent-crossing/world/history/event";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Schedule from "effect/Schedule";

import { DEMO_EDITS, demoEdit, demoWorld, snapshotFrames } from "./demo.ts";
import type { Generate } from "./demo.ts";
import type { WorldFeed } from "./live-feed.ts";

const EDIT_EVERY = "3500 millis";

/**
 * A feed with no Api: the generated landscape as a snapshot, then a
 * scripted edit every few seconds until {@link DEMO_EDITS} have been made.
 */
export const demoFeed = (generate: Generate, clock: () => number) => {
  const feed: WorldFeed = (listener) => {
    let world = demoWorld(generate, clock());
    let seq = 0;
    let step = 0;

    listener.onConnection("demo");

    for (const frame of snapshotFrames(world, seq)) {
      listener.onFrame(frame);
    }

    const tick = () => {
      if (step >= DEMO_EDITS) {
        return;
      }

      for (const event of demoEdit(world, generate, step, clock())) {
        seq += 1;
        world = evolve(world, event);
        listener.onFrame(FeedFrame.cases.Happened.make({ event, seq }));
      }

      step += 1;
    };

    const running = Effect.runFork(
      Effect.repeat(
        Effect.sync(tick).pipe(Effect.delay(EDIT_EVERY)),
        Schedule.recurs(DEMO_EDITS)
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(running));
    };
  };

  return feed;
};
