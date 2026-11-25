import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Str from "effect/String";

const HASH_SEED = 7;
const HASH_MULTIPLIER = 31;
const HASH_MODULUS = 2_147_483_647;
const SCATTER = 43_758.5453;
const SALT_STEP = 78.233;
const X_STEP = 12.9898;
const Y_STEP = 78.233;

const fraction = (value: number) => value - Math.floor(value);

const scatter = (value: number) => fraction(Math.sin(value) * SCATTER);

const hashText = (text: string) =>
  Arr.reduce(
    Arr.fromIterable(text),
    HASH_SEED,
    (hash, character) =>
      (hash * HASH_MULTIPLIER +
        Option.getOrElse(Str.codePointAt(character, 0), () => 0)) %
      HASH_MODULUS
  );

/** A number in [0, 1) that depends only on `text` and `salt`. */
export const unitOf = (text: string, salt = 0) =>
  scatter((hashText(text) % 100_003) + salt * SALT_STEP + 0.5);

/** A number in [0, 1) that depends only on the cell's coordinates. */
export const cellNoise = (x: number, y: number) =>
  scatter(x * X_STEP + y * Y_STEP);
