import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Schema from "effect/Schema";

import { EntityId, entitySerial, Item } from "./entity.ts";
import { tilesOf } from "./event.ts";
import type { WorldEvent } from "./event.ts";
import { chebyshevDistance, Tile } from "./grid.ts";
import { DisplayName, Timestamp, Username } from "./values.ts";
import { positionAt, walkInProgressAt } from "./walk.ts";
import {
  allEntities,
  carriedBy,
  characterOf,
  presentCharacters,
} from "./world.ts";
import type { Character, World } from "./world.ts";

export const PERCEPTION_RADIUS = 8;

export const isWithinPerception = (observer: Tile, tile: Tile) =>
  chebyshevDistance(observer, tile) <= PERCEPTION_RADIUS;

export const CarriedView = Schema.Struct({ id: EntityId, item: Item });

export type CarriedView = typeof CarriedView.Type;

export const WalkView = Schema.Struct({
  destination: Tile,
  arrivesAt: Timestamp,
});

export type WalkView = typeof WalkView.Type;

export const CharacterView = Schema.Struct({
  username: Username,
  displayName: DisplayName,
  tile: Tile,
  carrying: Schema.NullOr(CarriedView),
  walking: Schema.NullOr(WalkView),
});

export type CharacterView = typeof CharacterView.Type;

export const EntityView = Schema.Struct({
  id: EntityId,
  item: Item,
  tile: Tile,
});

export type EntityView = typeof EntityView.Type;

export const Observation = Schema.Struct({
  at: Timestamp,
  self: Schema.Struct({ ...CharacterView.fields, present: Schema.Boolean }),
  characters: Schema.Array(CharacterView),
  entities: Schema.Array(EntityView),
});

export type Observation = typeof Observation.Type;

const viewOf = (world: World, character: Character, at: Timestamp) =>
  ({
    carrying: Option.getOrNull(
      Option.map(carriedBy(world, character.username), ({ id, item }) => ({
        id,
        item,
      }))
    ),
    displayName: character.displayName,
    tile: positionAt(character.motion, at),
    username: character.username,
    walking: Option.getOrNull(
      Option.map(walkInProgressAt(character.motion, at), (walk) => ({
        arrivesAt: walk.arrivesAt,
        destination: walk.destination,
      }))
    ),
  }) satisfies CharacterView;

const byUsername = Order.mapInput(
  Order.String,
  (view: CharacterView) => view.username
);

const byEntitySerial = Order.mapInput(Order.Number, (view: EntityView) =>
  entitySerial(view.id)
);

export const observe = (world: World, username: Username, at: Timestamp) =>
  Option.map(characterOf(world, username), (character) => {
    const here = positionAt(character.motion, at);

    const sees = (tile: Tile) =>
      character.present && isWithinPerception(here, tile);

    const others = Arr.filter(
      presentCharacters(world),
      (other) => other.username !== username
    );

    const observation: Observation = {
      at,
      characters: Arr.sort(
        Arr.filter(
          Arr.map(others, (other) => viewOf(world, other, at)),
          (view) => sees(view.tile)
        ),
        byUsername
      ),
      entities: Arr.sort(
        Arr.flatMap(allEntities(world), ({ id, item, location }) =>
          location._tag === "Ground" && sees(location.tile)
            ? [{ id, item, tile: location.tile }]
            : []
        ),
        byEntitySerial
      ),
      self: { ...viewOf(world, character, at), present: character.present },
    };

    return observation;
  });

export const isPerceivable = (
  world: World,
  observer: Username,
  event: WorldEvent
) =>
  Option.exists(characterOf(world, observer), (character) => {
    const here = positionAt(character.motion, event.at);

    return (
      character.present &&
      Arr.some(tilesOf(event), (tile) => isWithinPerception(here, tile))
    );
  });
