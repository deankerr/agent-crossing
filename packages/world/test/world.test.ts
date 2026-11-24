import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Equal from "effect/Equal";
import * as Option from "effect/Option";

import { Change } from "../src/change.ts";
import { entityIdFor } from "../src/entity.ts";
import type { Entity } from "../src/entity.ts";
import { groundKinds } from "../src/ground.ts";
import { kindNames } from "../src/kind.ts";
import { seededRandom } from "../src/seeded-random.ts";
import {
  apply,
  bounds,
  emptyWorld,
  entitiesAt,
  entityCounts,
  groundCounts,
  indexEntities,
} from "../src/world.ts";
import { cell, garden, spawn, run } from "./world.fixture.ts";

const randomChange = (random: ReturnType<typeof seededRandom>) => {
  const here = cell(random.integer(6), random.integer(6));
  const id = entityIdFor(1 + random.integer(12));
  const roll = random.integer(5);

  if (roll === 0) {
    return Change.cases.GroundSet.make({
      cell: here,
      ground: {
        height: random.integer(8),
        kind: groundKinds[random.integer(groundKinds.length)] ?? "grass",
      },
    });
  }

  if (roll === 1) {
    return Change.cases.GroundCleared.make({ cell: here });
  }

  if (roll === 2) {
    return Change.cases.EntityDropped.make({ id });
  }

  const entity: Entity = {
    cell: here,
    components: {},
    id,
    kind: kindNames[random.integer(kindNames.length)] ?? "oak",
  };

  return Change.cases.EntityPut.make({ entity });
};

describe(apply, () => {
  it("keeps the cell index equal to one rebuilt from scratch", () => {
    for (const seed of Arr.range(1, 40)) {
      const random = seededRandom(seed);
      let world = emptyWorld;

      for (let step = 0; step < 200; step += 1) {
        world = apply(world, randomChange(random));
        expect(
          Equal.equals(world.entitiesByCell, indexEntities(world.entities))
        ).toBeTruthy();
      }
    }
  });

  it("only ever raises the spawn count", () => {
    const counted = apply(
      apply(emptyWorld, Change.cases.SpawnCounted.make({ spawned: 5 })),
      Change.cases.SpawnCounted.make({ spawned: 2 })
    );

    expect(counted.spawned).toBe(5);
  });
});

describe("queries", () => {
  it("derives bounds from the ground", () => {
    expect(bounds(emptyWorld)).toStrictEqual(Option.none());
    expect(bounds(garden)).toStrictEqual(
      Option.some({ maxX: 9, maxY: 9, minX: 0, minY: 0 })
    );
  });

  it("counts ground and entities by kind, most first", () => {
    const world = run(
      run(garden, spawn("rock", cell(1, 1))),
      spawn("oak", cell(2, 1))
    );

    expect(groundCounts(world)).toStrictEqual([
      { count: 91, kind: "grass" },
      { count: 9, kind: "water" },
    ]);
    expect(entityCounts(world)).toStrictEqual([
      { count: 1, kind: "oak" },
      { count: 1, kind: "rock" },
    ]);
    expect(
      Arr.map(entitiesAt(world, cell(1, 1)), (entity) => entity.id)
    ).toStrictEqual([entityIdFor(1)]);
  });
});
