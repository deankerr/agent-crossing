import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Str from "effect/String";

import { Command, decodeCommand } from "../src/command.ts";
import { ENTITY_LIMIT, entityIdFor, Location } from "../src/entity.ts";
import { WorldEvent } from "../src/event.ts";
import {
  allTiles,
  centre,
  chebyshevDistance,
  neighbours,
} from "../src/grid.ts";
import {
  AlreadyCarrying,
  CarryingNothing,
  CharacterInTheWay,
  EntityCarried,
  EntityLimitReached,
  NameTaken,
  NoPath,
  NotAdjacent,
  OnWalkersPath,
  StillWalking,
  TileIsWater,
  TileOccupied,
  UnknownEntity,
} from "../src/rejection.ts";
import { decide } from "../src/rules.ts";
import { isLand } from "../src/terrain.ts";
import { DisplayName } from "../src/values.ts";
import { carriedBy, entityCount, entityOf } from "../src/world.ts";
import {
  alice,
  appeared,
  block,
  bob,
  createAt,
  created,
  flower,
  look,
  moveTo,
  play,
  shoreline,
  sign,
  text,
  tile,
  waterBeside,
  worldOf,
} from "./world.fixture.ts";

const east = tile(17, 16);
const south = tile(16, 17);
const e1 = entityIdFor(1);
const e2 = entityIdFor(2);

const aliceAtCentre = worldOf([appeared(alice, centre)]);
const withBlockEast = worldOf([created(east, 1)], aliceAtCentre);

const aliceCarrying = worldOf(
  [
    WorldEvent.cases.PickedUp.make({
      actor: alice,
      at: 0,
      entity: e1,
      tile: east,
    }),
  ],
  withBlockEast
);

const aliceWalkingEast = worldOf(
  [
    WorldEvent.cases.WalkStarted.make({
      actor: alice,
      at: 0,
      path: [centre, east, tile(18, 16), tile(19, 16)],
    }),
  ],
  aliceAtCentre
);

const pickUp = (entity = e1) =>
  Command.cases.PickUp.make({ actor: alice, entity });

const putDown = (where = east) =>
  Command.cases.PutDown.make({ actor: alice, tile: where });

const destroy = (entity = e1) =>
  Command.cases.Destroy.make({ actor: alice, entity });

const say = (words: string) =>
  Command.cases.Say.make({ actor: alice, text: text(words) });

const rename = (name: string) =>
  Command.cases.Rename.make({ actor: alice, name: DisplayName.make(name) });

describe("arriving", () => {
  it("brings a newcomer to the centre before its first action", () => {
    expect(play([[look(alice), 5]]).events).toStrictEqual([
      appeared(alice, centre, 5),
    ]);
  });

  it("appears and then acts in one decision", () => {
    expect(decide(worldOf([]), say("hello"), 7)).toStrictEqual(
      Result.succeed([
        appeared(alice, centre, 7),
        WorldEvent.cases.Said.make({
          actor: alice,
          at: 7,
          text: text("hello"),
          tile: centre,
        }),
      ])
    );
  });

  it("places a newcomer on the nearest free land when the centre is taken", () => {
    const { events } = play([[look(bob), 0]], {
      sessions: {},
      world: worldOf([created(centre, 1)]),
    });

    expect(events).toStrictEqual([appeared(bob, tile(16, 15), 0)]);
  });

  it("lets a newcomer appear on a flower", () => {
    const { events } = play([[look(bob), 0]], {
      sessions: {},
      world: worldOf([created(centre, 1, 0, flower())]),
    });

    expect(events).toStrictEqual([appeared(bob, centre, 0)]);
  });
});

