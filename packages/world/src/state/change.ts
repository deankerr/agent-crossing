import * as Schema from "effect/Schema";

import { Entity, EntityId } from "./entity.ts";

/**
 * The smallest writes to world state. `apply` in `world` is the only function
 * that modifies a world, and the host persists the same changes as rows, so
 * this union is the single definition of what state is.
 */
export const Change = Schema.TaggedUnion({
  EntityPut: { entity: Entity },
  EntityDropped: { id: EntityId },
  /** Raises the count of entities ever spawned, which numbers new ids. */
  SpawnCounted: { spawned: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)) },
});
