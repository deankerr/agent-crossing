import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Record from "effect/Record";

import { Location } from "./entity.ts";
import type { EntityId } from "./entity.ts";
import { WorldEvent } from "./event.ts";
import type { Tile } from "./grid.ts";
import { displayNameOf } from "./values.ts";
import type { Username } from "./values.ts";
import { Motion, standingAt } from "./walk.ts";
import { characterOf } from "./world.ts";
import type { Character, World } from "./world.ts";

export const appearedCharacter = (
  existing: Option.Option<Character>,
  actor: Username,
  tile: Tile
) =>
  ({
    displayName: Option.match(existing, {
      onNone: () => displayNameOf(actor),
      onSome: (character) => character.displayName,
    }),
    motion: standingAt(tile),
    present: true,
    username: actor,
  }) satisfies Character;

const updateCharacter = (
  world: World,
  username: Username,
  update: (character: Character) => Character
) =>
  ({
    ...world,
    characters: Record.modify(world.characters, username, update).pipe(
      Option.getOrElse(() => world.characters)
    ),
  }) satisfies World;

const relocateEntity = (world: World, id: EntityId, location: Location) =>
  ({
    ...world,
    entities: Record.modify(world.entities, id, (entity) => ({
      ...entity,
      location,
    })).pipe(Option.getOrElse(() => world.entities)),
  }) satisfies World;

export const evolve = (world: World, event: WorldEvent) => {
  const next: World = WorldEvent.match(event, {
    Appeared: ({ actor, tile }) => ({
      ...world,
      characters: Record.set(
        world.characters,
        actor,
        appearedCharacter(characterOf(world, actor), actor, tile)
      ),
    }),
    Created: ({ entity, item, tile }) => ({
      ...world,
      entities: Record.set(world.entities, entity, {
        id: entity,
        item,
        location: Location.cases.Ground.make({ tile }),
      }),
      entitiesCreated: world.entitiesCreated + 1,
    }),
    Destroyed: ({ entity }) => ({
      ...world,
      entities: Record.remove(world.entities, entity),
    }),
    PickedUp: ({ actor, entity }) =>
      relocateEntity(world, entity, Location.cases.Carried.make({ by: actor })),
    PutDown: ({ entity, tile }) =>
      relocateEntity(world, entity, Location.cases.Ground.make({ tile })),
    Renamed: ({ actor, displayName }) =>
      updateCharacter(world, actor, (character) => ({
        ...character,
        displayName,
      })),
    Said: () => world,
    Vanished: ({ actor, tile }) =>
      updateCharacter(world, actor, (character) => ({
        ...character,
        motion: standingAt(tile),
        present: false,
      })),
    WalkStarted: ({ actor, at, path }) =>
      updateCharacter(world, actor, (character) => ({
        ...character,
        motion: Motion.cases.Walking.make({ path, startedAt: at }),
      })),
  });

  return next;
};

export const evolveAll = (world: World, events: readonly WorldEvent[]) =>
  Arr.reduce(events, world, evolve);
