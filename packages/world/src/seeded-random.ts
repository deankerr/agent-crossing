const MODULUS = 2_147_483_647;
const MULTIPLIER = 48_271;

export interface SeededRandom {
  readonly next: () => number;
  readonly integer: (below: number) => number;
}

export const seededRandom = (seed: number) => {
  let state = (Math.abs(Math.trunc(seed)) % (MODULUS - 1)) + 1;

  const next = () => {
    state = (state * MULTIPLIER) % MODULUS;

    return (state - 1) / (MODULUS - 1);
  };

  return {
    integer: (below: number) => Math.floor(next() * below),
    next,
  } satisfies SeededRandom;
};
