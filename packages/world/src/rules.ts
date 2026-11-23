import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";

import { Command } from "./command.ts";
import { ENTITY_LIMIT, entityIdFor } from "./entity.ts";
import type { EntityId, Item } from "./entity.ts";
import { WorldEvent } from "./event.ts";
import { appearedCharacter, evolve } from "./evolve.ts";
import {
  allTiles,
  centre,
  isAdjacent,
  manhattanDistance,
  sameTile,
  tileIndex,
} from "./grid.ts";
import type { Tile } from "./grid.ts";
import {
  AlreadyCarrying,
  CarryingNothing,
  CharacterInTheWay,
  EntityCarried,
  EntityLimitReached,
  NameTaken,
  NoPath,
  NotAdjacent,
  OnWalkersPath,
  StillWalking,
  TileIsWater,
  TileOccupied,
  UnknownEntity,
} from "./rejection.ts";
import type { Rejection } from "./rejection.ts";
import { isLand } from "./terrain.ts";
import { sameName } from "./values.ts";
import type { DisplayName, Text, Timestamp, Username } from "./values.ts";
import { findPath, positionAt, walkInProgressAt } from "./walk.ts";
import {
  allCharacters,
  carriedBy,
  characterOf,
  entityCount,
  entityOf,
  entityOnTile,
  occupiedTiles,
  presentCharacters,
} from "./world.ts";
import type { Character, World } from "./world.ts";

export type Decision = Result.Result<readonly WorldEvent[], Rejection>;

interface Scene {
  readonly world: World;
  readonly character: Character;
  readonly position: Tile;
  readonly now: Timestamp;
}

const isFreeLand = (world: World, tile: Tile) =>
  isLand(tile) && Option.isNone(entityOnTile(world, tile));

const byDistanceFrom = (origin: Tile) =>
  Order.combine(
    Order.mapInput(Order.Number, (tile: Tile) =>
      manhattanDistance(tile, origin)
    ),
    Order.mapInput(Order.Number, tileIndex)
  );

export const nearestFreeLand = (world: World, origin: Tile) =>
  Arr.match(
    Arr.filter(allTiles, (tile) => isFreeLand(world, tile)),
    {
      onEmpty: () => origin,
      onNonEmpty: (free) => Arr.min(free, byDistanceFrom(origin)),
    }
  );

const arrive = (world: World, actor: Username, now: Timestamp) => {
  const existing = characterOf(world, actor);

  if (Option.isSome(existing) && existing.value.present) {
    const scene: Scene = {
      character: existing.value,
      now,
      position: positionAt(existing.value.motion, now),
      world,
    };

    return { appeared: Arr.empty<WorldEvent>(), scene };
  }

  const tile = nearestFreeLand(
    world,
    Option.match(existing, {
      onNone: () => centre,
      onSome: (character) => positionAt(character.motion, now),
    })
  );

  const appeared = WorldEvent.cases.Appeared.make({ actor, at: now, tile });

  const scene: Scene = {
    character: appearedCharacter(existing, actor, tile),
    now,
    position: tile,
    world: evolve(world, appeared),
  };

  return { appeared: Arr.of<WorldEvent>(appeared), scene };
};

const acting = (
  world: World,
  actor: Username,
  now: Timestamp,
  act: (scene: Scene) => Decision
) => {
  const { appeared, scene } = arrive(world, actor, now);

  const decision: Decision = Result.map(act(scene), (events) =>
    Arr.appendAll(appeared, events)
  );

  return decision;
};

const ensureStanding = (scene: Scene) =>
  Option.match(walkInProgressAt(scene.character.motion, scene.now), {
    onNone: () => Result.void,
    onSome: (walk) =>
      Result.fail(
        new StillWalking({
          arrivesAt: walk.arrivesAt,
          destination: walk.destination,
        })
      ),
  });

const ensureAdjacent = (scene: Scene, target: Tile) =>
  isAdjacent(scene.position, target)
    ? Result.void
    : Result.fail(new NotAdjacent({ position: scene.position, target }));

const ensureEnterable = (world: World, tile: Tile) =>
  isLand(tile)
    ? Option.match(entityOnTile(world, tile), {
        onNone: () => Result.void,
        onSome: (entity) => Result.fail(new TileOccupied({ entity, tile })),
      })
    : Result.fail(new TileIsWater({ tile }));

const ensureNobodyStandsOn = (scene: Scene, tile: Tile) =>
  Option.match(
    Arr.findFirst(presentCharacters(scene.world), (character) =>
      sameTile(positionAt(character.motion, scene.now), tile)
    ),
    {
      onNone: () => Result.void,
      onSome: (standing) =>
        Result.fail(
          new CharacterInTheWay({ character: standing.username, tile })
        ),
    }
  );

const ensureNoWalkerHeadsThrough = (scene: Scene, tile: Tile) =>
  Option.match(
    Arr.findFirst(presentCharacters(scene.world), (character) =>
      Option.flatMap(walkInProgressAt(character.motion, scene.now), (walk) =>
        Arr.some(walk.remaining, (step) => sameTile(step, tile))
          ? Option.some(
              new OnWalkersPath({
                arrivesAt: walk.arrivesAt,
                tile,
                walker: character.username,
              })
            )
          : Option.none()
      )
    ),
    { onNone: () => Result.void, onSome: Result.fail }
  );

const ensurePlaceable = (scene: Scene, tile: Tile) =>
  Result.gen(function* () {
    yield* ensureEnterable(scene.world, tile);
    yield* ensureNobodyStandsOn(scene, tile);
    yield* ensureNoWalkerHeadsThrough(scene, tile);
  });

