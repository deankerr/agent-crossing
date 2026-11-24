import { FeedFrame } from "@agent-crossing/world/feed";
import { assert, describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import type { Connection } from "../src/feed-state.ts";
import { eventsUrl, liveFeed, retryMillis } from "../src/live-feed.ts";
import type { EventSourceLike } from "../src/live-feed.ts";

const CONNECTING = 0;
const CLOSED = 2;

interface FakeSource extends EventSourceLike {
  readonly url: string;
  readonly target: EventTarget;
  readonly closed: () => boolean;
  readonly setState: (state: number) => void;
}

const fakeSources = () => {
  const opened: FakeSource[] = [];

  const open = (url: string) => {
    const target = new EventTarget();
    let readyState = CONNECTING;
    let closed = false;

    const source: FakeSource = {
      addEventListener: (type, listener) => {
        target.addEventListener(type, listener);
      },
      close: () => {
        closed = true;
        readyState = CLOSED;
      },
      closed: () => closed,
      get readyState() {
        return readyState;
      },
      setState: (state) => {
        readyState = state;
      },
      target,
      url,
    };

    opened.push(source);

    return source;
  };

  return { open, opened };
};

const recorder = () => {
  const frames: FeedFrame[] = [];
  const connections: Connection[] = [];
  const dropped: string[] = [];

  return {
    connections,
    dropped,
    frames,
    listener: {
      onConnection: (connection: Connection) => {
        connections.push(connection);
      },
      onFrame: (frame: FeedFrame) => {
        frames.push(frame);
      },
    },
    onUndecodable: (data: string) => {
      dropped.push(data);
    },
  };
};

const encodeFrame = (frame: FeedFrame) =>
  Result.getOrThrow(
    Schema.encodeResult(Schema.fromJsonString(FeedFrame))(frame)
  );

const message = (type: string, data: string) =>
  new MessageEvent(type, { data });

describe(eventsUrl, () => {
  it("appends the events path with or without a trailing slash", () => {
    expect(eventsUrl("http://localhost:3000")).toBe(
      "http://localhost:3000/events"
    );
    expect(eventsUrl("https://world.example/")).toBe(
      "https://world.example/events"
    );
  });
});

describe(retryMillis, () => {
  it("doubles from a second up to half a minute", () => {
    expect(Arr.map([0, 1, 2, 3, 4, 5, 6, 20], retryMillis)).toStrictEqual([
      1000, 2000, 4000, 8000, 16_000, 30_000, 30_000, 30_000,
    ]);
  });
});

describe(liveFeed, () => {
  it("parses frames, drops garbage and reports live once open", () => {
    const sources = fakeSources();

    const { connections, dropped, frames, listener, onUndecodable } =
      recorder();

    liveFeed({
      onUndecodable,
      openSource: sources.open,
      url: "http://w/events",
    })(listener);

    const [source] = sources.opened;
    source?.target.dispatchEvent(new Event("open"));
    source?.target.dispatchEvent(
      message("message", encodeFrame(FeedFrame.cases.Reset.make({})))
    );
    source?.target.dispatchEvent(
      message("Ready", encodeFrame(FeedFrame.cases.Ready.make({ cursor: 3 })))
    );
    source?.target.dispatchEvent(message("message", '{"_tag":"Nope"}'));

    expect(source?.url).toBe("http://w/events");
    expect(connections).toStrictEqual(["connecting", "live"]);
    expect(frames).toStrictEqual([
      FeedFrame.cases.Reset.make({}),
      FeedFrame.cases.Ready.make({ cursor: 3 }),
    ]);
    expect(dropped).toStrictEqual(['{"_tag":"Nope"}']);
  });

  it("leaves a dropped connection to the browser while it retries", () => {
    const sources = fakeSources();
    const { connections, listener } = recorder();

    liveFeed({ openSource: sources.open, url: "http://w/events" })(listener);
    sources.opened[0]?.target.dispatchEvent(new Event("error"));

    expect(connections).toStrictEqual(["connecting", "reconnecting"]);
    expect(sources.opened).toHaveLength(1);
  });

  it.live("opens a new source after the browser gives up", () =>
    Effect.gen(function* () {
      const sources = fakeSources();
      const { connections, listener } = recorder();

      liveFeed({ openSource: sources.open, url: "http://w/events" })(listener);

      sources.opened[0]?.setState(CLOSED);
      sources.opened[0]?.target.dispatchEvent(new Event("error"));
      yield* Effect.sleep("1100 millis");
      sources.opened[1]?.target.dispatchEvent(new Event("open"));

      assert.lengthOf(sources.opened, 2);
      assert.isTrue(sources.opened[0]?.closed());
      assert.deepStrictEqual(connections, [
        "connecting",
        "reconnecting",
        "live",
      ]);
    })
  );

  it.live("stops reconnecting once closed", () =>
    Effect.gen(function* () {
      const sources = fakeSources();
      const { listener } = recorder();

      const close = liveFeed({
        openSource: sources.open,
        url: "http://w/events",
      })(listener);

      sources.opened[0]?.setState(CLOSED);
      sources.opened[0]?.target.dispatchEvent(new Event("error"));
      close();
      yield* Effect.sleep("1100 millis");

      assert.lengthOf(sources.opened, 1);
    })
  );
});
