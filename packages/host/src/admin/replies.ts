import { spanOf } from "@agent-crossing/world/state/span";
import type { Span } from "@agent-crossing/world/state/span";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Str from "effect/String";

import type { Verdict } from "../world-object/wire.ts";
import { EDIT_MAP_MAX_SIDE, framedEdit } from "./affected.ts";
import type { Area, Framed } from "./affected.ts";

/** Edits of more events than this are told as a tally, not sentence by sentence. */
export const SENTENCES_SHOWN = 3;

type Accepted = Extract<typeof Verdict.Type, { readonly _tag: "Accepted" }>;

const spanText = (span: Span) =>
  `x ${span.minX} to ${span.maxX}, y ${span.minY} to ${span.maxY}`;

/** The area to map after an edit, if it touched any cells. */
export const framedOf = (accepted: Accepted) =>
  Option.map(
    Option.fromNullishOr(accepted.edited),
    (edited: typeof Area.Type) => framedEdit(spanOf(edited.from, edited.to))
  );

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const tallyText = ({ tally }: Accepted) => {
  const parts = Arr.filter(
    [
      tally.painted > 0
        ? `painted ${plural(tally.painted, "cell", "cells")}`
        : "",
      tally.poured > 0 ? `poured ${plural(tally.poured, "cell", "cells")}` : "",
      tally.erased > 0 ? `erased ${plural(tally.erased, "cell", "cells")}` : "",
      tally.removed > 0
        ? `removed ${plural(tally.removed, "entity", "entities")}`
        : "",
      tally.placed > 0
        ? `placed ${plural(tally.placed, "entity", "entities")}`
        : "",
      tally.moved > 0
        ? `moved ${plural(tally.moved, "entity", "entities")}`
        : "",
      tally.changed > 0
        ? `changed ${plural(tally.changed, "entity", "entities")}`
        : "",
    ],
    (part) => part !== ""
  );

  const listed =
    parts.length <= 1
      ? Arr.join(parts, "")
      : `${Arr.join(Arr.dropRight(parts, 1), ", ")} and ${parts.at(-1) ?? ""}`;

  return `${Str.capitalize(listed)}.`;
};

const happenedText = (accepted: Accepted) => {
  const { changes, sentences } = accepted;

  if (sentences.length === 0) {
    return "Nothing changed: the edit matched nothing that differs from what is already there.";
  }

  const told =
    sentences.length > SENTENCES_SHOWN
      ? [tallyText(accepted)]
      : Arr.map(sentences, (sentence) => `${sentence}.`);

  return Arr.join(
    [
      ...told,
      `(${plural(sentences.length, "event", "events")}, ${plural(changes, "change", "changes")}.)`,
    ],
    " "
  );
};

const editedText = (framed: Framed) =>
  framed.cut
    ? `The edit touched ${spanText(framed.edited)}. That is more than this map shows (at most ${EDIT_MAP_MAX_SIDE} x ${EDIT_MAP_MAX_SIDE} cells, from the north-west corner); use view_map for the rest.`
    : `The edit touched ${spanText(framed.edited)}.`;

/** What an accepted edit did, then the map of the area it touched. */
export const editText = (
  accepted: Accepted,
  framed: Option.Option<{ readonly framed: Framed; readonly map: string }>
) =>
  Arr.join(
    [
      happenedText(accepted),
      ...Option.match(framed, {
        onNone: () => [],
        onSome: ({ framed: shown, map }) => ["", editedText(shown), "", map],
      }),
    ],
    "\n"
  );
