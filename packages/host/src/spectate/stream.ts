import * as Effect from "effect/Effect";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Stream from "effect/Stream";

import { WorldClient } from "../world-object/client.ts";
import { FeedItem } from "../world-object/wire.ts";
import { sseComment, sseFrame } from "./sse.ts";

const SSE_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-expose-headers": "*",
  "cache-control": "no-cache",
  "x-accel-buffering": "no",
};

/** The answer to a browser's preflight request for `/events`. */
export const preflight = () =>
  HttpServerResponse.empty({
    headers: {
      "access-control-allow-headers": "last-event-id",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-origin": "*",
    },
    status: 204,
  });

/**
 * The world's feed as server-sent events. When the feed ends, a closing
 * comment asks the spectator to reconnect. Yield it from the Worker's
 * construction effect; each call of what it gives answers one request.
 */
export const spectate = Effect.map(
  WorldClient,
  (world) => () =>
    HttpServerResponse.stream(
      Stream.encodeText(
        world.feed.pipe(
          Stream.mapEffect((item) =>
            FeedItem.match(item, {
              Frame: ({ frame }) => sseFrame(frame),
              Heartbeat: () => Effect.succeed(sseComment("keep-alive")),
            })
          ),
          Stream.catchCause((cause) =>
            Stream.fromEffect(
              Effect.as(
                Effect.logWarning("World feed ended", cause),
                sseComment("stream ended; reconnect for a fresh snapshot")
              )
            )
          )
        )
      ),
      { contentType: "text/event-stream", headers: SSE_HEADERS }
    )
);
