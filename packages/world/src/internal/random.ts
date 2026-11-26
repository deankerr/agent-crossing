const MODULUS = 2_147_483_647;
const MULTIPLIER = 48_271;

export interface SeededRandom {
  /** A number in [0, 1). */
  readonly next: () => number;
  /** An integer in [0, below). */
  readonly integer: (below: number) => number;
  /** True with the given probability. */
  readonly chance: (probability: number) => boolean;
}

export const seededRandom = (seed: number) => {
  let state = (Math.abs(Math.trunc(seed)) % (MODULUS - 1)) + 1;

  const next = () => {
    state = (state * MULTIPLIER) % MODULUS;

    return (state - 1) / (MODULUS - 1);
  };

  return {
    chance: (probability: number) => next() < probability,
    integer: (below: number) => Math.floor(next() * below),
    next,
  } satisfies SeededRandom;
};
