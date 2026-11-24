import * as Schema from "effect/Schema";

import { Cell } from "./cell.ts";
import { Entity, EntityId } from "./entity.ts";
import { Ground } from "./ground.ts";

/**
 * The smallest writes to world state. `apply` in `world` is the only function
 * that modifies a world, and the server persists the same changes as rows, so
 * this union is the single definition of what state is.
 */
export const Change = Schema.TaggedUnion({
  GroundSet: { cell: Cell, ground: Ground },
  GroundCleared: { cell: Cell },
  EntityPut: { entity: Entity },
  EntityDropped: { id: EntityId },
  /** Raises the count of entities ever spawned, which numbers new ids. */
  SpawnCounted: { spawned: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)) },
});

export type Change = typeof Change.Type;