describe("walking", () => {
  it("starts a walk along a shortest path", () => {
    expect(decide(aliceAtCentre, moveTo(alice, tile(19, 16)), 0)).toStrictEqual(
      Result.succeed([
        WorldEvent.cases.WalkStarted.make({
          actor: alice,
          at: 0,
          path: [centre, east, tile(18, 16), tile(19, 16)],
        }),
      ])
    );
  });

  it.each([
    ["move", moveTo(alice, tile(10, 10))],
    ["create", createAt(alice, tile(17, 17))],
    ["pick up", pickUp()],
    ["put down", putDown(tile(17, 17))],
    ["destroy", destroy()],
  ] as const)("rejects %s while walking, giving the arrival", (_, command) => {
    expect(decide(aliceWalkingEast, command, 500)).toStrictEqual(
      Result.fail(
        new StillWalking({ arrivesAt: 1000, destination: tile(19, 16) })
      )
    );
  });

  it.each([
    ["say", say("on my way")],
    ["rename", rename("Walker")],
    ["look", look(alice)],
  ] as const)("lets a walker %s", (_, command) => {
    expect(
      Result.isSuccess(decide(aliceWalkingEast, command, 500))
    ).toBeTruthy();
  });

  it("accepts actions again on arrival", () => {
    expect(
      Result.isSuccess(decide(aliceWalkingEast, moveTo(alice, centre), 1000))
    ).toBeTruthy();
  });

  it("refuses water, occupied destinations and unreachable ones", () => {
    const water = waterBeside(shoreline);

    const walledIn = worldOf(
      Arr.map(neighbours(centre), (wall, index) => created(wall, index + 1)),
      aliceAtCentre
    );

    expect(decide(aliceAtCentre, moveTo(alice, water), 0)).toStrictEqual(
      Result.fail(new TileIsWater({ tile: water }))
    );
    expect(decide(withBlockEast, moveTo(alice, east), 0)).toStrictEqual(
      Result.fail(
        new TileOccupied({
          entity: Option.getOrThrow(entityOf(withBlockEast, e1)),
          tile: east,
        })
      )
    );
    expect(decide(walledIn, moveTo(alice, tile(20, 20)), 0)).toStrictEqual(
      Result.fail(new NoPath({ from: centre, to: tile(20, 20) }))
    );
  });
});

describe("solid entities", () => {
  const withFlowerEast = worldOf(
    [created(east, 1, 0, flower())],
    aliceAtCentre
  );

  it("walks through a flower", () => {
    expect(
      decide(withFlowerEast, moveTo(alice, tile(18, 16)), 0)
    ).toStrictEqual(
      Result.succeed([
        WorldEvent.cases.WalkStarted.make({
          actor: alice,
          at: 0,
          path: [centre, east, tile(18, 16)],
        }),
      ])
    );
  });

  it("stops on a flower", () => {
    expect(decide(withFlowerEast, moveTo(alice, east), 0)).toStrictEqual(
      Result.succeed([
        WorldEvent.cases.WalkStarted.make({
          actor: alice,
          at: 0,
          path: [centre, east],
        }),
      ])
    );
  });

  it.each([
    ["block", block()],
    ["sign", sign()],
  ] as const)("walks around a %s", (_, item) => {
    const blocked = worldOf([created(east, 1, 0, item)], aliceAtCentre);

    expect(decide(blocked, moveTo(alice, tile(18, 16)), 0)).toStrictEqual(
      Result.succeed([
        WorldEvent.cases.WalkStarted.make({
          actor: alice,
          at: 0,
          path: [
            centre,
            tile(16, 15),
            tile(17, 15),
            tile(18, 15),
            tile(18, 16),
          ],
        }),
      ])
    );
    expect(decide(blocked, moveTo(alice, east), 0)).toStrictEqual(
      Result.fail(
        new TileOccupied({
          entity: Option.getOrThrow(entityOf(blocked, e1)),
          tile: east,
        })
      )
    );
  });

  it("leaves a character ringed by flowers free to walk", () => {
    const ringed = worldOf(
      Arr.map(neighbours(centre), (around, index) =>
        created(around, index + 1, 0, flower())
      ),
      aliceAtCentre
    );

    expect(
      Result.isSuccess(decide(ringed, moveTo(alice, tile(20, 20)), 0))
    ).toBeTruthy();
  });

  it("will not create or put down on a flower", () => {
    const flowerAndBlock = worldOf(
      [created(tile(15, 16), 2, 0, block())],
      withFlowerEast
    );

    const holdingBlock = worldOf(
      [
        WorldEvent.cases.PickedUp.make({
          actor: alice,
          at: 0,
          entity: e2,
          tile: tile(15, 16),
        }),
      ],
      flowerAndBlock
    );

    const occupied = Result.fail(
      new TileOccupied({
        entity: Option.getOrThrow(entityOf(withFlowerEast, e1)),
        tile: east,
      })
    );

    expect(decide(withFlowerEast, createAt(alice, east), 0)).toStrictEqual(
      occupied
    );
    expect(decide(holdingBlock, putDown(east), 0)).toStrictEqual(occupied);
  });
});

