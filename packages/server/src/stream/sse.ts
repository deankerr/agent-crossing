import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as StreamFrame from "../StreamFrame.ts";

const encodeFrameJson = Schema.encodeEffect(
  Schema.fromJsonString(StreamFrame.StreamFrame)
);

/**
 * One server-sent event per frame, as an unnamed `message` event whose data
 * is the frame as JSON. `Happened` frames carry their sequence number as the
 * event id.
 */
export const sseFrame = (frame: typeof StreamFrame.StreamFrame.Type) =>
  Effect.map(encodeFrameJson(frame), (json) => {
    const id = frame._tag === "Happened" ? `id: ${frame.seq}\n` : "";

    return `${id}data: ${json}\n\n`;
  });

export const sseComment = (text: string) => `: ${text}\n\n`;
