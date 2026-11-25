import * as Arr from "effect/Array";
import * as Schema from "effect/Schema";

import { Change } from "./change.ts";
import { Entity } from "./entity.ts";
import { allEntities, applyAll, emptyWorld } from "./world.ts";
import type { World } from "./world.ts";

/** The whole world as JSON-ready data. */
export const WorldSnapshot = Schema.Struct({
  entities: Schema.Array(Entity),
  spawned: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export const toSnapshot = (world: World) =>
  ({
    entities: allEntities(world),
    spawned: world.spawned,
  }) satisfies typeof WorldSnapshot.Type;

const snapshotChanges = (snapshot: typeof WorldSnapshot.Type) => {
  const changes: readonly (typeof Change.Type)[] = [
    ...Arr.map(snapshot.entities, (entity) =>
      Change.cases.EntityPut.make({ entity })
    ),
    Change.cases.SpawnCounted.make({ spawned: snapshot.spawned }),
  ];

  return changes;
};

/** The changes that rebuild `world` from the empty world: entities oldest first, then the spawn count. */
export const changesFor = (world: World) => snapshotChanges(toSnapshot(world));

export const fromSnapshot = (snapshot: typeof WorldSnapshot.Type) =>
  applyAll(emptyWorld, snapshotChanges(snapshot));
