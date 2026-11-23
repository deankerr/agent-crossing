import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { Command } from "../src/command.ts";
import { entityIdFor, Item } from "../src/entity.ts";
import { WorldEvent } from "../src/event.ts";
import { evolveAll } from "../src/evolve.ts";
import { allTiles, Coordinate, neighbours, Tile } from "../src/grid.ts";
import { execute } from "../src/presence.ts";
import type { Outcome } from "../src/presence.ts";
import { canStep, isLand } from "../src/terrain.ts";
import { Text, Username } from "../src/values.ts";
import type { Colour } from "../src/values.ts";
import { emptyServer, emptyWorld } from "../src/world.ts";
import type { Server, World } from "../src/world.ts";

export const tile = (x: number, y: number) =>
  Tile.make({ x: Coordinate.make(x), y: Coordinate.make(y) });

export const alice = Username.make("alice");
export const bob = Username.make("bob");
export const carol = Username.make("carol");

export const text = (words: string) => Text.make(words);

export const block = (colour: Colour = "red") =>
  Item.cases.Block.make({ colour });

export const flower = (colour: Colour = "pink") =>
  Item.cases.Flower.make({ colour });

export const sign = (words = "hello") =>
  Item.cases.Sign.make({ text: Text.make(words) });

export const steppableNeighbour = (from: Tile) =>
  Option.getOrThrow(
    Arr.findFirst(neighbours(from), (next) => canStep(from, next))
  );

export const shoreline = Option.getOrThrow(
  Arr.findFirst(
    allTiles,
    (candidate) =>
      isLand(candidate) &&
      Arr.some(neighbours(candidate), (next) => !isLand(next))
  )
);

export const waterBeside = (land: Tile) =>
  Option.getOrThrow(Arr.findFirst(neighbours(land), (next) => !isLand(next)));

export const appeared = (actor: Username, where: Tile, atTime = 0) =>
  WorldEvent.cases.Appeared.make({ actor, at: atTime, tile: where });

export const created = (
  where: Tile,
  serial: number,
  atTime = 0,
  item: Item = block()
) =>
  WorldEvent.cases.Created.make({
    actor: alice,
    at: atTime,
    entity: entityIdFor(serial),
    item,
    tile: where,
  });

export const worldOf = (
  events: readonly WorldEvent[],
  base: World = emptyWorld
) => evolveAll(base, events);

export const serverOf = (world: World) =>
  ({ ...emptyServer, world }) satisfies Server;

export interface Played {
  readonly server: Server;
  readonly events: readonly WorldEvent[];
}

const nothingPlayed = (server: Server) => {
  const played: Played = { events: [], server };

  return played;
};

export const play = (
  steps: readonly (readonly [Command, number])[],
  from: Server = emptyServer
) =>
  Arr.reduce(steps, nothingPlayed(from), (sofar, [command, now]) => {
    const outcome: Outcome = Result.getOrThrow(
      execute(sofar.server, command, now)
    );

    return {
      events: Arr.appendAll(sofar.events, outcome.events),
      server: outcome.server,
    } satisfies Played;
  });

export const look = (actor: Username) => Command.cases.Look.make({ actor });

export const moveTo = (actor: Username, to: Tile) =>
  Command.cases.Move.make({ actor, to });

export const createAt = (
  actor: Username,
  where: Tile,
  colour: Colour = "red"
) => Command.cases.Create.make({ actor, item: block(colour), tile: where });
