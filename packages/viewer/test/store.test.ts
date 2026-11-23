import { emptyWorld } from "@agent-crossing/world/world";
import { describe, expect, it } from "@effect/vitest";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { snapshotFrame } from "../src/feed.ts";
import type { Frame, FeedListener } from "../src/feed.ts";
import { startViewer } from "../src/store.ts";

describe("viewer store", () => {
  it("reports a frame that does not decode and keeps applying the feed", () => {
    const dropped: { frame: Frame; message: string }[] = [];
    let listener: FeedListener | undefined;

    const store = startViewer(
      (given) => {
        listener = given;

        return () => {};
      },
      () => 1000,
      (frame, error) => {
        dropped.push({ frame, message: error.message });
      }
    );

    const broken = { data: '{"seq":"x"}', event: "world" };

    listener?.onFrame(broken);
    listener?.onFrame(
      Result.getOrThrow(
        snapshotFrame({ cursor: 0, now: 1000, world: emptyWorld })
      )
    );

    expect(dropped).toHaveLength(1);
    expect(dropped[0]?.frame).toStrictEqual(broken);
    expect(dropped[0]?.message).toContain('["event"]');
    expect(Option.isSome(store.getState().synced)).toBeTruthy();
  });
});