describe("creating", () => {
  it("creates entities with ids counted from the state", () => {
    const { events } = play([
      [createAt(alice, east), 0],
      [createAt(alice, south, "blue"), 1],
    ]);

    expect(
      Arr.map(
        Arr.drop(events, 1),
        (event) => event._tag === "Created" && event.entity
      )
    ).toStrictEqual([e1, e2]);
  });

  it("keeps the counter going after destruction", () => {
    const { server } = play([
      [createAt(alice, east), 0],
      [destroy(), 1],
      [createAt(alice, east), 2],
    ]);

    expect(Option.isSome(entityOf(server.world, e2))).toBeTruthy();
    expect(Option.isNone(entityOf(server.world, e1))).toBeTruthy();
  });

  it("only reaches the four neighbouring tiles", () => {
    expect(
      decide(aliceAtCentre, createAt(alice, tile(17, 17)), 0)
    ).toStrictEqual(
      Result.fail(new NotAdjacent({ position: centre, target: tile(17, 17) }))
    );
  });

  it("will not build on water or on another entity", () => {
    const water = waterBeside(shoreline);
    expect(
      decide(worldOf([appeared(alice, shoreline)]), createAt(alice, water), 0)
    ).toStrictEqual(Result.fail(new TileIsWater({ tile: water })));
    expect(decide(withBlockEast, createAt(alice, east), 0)).toStrictEqual(
      Result.fail(
        new TileOccupied({
          entity: Option.getOrThrow(entityOf(withBlockEast, e1)),
          tile: east,
        })
      )
    );
  });

  it("will not build where a present character stands", () => {
    const crowded = worldOf([appeared(bob, east)], aliceAtCentre);
    expect(decide(crowded, createAt(alice, east), 0)).toStrictEqual(
      Result.fail(new CharacterInTheWay({ character: bob, tile: east }))
    );
  });

  it("will not build on the rest of a walk in progress", () => {
    const bobPassing = worldOf(
      [
        appeared(bob, tile(14, 17)),
        WorldEvent.cases.WalkStarted.make({
          actor: bob,
          at: 0,
          path: [tile(14, 17), tile(15, 17), south, tile(17, 17), tile(18, 17)],
        }),
      ],
      aliceAtCentre
    );

    expect(decide(bobPassing, createAt(alice, south), 100)).toStrictEqual(
      Result.fail(
        new OnWalkersPath({ arrivesAt: 1334, tile: south, walker: bob })
      )
    );
    expect(decide(bobPassing, createAt(alice, south), 700)).toStrictEqual(
      Result.fail(new CharacterInTheWay({ character: bob, tile: south }))
    );
    expect(
      Result.isSuccess(decide(bobPassing, createAt(alice, south), 1000))
    ).toBeTruthy();
  });

  it("stops at the entity limit, counting carried entities", () => {
    const farAway = Arr.take(
      Arr.filter(
        allTiles,
        (candidate) =>
          isLand(candidate) && chebyshevDistance(candidate, centre) > 2
      ),
      ENTITY_LIMIT
    );

    const full = worldOf(
      Arr.map(farAway, (where, index) => created(where, index + 1)),
      aliceCarrying
    );

    expect(entityCount(full)).toBe(ENTITY_LIMIT);
    expect(decide(full, createAt(alice, south), 0)).toStrictEqual(
      Result.fail(new EntityLimitReached({ limit: ENTITY_LIMIT }))
    );
  });
});

