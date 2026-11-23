import { assert, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import type { Connection, Frame } from "../src/feed.ts";
import { eventsUrl, liveFeed } from "../src/live-feed.ts";
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
  const frames: Frame[] = [];
  const connections: Connection[] = [];

  return {
    connections,
    frames,
    listener: {
      onConnection: (connection: Connection) => {
        connections.push(connection);
      },
      onFrame: (frame: Frame) => {
        frames.push(frame);
      },
    },
  };
};

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

describe(liveFeed, () => {
  it("forwards named frames and reports live once a snapshot arrives", () => {
    const sources = fakeSources();
    const { connections, frames, listener } = recorder();

    liveFeed({ openSource: sources.open, url: "http://world/events" })(
      listener
    );

    const [source] = sources.opened;
    source?.target.dispatchEvent(message("snapshot", '{"cursor":1}'));
    source?.target.dispatchEvent(message("world", '{"seq":2}'));
    source?.target.dispatchEvent(message("message", "ignored"));

    expect(source?.url).toBe("http://world/events");
    expect(connections).toStrictEqual(["connecting", "live"]);
    expect(frames).toStrictEqual([
      { data: '{"cursor":1}', event: "snapshot" },
      { data: '{"seq":2}', event: "world" },
    ]);
  });

  it("leaves a dropped connection to the browser while it retries", () => {
    const sources = fakeSources();
    const { connections, listener } = recorder();

    liveFeed({ openSource: sources.open, url: "http://world/events" })(
      listener
    );
    sources.opened[0]?.target.dispatchEvent(new Event("error"));

    expect(connections).toStrictEqual(["connecting", "reconnecting"]);
    expect(sources.opened).toHaveLength(1);
  });

  it.live("opens a new source after the browser gives up", () =>
    Effect.gen(function* () {
      const sources = fakeSources();
      const { connections, listener } = recorder();

      liveFeed({
        openSource: sources.open,
        reconnectAfter: "5 millis",
        url: "http://world/events",
      })(listener);

      sources.opened[0]?.setState(CLOSED);
      sources.opened[0]?.target.dispatchEvent(new Event("error"));
      yield* Effect.sleep("40 millis");
      sources.opened[1]?.target.dispatchEvent(message("snapshot", "{}"));

      assert.lengthOf(sources.opened, 2);
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
        reconnectAfter: "5 millis",
        url: "http://world/events",
      })(listener);

      sources.opened[0]?.setState(CLOSED);
      sources.opened[0]?.target.dispatchEvent(new Event("error"));
      close();
      yield* Effect.sleep("40 millis");

      assert.lengthOf(sources.opened, 1);
      assert.isTrue(sources.opened[0]?.closed());
    })
  );
});
