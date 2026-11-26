import * as Entity from "@agent-crossing/world/Entity";
import * as Event from "@agent-crossing/world/Event";
import * as Arr from "effect/Array";
import * as Str from "effect/String";

import { cellsWord, entitiesWord, joined } from "./words.ts";

interface Tally {
  readonly floorsPlaced: number;
  readonly floorsChanged: number;
  readonly floorsRemoved: number;
  readonly liquidsPlaced: number;
  readonly liquidsChanged: number;
  readonly liquidsRemoved: number;
  readonly placed: number;
  readonly changed: number;
  readonly moved: number;
  readonly removed: number;
}

const none: Tally = {
  changed: 0,
  floorsChanged: 0,
  floorsPlaced: 0,
  floorsRemoved: 0,
  liquidsChanged: 0,
  liquidsPlaced: 0,
  liquidsRemoved: 0,
  moved: 0,
  placed: 0,
  removed: 0,
};

type Present = typeof Entity.Entity.Type;

const isOther = (entity: Present) =>
  !Entity.isFloor(entity) && !Entity.isLiquid(entity);

const split = (entities: readonly Present[]) => ({
  floors: Arr.filter(entities, Entity.isFloor).length,
  liquids: Arr.filter(entities, Entity.isLiquid).length,
  others: Arr.filter(entities, isOther).length,
});

const tallied = (tally: Tally, event: typeof Event.Event.Type) =>
  Event.Event.match(event, {
    EntitiesChanged: ({ entities }) => {
      const { floors, liquids, others } = split(entities);

      return {
        ...tally,
        changed: tally.changed + others,
        floorsChanged: tally.floorsChanged + floors,
        liquidsChanged: tally.liquidsChanged + liquids,
      };
    },
    EntitiesPlaced: ({ entities }) => {
      const { floors, liquids, others } = split(entities);

      return {
        ...tally,
        floorsPlaced: tally.floorsPlaced + floors,
        liquidsPlaced: tally.liquidsPlaced + liquids,
        placed: tally.placed + others,
      };
    },
    EntitiesRemoved: ({ entities }) => {
      const { floors, liquids, others } = split(entities);

      return {
        ...tally,
        floorsRemoved: tally.floorsRemoved + floors,
        liquidsRemoved: tally.liquidsRemoved + liquids,
        removed: tally.removed + others,
      };
    },
    EntityMoved: () => ({ ...tally, moved: tally.moved + 1 }),
  }) satisfies Tally;

const part = (count: number, words: (count: number) => string) =>
  count > 0 ? [words(count)] : [];

/** What the events did in total, as one sentence. */
export const totals = (events: readonly (typeof Event.Event.Type)[]) => {
  const tally = Arr.reduce(events, none, tallied);

  const parts = [
    ...part(tally.floorsPlaced, (n) => `placed floors on ${cellsWord(n)}`),
    ...part(tally.floorsChanged, (n) => `changed the floor of ${cellsWord(n)}`),
    ...part(tally.floorsRemoved, (n) => `removed the floor of ${cellsWord(n)}`),
    ...part(tally.liquidsPlaced, (n) => `placed liquids on ${cellsWord(n)}`),
    ...part(
      tally.liquidsChanged,
      (n) => `changed the liquid of ${cellsWord(n)}`
    ),
    ...part(
      tally.liquidsRemoved,
      (n) => `removed liquids from ${cellsWord(n)}`
    ),
    ...part(tally.removed, (n) => `removed ${entitiesWord(n)}`),
    ...part(tally.placed, (n) => `placed ${entitiesWord(n)}`),
    ...part(tally.moved, (n) => `moved ${entitiesWord(n)}`),
    ...part(tally.changed, (n) => `changed ${entitiesWord(n)}`),
  ];

  return `${Str.capitalize(joined(parts))}.`;
};
