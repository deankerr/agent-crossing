import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { Command } from "../src/command.ts";
import { entityIdFor } from "../src/entity.ts";
import { EVENT_MAX_ITEMS, WorldEvent } from "../src/event.ts";
import { cellsOf, Disc } from "../src/region.ts";
import {
  LayerTaken,
  NoGround,
  UnknownEntity,
  UnsuitableGround,
} from "../src/rejection.ts";
import { decide } from "../src/rules.ts";
import {
  cellCount,
  entitiesAt,
  entityCount,
  entityOf,
  groundAt,
  isWalkable,
  occupantOf,
} from "../src/world.ts";
import {
  cell,
  dean,
  eventsOf,
  garden,
  invariantProblems,
  paint,
  run,
  runAll,
  span,
  spawn,
} from "./world.fixture.ts";

const e1 = entityIdFor(1);
const e2 = entityIdFor(2);
const withOak = run(garden, spawn("oak", cell(2, 2)));

const rejection = (world: typeof garden, command: Command) =>
  Result.match(decide(world, command, 0, dean), {
    onFailure: Option.some,
    onSuccess: () => Option.none(),
  });

describe("Paint", () => {
  it("creates ground only where a kind is given, with height 0 by default", () => {
    const world = run(garden, paint(span(10, 0, 11, 0), "sand"));
    expect(groundAt(world, cell(11, 0))).toStrictEqual(
      Option.some({ height: 0, kind: "sand" })
    );
    expect(cellCount(world)).toBe(102);

    const raised = run(garden, paint(span(10, 0, 11, 0), undefined, 3));
    expect(cellCount(raised)).toBe(100);
  });

  it("changes only the given field of existing ground", () => {
    const world = run(garden, paint(span(0, 0, 1, 0), undefined, 4));
    expect(groundAt(world, cell(1, 0))).toStrictEqual(
      Option.some({ height: 4, kind: "grass" })
    );
  });

  it("reports only the cells that actually changed", () => {
    const events = eventsOf(garden, paint(span(0, 0, 9, 0), "grass", 1));
    expect(events).toStrictEqual([]);
  });

  it("removes things that the new ground no longer suits", () => {
    const world = runAll(
      [spawn("lily-pad", cell(8, 8)), spawn("rock", cell(1, 1))],
      garden
    );

    const events = eventsOf(world, paint(span(0, 0, 9, 9), "water"));
    expect(Arr.map(events, (event) => event._tag)).toStrictEqual([
      "Removed",
      "GroundPainted",
    ]);

    const flooded = run(world, paint(span(0, 0, 9, 9), "water"));
    expect(entityCount(flooded)).toBe(1);
    expect(Option.isSome(entityOf(flooded, e1))).toBeTruthy();
    expect(invariantProblems(flooded)).toStrictEqual([]);
  });

  it("splits big edits into events of at most a thousand tiles", () => {
    const events = eventsOf(garden, paint(span(0, 0, 49, 49), "meadow"));
    expect(events).toHaveLength(3);
    expect(
      Arr.every(
        events,
        (event) =>
          event._tag === "GroundPainted" &&
          event.tiles.length <= EVENT_MAX_ITEMS
      )
    ).toBeTruthy();
  });
});

describe("Erase", () => {
  it("removes the ground and everything on it", () => {
    const world = run(
      withOak,
      Command.cases.Erase.make({ region: span(0, 0, 4, 4) })
    );

    expect(cellCount(world)).toBe(75);
    expect(entityCount(world)).toBe(0);
    expect(invariantProblems(world)).toStrictEqual([]);
  });
});

describe("Spawn", () => {
  it("puts a numbered entity holding only its own components", () => {
    const events = eventsOf(
      garden,
      spawn("sign", cell(3, 3), { text: "Hello" })
    );

    expect(events).toStrictEqual([
      WorldEvent.cases.Spawned.make({
        at: 0,
        by: dean,
        entities: [
          {
            cell: cell(3, 3),
            components: { text: "Hello" },
            id: e1,
            kind: "sign",
          },
        ],
      }),
    ]);
  });

  it("numbers ids from the count of everything ever spawned", () => {
    const world = runAll(
      [
        Command.cases.Remove.make({ entities: [e1] }),
        spawn("rock", cell(4, 4)),
      ],
      withOak
    );

    expect(Option.isSome(entityOf(world, e2))).toBeTruthy();
    expect(world.spawned).toBe(2);
  });

  it("rejects a cell without ground", () => {
    expect(rejection(garden, spawn("oak", cell(20, 20)))).toStrictEqual(
      Option.some(new NoGround({ cell: cell(20, 20) }))
    );
  });

  it("keeps land things off water and water things off land", () => {
    expect(rejection(garden, spawn("oak", cell(8, 8)))).toStrictEqual(
      Option.some(
        new UnsuitableGround({
          cell: cell(8, 8),
          ground: "water",
          needsWater: false,
        })
      )
    );
    expect(rejection(garden, spawn("reeds", cell(1, 1)))).toStrictEqual(
      Option.some(
        new UnsuitableGround({
          cell: cell(1, 1),
          ground: "grass",
          needsWater: true,
        })
      )
    );
  });

  it("rejects a taken layer and names the occupant", () => {
    const oak = Option.getOrThrow(entityOf(withOak, e1));
    expect(rejection(withOak, spawn("rock", cell(2, 2)))).toStrictEqual(
      Option.some(
        new LayerTaken({ cell: cell(2, 2), layer: "object", occupant: oak })
      )
    );
  });

  it("lets things on different layers or with no layer share a cell", () => {
    const world = runAll(
      [spawn("fern", cell(2, 2)), spawn("mushroom", cell(2, 2))],
      withOak
    );

    expect(entitiesAt(world, cell(2, 2))).toHaveLength(3);
    expect(
      Option.map(
        occupantOf(world, cell(2, 2), "cover"),
        (entity) => entity.kind
      )
    ).toStrictEqual(Option.some("fern"));
    expect(isWalkable(world, cell(2, 2))).toBeFalsy();
    expect(isWalkable(world, cell(3, 2))).toBeTruthy();
    expect(isWalkable(world, cell(8, 8))).toBeFalsy();
  });
});

