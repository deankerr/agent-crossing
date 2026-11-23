import { entityIdFor, Item } from "@agent-crossing/world/entity";
import { WorldEvent } from "@agent-crossing/world/event";
import { Text, Username } from "@agent-crossing/world/values";
import { describe, expect, it } from "@effect/vitest";

import { clockTimeOf, describeItem, sentenceFor } from "../src/sentence.ts";
import { alice, bob, meadow, renamed, said, tile } from "./world.fixture.ts";

const at = 0;
const block = entityIdFor(1);

describe(sentenceFor, () => {
  it.each([
    [
      WorldEvent.cases.Appeared.make({ actor: bob, at, tile: tile(3, 4) }),
      "bob appeared at 3,4",
    ],
    [
      WorldEvent.cases.Created.make({
        actor: alice,
        at,
        entity: entityIdFor(2),
        item: Item.cases.Flower.make({ colour: "yellow" }),
        tile: tile(5, 6),
      }),
      "Mossy made a yellow flower at 5,6",
    ],
    [
      WorldEvent.cases.Created.make({
        actor: alice,
        at,
        entity: entityIdFor(2),
        item: Item.cases.Sign.make({ text: Text.make("Keep off the grass") }),
        tile: tile(5, 6),
      }),
      "Mossy put up a sign at 5,6: “Keep off the grass”",
    ],
    [
      WorldEvent.cases.PickedUp.make({
        actor: alice,
        at,
        entity: block,
        tile: tile(12, 9),
      }),
      "Mossy picked up a red block at 12,9",
    ],
    [
      WorldEvent.cases.PutDown.make({
        actor: alice,
        at,
        entity: block,
        tile: tile(12, 10),
      }),
      "Mossy put down a red block at 12,10",
    ],
    [
      WorldEvent.cases.Destroyed.make({
        actor: bob,
        at,
        entity: block,
        tile: tile(12, 9),
      }),
      "bob cleared away a red block at 12,9",
    ],
    [renamed(alice, "Fern"), "Mossy is now called Fern"],
    [said(alice, "Lovely day"), "Mossy says: Lovely day"],
    [
      WorldEvent.cases.Vanished.make({ actor: bob, at, tile: tile(17, 16) }),
      "bob vanished at 17,16",
    ],
    [
      WorldEvent.cases.WalkStarted.make({
        actor: alice,
        at,
        path: [tile(16, 16), tile(16, 17)],
      }),
      "Mossy set off for 16,17",
    ],
  ])("describes %s", (event, sentence) => {
    expect(sentenceFor(event, meadow)).toBe(sentence);
  });

  it("falls back to the username for a stranger", () => {
    expect(sentenceFor(said(Username.make("stranger"), "hi"), meadow)).toBe(
      "stranger says: hi"
    );
  });
});

describe(describeItem, () => {
  it("names items with their colour", () => {
    expect(describeItem(Item.cases.Block.make({ colour: "blue" }))).toBe(
      "a blue block"
    );
    expect(describeItem(Item.cases.Sign.make({ text: Text.make("Hi") }))).toBe(
      "a sign"
    );
  });
});

describe(clockTimeOf, () => {
  it("shows hours, minutes and seconds", () => {
    expect(clockTimeOf(1_764_000_000_000)).toMatch(/^\d{2}:\d{2}:\d{2}$/u);
  });
});
