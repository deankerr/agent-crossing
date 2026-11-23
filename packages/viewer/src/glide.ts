import type { Tile } from "@agent-crossing/world/grid";
import { TILES_PER_SECOND } from "@agent-crossing/world/walk";
import type { Motion } from "@agent-crossing/world/walk";

export interface Placement {
  readonly x: number;
  readonly y: number;
  readonly level: number;
  readonly heading: number;
  readonly walking: boolean;
  readonly stride: number;
}

export const FACING_VIEWER = 0;

const TURN_SHARE = 0.25;

const smoothstep = (t: number) => t * t * (3 - 2 * t);

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

export const headingOf = (from: Tile, to: Tile) =>
  Math.atan2(to.x - from.x, to.y - from.y);

export const turnBetween = (from: number, to: number, share: number) => {
  const difference = Math.atan2(Math.sin(to - from), Math.cos(to - from));

  return from + difference * share;
};

interface Corner {
  readonly before: Tile | undefined;
  readonly from: Tile;
  readonly to: Tile;
  readonly after: Tile | undefined;
  readonly share: number;
}

const cornerHeading = ({ after, before, from, share, to }: Corner) => {
  const heading = headingOf(from, to);

  if (before !== undefined && share < TURN_SHARE) {
    return turnBetween(
      headingOf(before, from),
      heading,
      smoothstep(0.5 + share / TURN_SHARE / 2)
    );
  }

  if (after !== undefined && share > 1 - TURN_SHARE) {
    return turnBetween(
      heading,
      headingOf(to, after),
      smoothstep((share - (1 - TURN_SHARE)) / TURN_SHARE / 2)
    );
  }

  return heading;
};

export const progressAlong = (steps: number, startedAt: number, at: number) =>
  clamp(((at - startedAt) * TILES_PER_SECOND) / 1000, 0, steps);

export const placementAt = (
  motion: Motion,
  at: number,
  levelOf: (tile: Tile) => number
) => {
  if (motion._tag === "Standing" || motion.path.length < 2) {
    const tile = motion._tag === "Standing" ? motion.tile : motion.path[0];

    const standing: Placement = {
      heading: FACING_VIEWER,
      level: levelOf(tile),
      stride: 0,
      walking: false,
      x: tile.x,
      y: tile.y,
    };

    return standing;
  }

  const { path, startedAt } = motion;
  const steps = path.length - 1;
  const progress = progressAlong(steps, startedAt, at);
  const step = Math.min(Math.floor(progress), steps - 1);
  const share = progress - step;
  const from = path[step] ?? path[0];
  const to = path[step + 1] ?? from;
  const before = path[step - 1];
  const after = path[step + 2];
  const turning = cornerHeading({ after, before, from, share, to });

  const fromLevel = levelOf(from);
  const toLevel = levelOf(to);

  const walking: Placement = {
    heading: turning,
    level: fromLevel + (toLevel - fromLevel) * smoothstep(share),
    stride: progress,
    walking: progress < steps,
    x: from.x + (to.x - from.x) * share,
    y: from.y + (to.y - from.y) * share,
  };

  return walking;
};
