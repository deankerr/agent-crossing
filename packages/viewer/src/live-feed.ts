import type * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

import { SNAPSHOT_FRAME, WORLD_FRAME } from "./feed.ts";
import type { FeedListener, WorldFeed } from "./feed.ts";

export const DEFAULT_WORLD_URL = "http://localhost:3000";

const CLOSED = 2;

export interface EventSourceLike {
  readonly readyState: number;
  readonly addEventListener: (
    type: string,
    listener: (event: Event) => void
  ) => void;
  readonly close: () => void;
}

export type OpenEventSource = (url: string) => EventSourceLike;

export const browserEventSource: OpenEventSource = (url) =>
  new EventSource(url);

export const eventsUrl = (worldUrl: string) =>
  `${Str.endsWith("/")(worldUrl) ? Str.slice(0, -1)(worldUrl) : worldUrl}/events`;

export interface LiveFeedOptions {
  readonly url: string;
  readonly openSource?: OpenEventSource;
  readonly reconnectAfter?: Duration.Input;
}

const decodeData = Schema.decodeUnknownOption(Schema.String);

const dataOf = (event: Event) =>
  event instanceof MessageEvent
    ? decodeData(event.data)
    : Option.none<string>();

export const liveFeed = ({
  openSource = browserEventSource,
  reconnectAfter = "2 seconds",
  url,
}: LiveFeedOptions) => {
  const feed: WorldFeed = (listener: FeedListener) => {
    let source = Option.none<EventSourceLike>();
    let retry = Option.none<Fiber.Fiber<void>>();
    let stopped = false;

    const forward = (name: string) => (event: Event) => {
      const data = dataOf(event);

      if (Option.isNone(data)) {
        return;
      }

      if (name === SNAPSHOT_FRAME) {
        listener.onConnection("live");
      }

      listener.onFrame({ data: data.value, event: name });
    };

    const open = () => {
      if (stopped) {
        return;
      }

      const opened = openSource(url);
      source = Option.some(opened);
      opened.addEventListener(SNAPSHOT_FRAME, forward(SNAPSHOT_FRAME));
      opened.addEventListener(WORLD_FRAME, forward(WORLD_FRAME));

      opened.addEventListener("error", () => {
        if (stopped) {
          return;
        }

        listener.onConnection("reconnecting");

        if (opened.readyState === CLOSED) {
          opened.close();

          retry = Option.some(
            Effect.runFork(Effect.sync(open).pipe(Effect.delay(reconnectAfter)))
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
