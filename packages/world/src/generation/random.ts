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

/**
 * Picks one of the weighted options. Weights need not sum to one; the last
 * option is the fallback when every weight is zero.
 */
export const pickWeighted = <A>(
  random: SeededRandom,
  options: readonly (readonly [A, number])[],
  fallback: A
) => {
  let total = 0;

  for (const [, weight] of options) {
    total += weight;
  }

  let roll = random.next() * total;

  for (const [option, weight] of options) {
    if (roll < weight) {
      return option;
    }

    roll -= weight;
  }

  return fallback;
};
