import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Record from "effect/Record";
import * as Schema from "effect/Schema";

import { Entity, isSolid } from "./entity.ts";
import type { EntityId } from "./entity.ts";
import { sameTile, tileIndex } from "./grid.ts";
import type { Tile } from "./grid.ts";
import { isLand } from "./terrain.ts";
import { DisplayName, Timestamp, Username } from "./values.ts";
import { Motion } from "./walk.ts";

export const Character = Schema.Struct({
  username: Username,
  displayName: DisplayName,
  present: Schema.Boolean,
  motion: Motion,
});

export type Character = typeof Character.Type;

export const World = Schema.Struct({
  characters: Schema.Record(Schema.String, Character),
  entities: Schema.Record(Schema.String, Entity),
  entitiesCreated: Schema.Natural,
});

export type World = typeof World.Type;

export const emptyWorld: World = {
  characters: {},
  entities: {},
  entitiesCreated: 0,
};

export const characterOf = (world: World, username: Username) =>
  Record.get(world.characters, username);

export const entityOf = (world: World, id: EntityId) =>
  Record.get(world.entities, id);

export const entityCount = (world: World) => Record.size(world.entities);

export const allEntities = (world: World) => Record.values(world.entities);

export const allCharacters = (world: World) => Record.values(world.characters);

export const presentCharacters = (world: World) =>
  Arr.filter(allCharacters(world), (character) => character.present);

export const groundTileOf = (entity: Entity) =>
  entity.location._tag === "Ground"
    ? Option.some(entity.location.tile)
    : Option.none<Tile>();

export const entityOnTile = (world: World, tile: Tile) =>
  Arr.findFirst(allEntities(world), (entity) =>
    Option.exists(groundTileOf(entity), (ground) => sameTile(ground, tile))
  );

export const carriedBy = (world: World, username: Username) =>
  Arr.findFirst(
    allEntities(world),
    (entity) =>
      entity.location._tag === "Carried" && entity.location.by === username
  );

export const solidEntityOnTile = (world: World, tile: Tile) =>
  Option.filter(entityOnTile(world, tile), (entity) => isSolid(entity.item));

export const solidTiles = (world: World) =>
  new Set(
    Arr.map(
      Arr.getSomes(
        Arr.map(
          Arr.filter(allEntities(world), (entity) => isSolid(entity.item)),
          groundTileOf
        )
      ),
      tileIndex
    )
  );

export const isWalkable = (world: World, tile: Tile) =>
  isLand(tile) && Option.isNone(solidEntityOnTile(world, tile));

export const Session = Schema.Struct({
  openStreams: Schema.Natural,
  activeAt: Timestamp,
});

export type Session = typeof Session.Type;

export const Server = Schema.Struct({
  world: World,
  sessions: Schema.Record(Schema.String, Session),
});

export type Server = typeof Server.Type;

export const emptyServer: Server = { sessions: {}, world: emptyWorld };
