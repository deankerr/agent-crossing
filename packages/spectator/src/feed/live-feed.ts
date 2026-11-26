import { FeedFrame } from "@agent-crossing/world/feed/frame";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Record from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import type { Connection } from "./feed-state.ts";

const FIRST_RETRY_MILLIS = 1000;
const LAST_RETRY_MILLIS = 30_000;

interface FeedListener {
  readonly onConnection: (connection: Connection) => void;
  readonly onFrame: (frame: typeof FeedFrame.Type) => void;
}

/** Starts a feed that keeps reporting to the listener. */
export type WorldFeed = (listener: FeedListener) => void;

export const eventsUrl = (worldUrl: URL) => new URL("events", worldUrl);

const retryMillis = (failures: number) =>
  Math.min(LAST_RETRY_MILLIS, FIRST_RETRY_MILLIS * 2 ** Math.max(0, failures));

const decodeText = Schema.decodeUnknownOption(Schema.String);

const decodeFrame = Schema.decodeUnknownResult(
  Schema.fromJsonString(FeedFrame)
);

const logUndecodableFrame = (data: string, error: Schema.SchemaError) => {
  Effect.runSync(
    Effect.logError(
      "Dropped a frame from the world feed that did not decode",
      error.message,
      { data }
    ).pipe(Effect.annotateLogs({ source: "agent-crossing-spectator" }))
  );
};

const FRAME_EVENTS = ["message", ...Record.keys(FeedFrame.cases)];

/**
 * The Api's event stream. The browser retries a dropped stream on its
 * own; when it gives up, a new stream is opened after a growing delay. Every
 * new stream starts with `Reset`, so nothing needs resuming.
 */
export const liveFeed = (url: URL) => {
  const feed: WorldFeed = (listener) => {
    let failures = 0;

    const forward = (event: Event) => {
      const data =
        event instanceof MessageEvent
          ? decodeText(event.data)
          : Option.none<string>();

      Option.map(data, (text) => {
        Result.match(decodeFrame(text), {
          onFailure: (error) => {
            logUndecodableFrame(text, error);
          },
          onSuccess: (frame) => {
            failures = 0;
            listener.onFrame(frame);
          },
        });
      });
    };

    const open = () => {
      const opened = new EventSource(url);

      for (const name of FRAME_EVENTS) {
        opened.addEventListener(name, forward);
      }

      opened.addEventListener("open", () => {
        listener.onConnection("live");
      });

      opened.addEventListener("error", () => {
        listener.onConnection("reconnecting");

        if (opened.readyState === EventSource.CLOSED) {
          opened.close();
          const delay = retryMillis(failures);
          failures += 1;

          Effect.runFork(
            Effect.sync(open).pipe(Effect.delay(`${delay} millis`))
          );
        }
      });
    };

    listener.onConnection("connecting");
    open();
  };

  return feed;
};
