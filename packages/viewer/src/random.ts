const MODULUS = 2_147_483_647;
const MULTIPLIER = 48_271;

export interface Random {
  readonly next: () => number;
  readonly integer: (below: number) => number;
  readonly pick: <A>(choices: readonly [A, ...A[]]) => A;
  readonly chance: (probability: number) => boolean;
  readonly state: () => number;
}

export const randomFrom = (seed: number) => {
  let state = (Math.abs(Math.trunc(seed)) % (MODULUS - 1)) + 1;

  const next = () => {
    state = (state * MULTIPLIER) % MODULUS;

    return (state - 1) / (MODULUS - 1);
  };

  const integer = (below: number) => Math.floor(next() * below);

  return {
    chance: (probability: number) => next() < probability,
    integer,
    next,
    pick: <A>(choices: readonly [A, ...A[]]) =>
      choices[integer(choices.length)] ?? choices[0],
    state: () => state,
  } satisfies Random;
};