const scatter = (seed: number) =>
  Command.cases.Scatter.make({
    density: 0.5,
    kinds: ["flowers", "reeds"],
    region: span(0, 0, 9, 9),
    seed,
  });

describe("Scatter", () => {
  it("is deterministic for its seed and skips unsuitable cells", () => {
    expect(eventsOf(garden, scatter(7))).toStrictEqual(
      eventsOf(garden, scatter(7))
    );
    expect(eventsOf(garden, scatter(7))).not.toStrictEqual(
      eventsOf(garden, scatter(8))
    );

    const world = run(garden, scatter(7));
    expect(entityCount(world)).toBeGreaterThan(10);
    expect(invariantProblems(world)).toStrictEqual([]);
  });

  it("never stacks two things on one layer", () => {
    const world = run(
      run(garden, scatter(1)),
      Command.cases.Scatter.make({
        density: 1,
        kinds: ["tall-grass"],
        region: span(0, 0, 9, 9),
        seed: 2,
      })
    );

    expect(invariantProblems(world)).toStrictEqual([]);
    expect(
      Arr.every(cellsOf(span(0, 0, 6, 6)), (here) =>
        Option.isSome(occupantOf(world, here, "cover"))
      )
    ).toBeTruthy();
  });
});

describe("Move", () => {
  it("moves an entity to a suitable cell", () => {
    const world = run(
      withOak,
      Command.cases.Move.make({ entity: e1, to: cell(5, 5) })
    );

    expect(
      Option.map(entityOf(world, e1), (entity) => entity.cell)
    ).toStrictEqual(Option.some(cell(5, 5)));
    expect(entitiesAt(world, cell(2, 2))).toStrictEqual([]);
    expect(invariantProblems(world)).toStrictEqual([]);
  });

  it("may stay where it is without blocking itself", () => {
    expect(
      Result.isSuccess(
        decide(
          withOak,
          Command.cases.Move.make({ entity: e1, to: cell(2, 2) }),
          0,
          dean
        )
      )
    ).toBeTruthy();
  });

  it("rejects unknown entities and unsuitable cells", () => {
    expect(
      rejection(garden, Command.cases.Move.make({ entity: e1, to: cell(1, 1) }))
    ).toStrictEqual(Option.some(new UnknownEntity({ entity: e1 })));
    expect(
      Option.map(
        rejection(
          withOak,
          Command.cases.Move.make({ entity: e1, to: cell(8, 8) })
        ),
        (failure) => failure._tag
      )
    ).toStrictEqual(Option.some("UnsuitableGround"));
  });
});

describe("Change", () => {
  it("replaces the entity's own components", () => {
    const world = run(
      run(garden, spawn("block", cell(1, 1), { colour: "blue" })),
      Command.cases.Change.make({ components: { colour: "green" }, entity: e1 })
    );

    expect(
      Option.map(entityOf(world, e1), (entity) => entity.components)
    ).toStrictEqual(Option.some({ colour: "green" }));
  });

  it("rejects components that no longer fit the cell", () => {
    expect(
      Option.map(
        rejection(
          withOak,
          Command.cases.Change.make({
            components: { aquatic: true },
            entity: e1,
          })
        ),
        (failure) => failure._tag
      )
    ).toStrictEqual(Option.some("UnsuitableGround"));
  });
});

describe("Remove and RemoveIn", () => {
  it("removes the listed entities once each", () => {
    const events = eventsOf(
      withOak,
      Command.cases.Remove.make({ entities: [e1, e1] })
    );

    expect(events).toStrictEqual([
      WorldEvent.cases.Removed.make({ at: 0, by: dean, entities: [e1] }),
    ]);
  });

  it("rejects an unknown entity", () => {
    expect(
      rejection(withOak, Command.cases.Remove.make({ entities: [e1, e2] }))
    ).toStrictEqual(Option.some(new UnknownEntity({ entity: e2 })));
  });

  it("removes everything in a region, or only one kind", () => {
    const world = runAll(
      [spawn("rock", cell(3, 3)), spawn("fern", cell(3, 3))],
      withOak
    );

    const ferns = run(
      world,
      Command.cases.RemoveIn.make({
        kind: "fern",
        region: Disc.make({ centre: cell(3, 3), radius: 2 }),
      })
    );

    expect(entityCount(ferns)).toBe(2);

    const cleared = run(
      world,
      Command.cases.RemoveIn.make({ region: span(0, 0, 9, 9) })
    );

    expect(entityCount(cleared)).toBe(0);
  });
});