describe("carrying", () => {
  it("picks up an adjacent entity", () => {
    const after = worldOf(
      Result.getOrThrow(decide(withBlockEast, pickUp(), 0)),
      withBlockEast
    );

    expect(
      Option.map(carriedBy(after, alice), (entity) => entity.id)
    ).toStrictEqual(Option.some(e1));
    expect(
      Option.map(entityOf(after, e1), (entity) => entity.location)
    ).toStrictEqual(Option.some(Location.cases.Carried.make({ by: alice })));
  });

  it("carries one thing at a time", () => {
    const another = worldOf([created(south, 2)], aliceCarrying);
    expect(decide(another, pickUp(e2), 0)).toStrictEqual(
      Result.fail(
        new AlreadyCarrying({
          carrying: Option.getOrThrow(entityOf(another, e1)),
        })
      )
    );
  });

  it("refuses unknown, carried and distant entities", () => {
    const bobCarrying = worldOf(
      [
        appeared(bob, tile(18, 16)),
        WorldEvent.cases.PickedUp.make({
          actor: bob,
          at: 0,
          entity: e1,
          tile: east,
        }),
      ],
      withBlockEast
    );

    const distant = worldOf([created(tile(20, 20), 1)], aliceAtCentre);
    expect(decide(aliceAtCentre, pickUp(), 0)).toStrictEqual(
      Result.fail(new UnknownEntity({ entity: e1 }))
    );
    expect(decide(bobCarrying, pickUp(), 0)).toStrictEqual(
      Result.fail(new EntityCarried({ carriedBy: bob, entity: e1 }))
    );
    expect(decide(distant, pickUp(), 0)).toStrictEqual(
      Result.fail(new NotAdjacent({ position: centre, target: tile(20, 20) }))
    );
  });

  it("puts the carried entity down on a free adjacent tile", () => {
    const after = worldOf(
      Result.getOrThrow(decide(aliceCarrying, putDown(south), 0)),
      aliceCarrying
    );

    expect(Option.isNone(carriedBy(after, alice))).toBeTruthy();
    expect(
      Option.map(entityOf(after, e1), (entity) => entity.location)
    ).toStrictEqual(Option.some(Location.cases.Ground.make({ tile: south })));
  });

  it("needs something to put down and somewhere free to put it", () => {
    const blocked = worldOf([created(south, 2)], aliceCarrying);
    expect(decide(aliceAtCentre, putDown(), 0)).toStrictEqual(
      Result.fail(new CarryingNothing())
    );
    expect(decide(blocked, putDown(south), 0)).toStrictEqual(
      Result.fail(
        new TileOccupied({
          entity: Option.getOrThrow(entityOf(blocked, e2)),
          tile: south,
        })
      )
    );
    expect(decide(aliceCarrying, putDown(tile(18, 16)), 0)).toStrictEqual(
      Result.fail(new NotAdjacent({ position: centre, target: tile(18, 16) }))
    );
  });
});

describe("destroying", () => {
  it("removes an adjacent entity on the ground", () => {
    expect(decide(withBlockEast, destroy(), 3)).toStrictEqual(
      Result.succeed([
        WorldEvent.cases.Destroyed.make({
          actor: alice,
          at: 3,
          entity: e1,
          tile: east,
        }),
      ])
    );
  });

  it("refuses unknown, carried and distant entities", () => {
    const distant = worldOf([created(tile(20, 20), 1)], aliceAtCentre);
    expect(decide(aliceAtCentre, destroy(), 0)).toStrictEqual(
      Result.fail(new UnknownEntity({ entity: e1 }))
    );
    expect(decide(aliceCarrying, destroy(), 0)).toStrictEqual(
      Result.fail(new EntityCarried({ carriedBy: alice, entity: e1 }))
    );
    expect(decide(distant, destroy(), 0)).toStrictEqual(
      Result.fail(new NotAdjacent({ position: centre, target: tile(20, 20) }))
    );
  });
});

