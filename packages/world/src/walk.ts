import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { neighbours, sameTile, Tile, tileIndex } from "./grid.ts";
import { canStep } from "./terrain.ts";
import { Timestamp } from "./values.ts";

export const TILES_PER_SECOND = 3;

export const Path = Schema.NonEmptyArray(Tile);

export type Path = typeof Path.Type;

export const Motion = Schema.TaggedUnion({
  Standing: { tile: Tile },
  Walking: { path: Path, startedAt: Timestamp },
});

export type Motion = typeof Motion.Type;

export const standingAt = (tile: Tile) => Motion.cases.Standing.make({ tile });

const stepsTaken = (startedAt: Timestamp, at: Timestamp) =>
  Math.max(0, Math.floor(((at - startedAt) * TILES_PER_SECOND) / 1000));

export const arrivalAt = (path: Path, startedAt: Timestamp) =>
  startedAt + Math.ceil(((path.length - 1) * 1000) / TILES_PER_SECOND);

export const positionAt = (motion: Motion, at: Timestamp) =>
  Motion.match(motion, {
    Standing: ({ tile }) => tile,
    Walking: ({ path, startedAt }) =>
      path[Math.min(path.length - 1, stepsTaken(startedAt, at))] ??
      Arr.lastNonEmpty(path),
  });

export interface WalkInProgress {
  readonly destination: Tile;
  readonly arrivesAt: Timestamp;
  readonly remaining: Path;
}

export const walkInProgressAt = (motion: Motion, at: Timestamp) => {
  if (motion._tag === "Standing") {
    return Option.none<WalkInProgress>();
  }

  const arrivesAt = arrivalAt(motion.path, motion.startedAt);
  const [here, ...ahead] = motion.path.slice(stepsTaken(motion.startedAt, at));

  return at < arrivesAt && here !== undefined
    ? Option.some<WalkInProgress>({
        arrivesAt,
        destination: Arr.lastNonEmpty(motion.path),
        remaining: Arr.prepend(ahead, here),
      })
    : Option.none<WalkInProgress>();
};

const traceBack = (cameFrom: ReadonlyMap<number, Tile>, to: Tile) => {
  const backwards: Arr.NonEmptyArray<Tile> = [to];
  let previous = cameFrom.get(tileIndex(to));

  while (previous !== undefined) {
    backwards.push(previous);
    previous = cameFrom.get(tileIndex(previous));
  }

  const path: Path = Arr.reverse(backwards);

  return path;
};

export const findPath = (
  from: Tile,
  to: Tile,
  isBlocked: (tile: Tile) => boolean
) => {
  const cameFrom = new Map<number, Tile>();
  const visited = new Set([tileIndex(from)]);
  const queue: Tile[] = [from];

  for (const tile of queue) {
    if (sameTile(tile, to)) {
      return Option.some(traceBack(cameFrom, to));
    }

    for (const next of neighbours(tile)) {
      const index = tileIndex(next);

      if (!visited.has(index) && !isBlocked(next) && canStep(tile, next)) {
        visited.add(index);
        cameFrom.set(index, tile);
        queue.push(next);
      }
    }
  }

  return Option.none<Path>();
};
