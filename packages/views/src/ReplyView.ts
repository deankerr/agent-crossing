import * as Event from "@agent-crossing/world/Event";
import * as Region from "@agent-crossing/world/Region";
import type * as World from "@agent-crossing/world/World";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

import * as EventText from "./EventText.ts";
import * as MapView from "./internal/map-view.ts";
import { totals } from "./internal/tally.ts";
import { plural, rectText } from "./internal/words.ts";

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

const framed = (world: World.World, touched: typeof Region.Rect.Type) => {
  const padded = Region.padded(touched, PADDING);
  const shown = Region.cut(padded, MAX_SIDE);

  return [
    "",
    Region.same(shown, padded)
      ? `The events touched ${rectText(touched)}.`
      : `The events touched ${rectText(touched)}. The map below shows at most ${MAX_SIDE} × ${MAX_SIDE} cells, from the north-west corner, so it leaves some of them out.`,
    "",
    MapView.text(world, shown),
  ];
};

/**
 * The reply to an accepted command: what its events did, in a few sentences
 * or in totals when there are many, the cells they touched, and the map of
 * that rectangle in the world after them.
 */
export const text = (
  events: readonly (typeof Event.Event.Type)[],
  world: World.World
) =>
  Arr.join(
    [
      happened(events),
      ...Option.match(Region.bounding(Arr.flatMap(events, Event.cells)), {
        onNone: () => [],
        onSome: (touched) => framed(world, touched),
      }),
    ],
    "\n"
  );
