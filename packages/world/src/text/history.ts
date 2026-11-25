import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

import { Timestamp } from "../history/edit.ts";
import { Seq, WorldEvent } from "../history/event.ts";
import { eventText } from "./event.ts";

/** {@link historyText} shows at most this many events. */
export const HISTORY_MAX_LIMIT = 200;
export const HISTORY_DEFAULT_LIMIT = 20;

/** An event as the history keeps it: its position and when it was recorded. */
export const HistoryEntry = Schema.Struct({
  seq: Seq,
  at: Timestamp,
  event: WorldEvent,
});

const timeOf = (at: number) =>
  Option.match(DateTime.make(at), {
    onNone: () => `${at}`,
    onSome: (time) => Str.replace(/\.\d{3}Z$/u, "Z")(DateTime.formatIso(time)),
  });

/** The latest events, oldest first, one line each. */
export const historyText = (
  entries: readonly (typeof HistoryEntry.Type)[],
  total: number
) =>
  entries.length === 0
    ? "Nothing has happened yet."
    : Arr.join(
        [
          `The last ${entries.length} of ${total} events, oldest first (UTC):`,
          ...Arr.map(
            entries,
            ({ at, event, seq }) => `#${seq} ${timeOf(at)} ${eventText(event)}`
          ),
        ],
        "\n"
      );
