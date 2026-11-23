import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

export const MAP_SIZE = 32;

export const Coordinate = Schema.Int.check(
  Schema.isBetween({ maximum: MAP_SIZE - 1, minimum: 0 })
).pipe(Schema.brand("Coordinate"));

export type Coordinate = typeof Coordinate.Type;

export const Tile = Schema.Struct({ x: Coordinate, y: Coordinate });

export type Tile = typeof Tile.Type;

export const tileIndex = (tile: Tile) => tile.y * MAP_SIZE + tile.x;

export const allTiles: readonly Tile[] = Arr.makeBy(
  MAP_SIZE * MAP_SIZE,
  (index) =>
    Tile.make({
      x: Coordinate.make(index % MAP_SIZE),
      y: Coordinate.make(Math.floor(index / MAP_SIZE)),
    })
);

export const tileAt = (x: number, y: number) =>
  x >= 0 && x < MAP_SIZE && y >= 0 && y < MAP_SIZE
    ? Arr.get(allTiles, y * MAP_SIZE + x)
    : Option.none<Tile>();

export const centre: Tile = Tile.make({
  x: Coordinate.make(MAP_SIZE / 2),
  y: Coordinate.make(MAP_SIZE / 2),
});

const STEPS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

const neighbourTable: readonly (readonly Tile[])[] = Arr.map(allTiles, (tile) =>
  Arr.getSomes(Arr.map(STEPS, ([dx, dy]) => tileAt(tile.x + dx, tile.y + dy)))
);

export const neighbours = (tile: Tile) => neighbourTable[tileIndex(tile)] ?? [];

export const sameTile = (a: Tile, b: Tile) => a.x === b.x && a.y === b.y;

export const manhattanDistance = (a: Tile, b: Tile) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export const chebyshevDistance = (a: Tile, b: Tile) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export const isAdjacent = (a: Tile, b: Tile) => manhattanDistance(a, b) === 1;
