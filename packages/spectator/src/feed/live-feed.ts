import { FeedFrame } from "@agent-crossing/world/feed/frame";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as Record from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

import type { Connection } from "./feed-state.ts";

export const DEFAULT_WORLD_URL = "http://localhost:3000";

const FIRST_RETRY_MILLIS = 1000;
const LAST_RETRY_MILLIS = 30_000;

interface FeedListener {
  readonly onConnection: (connection: Connection) => void;
  readonly onFrame: (frame: typeof FeedFrame.Type) => void;
}

/** Starts a feed; the returned function stops it. */
export type WorldFeed = (listener: FeedListener) => () => void;

export const eventsUrl = (worldUrl: string) =>
  `${Str.endsWith("/")(worldUrl) ? Str.slice(0, -1)(worldUrl) : worldUrl}/events`;

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
export const liveFeed = (url: string) => {
  const feed: WorldFeed = (listener) => {
    let source = Option.none<EventSource>();
    let retry = Option.none<Fiber.Fiber<void>>();
    let failures = 0;
    let stopped = false;

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
      if (stopped) {
        return;
      }

      const opened = new EventSource(url);
      source = Option.some(opened);

      for (const name of FRAME_EVENTS) {
        opened.addEventListener(name, forward);
      }

      opened.addEventListener("open", () => {
        listener.onConnection("live");
      });

      opened.addEventListener("error", () => {
        if (stopped) {
          return;
        }

        listener.onConnection("reconnecting");

        if (opened.readyState === EventSource.CLOSED) {
          opened.close();
          const delay = retryMillis(failures);
          failures += 1;

          retry = Option.some(
            Effect.runFork(
              Effect.sync(open).pipe(Effect.delay(`${delay} millis`))
            )
          );
        }
      });
    };

    listener.onConnection("connecting");
    open();

    return () => {
      stopped = true;

      if (Option.isSome(source)) {
        source.value.close();
      }

      if (Option.isSome(retry)) {
        Effect.runFork(Fiber.interrupt(retry.value));
      }
    };
  };

  return feed;
};
