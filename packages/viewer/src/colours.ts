import type { Colour } from "@agent-crossing/world/values";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Str from "effect/String";

export const palette: Readonly<Record<Colour, string>> = {
  blue: "#6fa8f2",
  green: "#6cc98a",
  orange: "#ffad5c",
  pink: "#ff9ec7",
  purple: "#b48cf0",
  red: "#f2665e",
  white: "#fbf7ef",
  yellow: "#ffd84d",
};

const HASH_SEED = 7;
const HASH_MULTIPLIER = 31;
const HASH_MODULUS = 1_000_003;
const HUE_TURN = 360;

export const nameHash = (name: string) =>
  Arr.reduce(
    Arr.fromIterable(name),
    HASH_SEED,
    (hash, character) =>
      (hash * HASH_MULTIPLIER +
        Option.getOrElse(Str.codePointAt(character, 0), () => 0)) %
      HASH_MODULUS
  );

export const hueOf = (username: string) => nameHash(username) % HUE_TURN;

export const characterColour = (username: string) =>
  `hsl(${hueOf(username)}, 62%, 60%)`;

export const characterShade = (username: string) =>
  `hsl(${hueOf(username)}, 45%, 38%)`;
