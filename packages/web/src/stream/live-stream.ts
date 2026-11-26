import * as StreamFrame from "@agent-crossing/server/StreamFrame";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Record from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import type { Connection } from "./stream-state.ts";

const FIRST_RETRY_MILLIS = 1000;
const LAST_RETRY_MILLIS = 30_000;

interface StreamListener {
  readonly onConnection: (connection: Connection) => void;
  readonly onFrame: (frame: typeof StreamFrame.StreamFrame.Type) => void;
}

/** Starts a stream that keeps reporting to the listener. */
export type WorldStream = (listener: StreamListener) => void;

export const eventsUrl = (worldUrl: URL) => new URL("events", worldUrl);

const retryMillis = (failures: number) =>
  Math.min(LAST_RETRY_MILLIS, FIRST_RETRY_MILLIS * 2 ** Math.max(0, failures));

const decodeText = Schema.decodeUnknownOption(Schema.String);

const decodeFrame = Schema.decodeUnknownResult(
  Schema.fromJsonString(StreamFrame.StreamFrame)
);

const logUndecodableFrame = (data: string, error: Schema.SchemaError) => {
  Effect.runSync(
    Effect.logError(
      "Dropped a frame from the world stream that did not decode",
      error.message,
      { data }
    ).pipe(Effect.annotateLogs({ source: "agent-crossing-web" }))
  );
};

const FRAME_EVENTS = ["message", ...Record.keys(StreamFrame.StreamFrame.cases)];

/**
 * The Api's event stream. The browser retries a dropped stream on its
 * own; when it gives up, a new stream is opened after a growing delay. Every
 * new stream starts with `Reset`, so nothing needs resuming.
 */
export const liveStream = (url: URL) => {
  const stream: WorldStream = (listener) => {
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

  return stream;
};
