import * as Event from "@agent-crossing/world/Event";
import * as Span from "@agent-crossing/world/Span";
import type * as World from "@agent-crossing/world/World";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

import * as EventText from "./EventText.ts";
import { totals } from "./internal/tally.ts";
import { plural, spanText } from "./internal/words.ts";
import * as MapView from "./MapView.ts";

const SENTENCES_SHOWN = 3;

const PADDING = 2;

const MAX_SIDE = 48;

const happened = (events: readonly (typeof Event.Event.Type)[]) => {
  if (events.length === 0) {
    return "Nothing changed: the command matched nothing that differs from what is already there.";
  }

  const told =
    events.length > SENTENCES_SHOWN
      ? [totals(events)]
      : Arr.map(events, (event) => `${EventText.sentence(event)}.`);

  return Arr.join(
    [...told, `(${plural(events.length, "event", "events")}.)`],
    " "
  );
};

const framed = (world: World.World, touched: Span.Span) => {
  const padded: Span.Span = {
    maxX: touched.maxX + PADDING,
    maxY: touched.maxY + PADDING,
    minX: touched.minX - PADDING,
    minY: touched.minY - PADDING,
  };

  const shown: Span.Span = {
    ...padded,
    maxX: Math.min(padded.maxX, padded.minX + MAX_SIDE - 1),
    maxY: Math.min(padded.maxY, padded.minY + MAX_SIDE - 1),
  };

  const cut = shown.maxX !== padded.maxX || shown.maxY !== padded.maxY;

  return [
    "",
    cut
      ? `The events touched ${spanText(touched)}. The map below shows at most ${MAX_SIDE} × ${MAX_SIDE} cells, from the north-west corner, so it leaves some of them out.`
      : `The events touched ${spanText(touched)}.`,
    "",
    MapView.text(world, Span.toArea(shown)),
  ];
};

/**
 * The reply to an accepted command: what its events did, in a few sentences
 * or in totals when there are many, the cells they touched, and the map of
 * that area in the world after them.
 */
export const text = (
  events: readonly (typeof Event.Event.Type)[],
  world: World.World
) =>
  Arr.join(
    [
      happened(events),
      ...Option.match(Span.ofCells(Arr.flatMap(events, Event.cells)), {
        onNone: () => [],
        onSome: (touched) => framed(world, touched),
      }),
    ],
    "\n"
  );
