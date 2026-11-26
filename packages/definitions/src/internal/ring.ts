import * as Arr from "effect/Array";

const TURN = Math.PI * 2;

/** `count` points evenly spaced on a circle of `radius`, as `x` and `z`. */
export const ring = (count: number, radius: number, phase = 0) =>
  Arr.makeBy(count, (index) => {
    const angle = phase + (index / count) * TURN;

    return [Math.cos(angle) * radius, Math.sin(angle) * radius] as const;
  });
