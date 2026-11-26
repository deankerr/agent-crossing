import * as Cell from "@agent-crossing/world/Cell";
import * as Entity from "@agent-crossing/world/Entity";
import * as Event from "@agent-crossing/world/Event";
import * as Arr from "effect/Array";

import { article, cellsWord, entitiesWord, nounOf } from "./internal/words.ts";

type Present = typeof Entity.Entity.Type;

type Entities = readonly [Present, ...Present[]];

const onlyNoun = (entities: Entities) => {
  const nouns = Arr.dedupe(Arr.map(entities, nounOf));

  return nouns.length === 1 ? nouns[0] : undefined;
};

const across = (entities: Entities, preposition: string) =>
  entities.length === 1
    ? `at ${Cell.format(entities[0].cell)}`
    : `${preposition} ${cellsWord(entities.length)}`;

const placedTerrain = (entities: Entities, many: string) =>
  `Placed ${onlyNoun(entities) ?? many} ${across(entities, "on")}`;

const placed = (entities: Entities) => {
  if (Arr.every(entities, Entity.isFloor)) {
    return placedTerrain(entities, "floors");
  }

  if (Arr.every(entities, Entity.isLiquid)) {
    return placedTerrain(entities, "liquids");
  }

  return entities.length === 1
    ? `Placed ${article(nounOf(entities[0]))} at ${Cell.format(entities[0].cell)}`
    : `Placed ${entitiesWord(entities.length)}`;
};

const changed = (entities: Entities) => {
  if (Arr.every(entities, Entity.isFloor)) {
    return `Changed the floor ${across(entities, "of")}`;
  }

  if (Arr.every(entities, Entity.isLiquid)) {
    return `Changed the liquid ${across(entities, "of")}`;
  }

  return entities.length === 1
    ? `Changed ${entities[0].id}`
    : `Changed ${entitiesWord(entities.length)}`;
};

const removed = (entities: Entities) => {
  if (Arr.every(entities, Entity.isFloor)) {
    return `Removed the floor ${across(entities, "of")}`;
  }

  if (Arr.every(entities, Entity.isLiquid)) {
    return `Removed the ${onlyNoun(entities) ?? "liquid"} ${across(entities, "from")}`;
  }

  return entities.length === 1
    ? `Removed ${entities[0].id}`
    : `Removed ${entitiesWord(entities.length)}`;
};

/** One event as a sentence, without its full stop. */
export const sentence = (event: typeof Event.Event.Type) =>
  Event.Event.match(event, {
    EntitiesChanged: ({ entities }) => changed(entities),
    EntitiesPlaced: ({ entities }) => placed(entities),
    EntitiesRemoved: ({ entities }) => removed(entities),
    EntityMoved: ({ entity }) =>
      `Moved ${entity.id} to ${Cell.format(entity.cell)}`,
  });