const ensureCarryingNothing = (scene: Scene) =>
  Option.match(carriedBy(scene.world, scene.character.username), {
    onNone: () => Result.void,
    onSome: (carrying) => Result.fail(new AlreadyCarrying({ carrying })),
  });

const carriedEntity = (scene: Scene) =>
  Option.match(carriedBy(scene.world, scene.character.username), {
    onNone: () => Result.fail(new CarryingNothing()),
    onSome: Result.succeed,
  });

const groundedEntity = (world: World, id: EntityId) =>
  Option.match(entityOf(world, id), {
    onNone: () => Result.fail(new UnknownEntity({ entity: id })),
    onSome: ({ location }) =>
      location._tag === "Ground"
        ? Result.succeed(location.tile)
        : Result.fail(
            new EntityCarried({ carriedBy: location.by, entity: id })
          ),
  });

const move = (scene: Scene, to: Tile) =>
  Result.gen(function* () {
    yield* ensureStanding(scene);
    yield* ensureEnterable(scene.world, to);
    const occupied = occupiedTiles(scene.world);

    const path = yield* Option.match(
      findPath(scene.position, to, (tile) => occupied.has(tileIndex(tile))),
      {
        onNone: () => Result.fail(new NoPath({ from: scene.position, to })),
        onSome: Result.succeed,
      }
    );

    return [
      WorldEvent.cases.WalkStarted.make({
        actor: scene.character.username,
        at: scene.now,
        path,
      }),
    ];
  });

const pickUp = (scene: Scene, entity: EntityId) =>
  Result.gen(function* () {
    yield* ensureStanding(scene);
    yield* ensureCarryingNothing(scene);
    const tile = yield* groundedEntity(scene.world, entity);
    yield* ensureAdjacent(scene, tile);

    return [
      WorldEvent.cases.PickedUp.make({
        actor: scene.character.username,
        at: scene.now,
        entity,
        tile,
      }),
    ];
  });

const putDown = (scene: Scene, tile: Tile) =>
  Result.gen(function* () {
    yield* ensureStanding(scene);
    const carrying = yield* carriedEntity(scene);
    yield* ensureAdjacent(scene, tile);
    yield* ensurePlaceable(scene, tile);

    return [
      WorldEvent.cases.PutDown.make({
        actor: scene.character.username,
        at: scene.now,
        entity: carrying.id,
        tile,
      }),
    ];
  });

const ensureBelowEntityLimit = (world: World) =>
  entityCount(world) < ENTITY_LIMIT
    ? Result.void
    : Result.fail(new EntityLimitReached({ limit: ENTITY_LIMIT }));

const create = (scene: Scene, tile: Tile, item: Item) =>
  Result.gen(function* () {
    yield* ensureStanding(scene);
    yield* ensureBelowEntityLimit(scene.world);
    yield* ensureAdjacent(scene, tile);
    yield* ensurePlaceable(scene, tile);

    return [
      WorldEvent.cases.Created.make({
        actor: scene.character.username,
        at: scene.now,
        entity: entityIdFor(scene.world.entitiesCreated + 1),
        item,
        tile,
      }),
    ];
  });

const destroy = (scene: Scene, entity: EntityId) =>
  Result.gen(function* () {
    yield* ensureStanding(scene);
    const tile = yield* groundedEntity(scene.world, entity);
    yield* ensureAdjacent(scene, tile);

    return [
      WorldEvent.cases.Destroyed.make({
        actor: scene.character.username,
        at: scene.now,
        entity,
        tile,
      }),
    ];
  });

const rename = (scene: Scene, displayName: DisplayName) =>
  Option.match(
    Arr.findFirst(
      allCharacters(scene.world),
      (other) =>
        other.username !== scene.character.username &&
        (sameName(other.displayName, displayName) ||
          sameName(other.username, displayName))
    ),
    {
      onNone: () =>
        Result.succeed([
          WorldEvent.cases.Renamed.make({
            actor: scene.character.username,
            at: scene.now,
            displayName,
            tile: scene.position,
          }),
        ]),
      onSome: (holder) =>
        Result.fail(new NameTaken({ displayName, takenBy: holder.username })),
    }
  );

const say = (scene: Scene, text: Text) =>
  Result.succeed([
    WorldEvent.cases.Said.make({
      actor: scene.character.username,
      at: scene.now,
      text,
      tile: scene.position,
    }),
  ]);

const nothingMore = () => Result.succeed(Arr.empty<WorldEvent>());

export const decide = (world: World, command: Command, now: Timestamp) => {
  const decision: Decision = Command.match(command, {
    Create: ({ actor, item, tile }) =>
      acting(world, actor, now, (scene) => create(scene, tile, item)),
    Destroy: ({ actor, entity }) =>
      acting(world, actor, now, (scene) => destroy(scene, entity)),
    Look: ({ actor }) => acting(world, actor, now, nothingMore),
    Move: ({ actor, to }) =>
      acting(world, actor, now, (scene) => move(scene, to)),
    PickUp: ({ actor, entity }) =>
      acting(world, actor, now, (scene) => pickUp(scene, entity)),
    PutDown: ({ actor, tile }) =>
      acting(world, actor, now, (scene) => putDown(scene, tile)),
    Rename: ({ actor, name }) =>
      acting(world, actor, now, (scene) => rename(scene, name)),
    Say: ({ actor, text }) =>
      acting(world, actor, now, (scene) => say(scene, text)),
    StreamClosed: nothingMore,
    StreamOpened: ({ actor }) => acting(world, actor, now, nothingMore),
  });

  return decision;
};
