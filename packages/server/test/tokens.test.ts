import { Username } from "@agent-crossing/world/values";
import { describe, expect, it } from "@effect/vitest";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import {
  bearerToken,
  characterFor,
  parseCharacters,
  reservedBy,
} from "../src/tokens.ts";

const ALICE_TOKEN = "alice-token-0123456789";
const BOB_TOKEN = "bob-token-0123456789ab";
const alice = Username.make("alice");
const bob = Username.make("bob");

const parsed = Result.getOrThrow(
  parseCharacters(`alice:${ALICE_TOKEN}, bob : ${BOB_TOKEN}\n`)
);

const failureOf = (text: string) =>
  Result.match(parseCharacters(text), {
    onFailure: (error) => error.message,
    onSuccess: () => "parsed",
  });

describe("tokens", () => {
  it("parses comma- or newline-separated username:token pairs", () => {
    expect(parsed.usernames).toStrictEqual([alice, bob]);
    expect(HashMap.size(parsed.byToken)).toBe(2);
  });

  it("finds the character for a bearer token and nothing for others", () => {
    expect(characterFor(parsed, `Bearer ${BOB_TOKEN}`)).toStrictEqual(
      Option.some(bob)
    );
    expect(characterFor(parsed, `bearer   ${ALICE_TOKEN}`)).toStrictEqual(
      Option.some(alice)
    );
    expect(
      characterFor(parsed, "Bearer not-a-known-token-at-all")
    ).toStrictEqual(Option.none());
  });

  it("finds nothing without a well-formed bearer header", () => {
    expect(characterFor(parsed, ALICE_TOKEN)).toStrictEqual(Option.none());
    expect(characterFor(parsed, undefined)).toStrictEqual(Option.none());
    expect(bearerToken("Bearer short")).toStrictEqual(Option.none());
  });

  it("fails loudly on malformed configuration", () => {
    expect(failureOf("")).toContain("names no characters");
    expect(failureOf("alice")).toContain("has no colon");
    expect(failureOf("alice:short")).toContain("token for alice");
    expect(failureOf(`:${ALICE_TOKEN}`)).toContain("username");
  });

  it("refuses clashing usernames or tokens", () => {
    expect(failureOf(`alice:${ALICE_TOKEN},Alice:${BOB_TOKEN}`)).toContain(
      "shares its username"
    );
    expect(failureOf(`alice:${ALICE_TOKEN},bob:${ALICE_TOKEN}`)).toContain(
      "shares its username (ignoring case) or its token"
    );
  });

  it("reserves every other configured username as a display name", () => {
    expect(reservedBy(parsed, "BOB", alice)).toStrictEqual(Option.some(bob));
    expect(reservedBy(parsed, "Alice", alice)).toStrictEqual(Option.none());
    expect(reservedBy(parsed, "Carol", alice)).toStrictEqual(Option.none());
  });
});
