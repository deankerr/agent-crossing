import * as Arr from "effect/Array";
import * as Order from "effect/Order";
import * as Schema from "effect/Schema";

import { Change } from "./change.ts";
import { Entity } from "./entity.ts";
import { Tile } from "./ground.ts";
import { allEntities, allTiles, applyAll, emptyWorld } from "./world.ts";
import type { World } from "./world.ts";

/** The whole world as JSON-ready data. */
export const WorldSnapshot = Schema.Struct({
  ground: Schema.Array(Tile),
  entities: Schema.Array(Entity),
  spawned: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export type WorldSnapshot = typeof WorldSnapshot.Type;

const byRowThenColumn = Order.combine(
  Order.mapInput(Order.Number, (tile: Tile) => tile.cell.y),
  Order.mapInput(Order.Number, (tile: Tile) => tile.cell.x)
);

export const toSnapshot = (world: World) =>
  ({
    entities: allEntities(world),
    ground: Arr.sort(allTiles(world), byRowThenColumn),
    spawned: world.spawned,
  }) satisfies WorldSnapshot;

const snapshotChanges = (snapshot: WorldSnapshot) => {
  const changes: readonly Change[] = [
    ...Arr.map(snapshot.ground, ({ cell, ground }) =>
      Change.cases.GroundSet.make({ cell, ground })
    ),
    ...Arr.map(snapshot.entities, (entity) =>
      Change.cases.EntityPut.make({ entity })
    ),
    Change.cases.SpawnCounted.make({ spawned: snapshot.spawned }),
  ];

  return changes;
};

/** The changes that rebuild `world` from the empty world: ground row by row, then entities, then the spawn count. */
export const changesFor = (world: World) => snapshotChanges(toSnapshot(world));

export const fromSnapshot = (snapshot: WorldSnapshot) =>
  applyAll(emptyWorld, snapshotChanges(snapshot));