describe("names", () => {
  const twoOfUs = worldOf(
    [
      appeared(bob, east),
      WorldEvent.cases.Renamed.make({
        actor: bob,
        at: 0,
        displayName: DisplayName.make("Robert"),
        tile: east,
      }),
    ],
    aliceAtCentre
  );

  it("renames a character", () => {
    expect(decide(twoOfUs, rename("Alice B"), 0)).toStrictEqual(
      Result.succeed([
        WorldEvent.cases.Renamed.make({
          actor: alice,
          at: 0,
          displayName: DisplayName.make("Alice B"),
          tile: centre,
        }),
      ])
    );
  });

  it("refuses another character's name or username in any case", () => {
    expect(decide(twoOfUs, rename("ROBERT"), 0)).toStrictEqual(
      Result.fail(
        new NameTaken({ displayName: DisplayName.make("ROBERT"), takenBy: bob })
      )
    );
    expect(decide(twoOfUs, rename("Bob"), 0)).toStrictEqual(
      Result.fail(
        new NameTaken({ displayName: DisplayName.make("Bob"), takenBy: bob })
      )
    );
  });

  it("lets a character take back its own username", () => {
    expect(Result.isSuccess(decide(twoOfUs, rename("ALICE"), 0))).toBeTruthy();
  });
});

describe(decodeCommand, () => {
  it("trims text once at the boundary", () => {
    expect(
      decodeCommand({ _tag: "Say", actor: "alice", text: "  hi there \n" })
    ).toStrictEqual(Result.succeed(say("hi there")));
  });

  it("refuses blank, overlong and untrimmed-overlong text", () => {
    expect(
      Result.isSuccess(
        decodeCommand({ _tag: "Say", actor: "alice", text: "   " })
      )
    ).toBeFalsy();
    expect(
      Result.isSuccess(
        decodeCommand({
          _tag: "Say",
          actor: "alice",
          text: Str.repeat(281)("x"),
        })
      )
    ).toBeFalsy();
    expect(
      Result.isSuccess(
        decodeCommand({
          _tag: "Say",
          actor: "alice",
          text: ` ${Str.repeat(280)("x")} `,
        })
      )
    ).toBeTruthy();
  });

  it("refuses tiles off the map and colours off the palette", () => {
    expect(
      Result.isSuccess(
        decodeCommand({ _tag: "Move", actor: "alice", to: { x: 32, y: 0 } })
      )
    ).toBeFalsy();
    expect(
      Result.isSuccess(
        decodeCommand({ _tag: "Move", actor: "alice", to: { x: 1.5, y: 0 } })
      )
    ).toBeFalsy();
    expect(
      Result.isSuccess(
        decodeCommand({
          _tag: "Create",
          actor: "alice",
          item: { _tag: "Flower", colour: "black" },
          tile: { x: 1, y: 1 },
        })
      )
    ).toBeFalsy();
    expect(
      Result.isSuccess(
        decodeCommand({
          _tag: "Create",
          actor: "alice",
          item: block("pink"),
          tile: { x: 1, y: 1 },
        })
      )
    ).toBeTruthy();
  });

  it("bounds display names to 24 characters", () => {
    expect(
      Result.isSuccess(
        decodeCommand({
          _tag: "Rename",
          actor: "alice",
          name: Str.repeat(24)("n"),
        })
      )
    ).toBeTruthy();
    expect(
      Result.isSuccess(
        decodeCommand({
          _tag: "Rename",
          actor: "alice",
          name: Str.repeat(25)("n"),
        })
      )
    ).toBeFalsy();
    expect(
      Result.isSuccess(
        decodeCommand({ _tag: "Rename", actor: "alice", name: "" })
      )
    ).toBeFalsy();
  });
});
