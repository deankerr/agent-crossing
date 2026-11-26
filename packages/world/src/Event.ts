import * as Arr from "effect/Array";
import * as Schema from "effect/Schema";

import * as Cell from "./Cell.ts";
import * as Entity from "./Entity.ts";

/** Epoch milliseconds, always passed in, never read from a clock. */
export const Timestamp = Schema.Int;

/** The position of an event in the world's history. */
export const Seq = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/** No event carries more entities than this; `decide` splits bigger edits. */
export const MAX_ITEMS = 1000;

const upToLimit = <S extends Schema.Top>(item: S) =>
  Schema.NonEmptyArray(item).check(Schema.isMaxLength(MAX_ITEMS));

const edit = { at: Timestamp };

/** What happened to the world, kept as its history. Each event says everything that happened, read without the world. */
export const Event = Schema.TaggedUnion({
  /** New entities, floors and liquids among them. */
  EntitiesPlaced: { ...edit, entities: upToLimit(Entity.Entity) },
  /** Each entity as it is afterwards, keeping its id and cell, with a new prefab or new own components. */
  EntitiesChanged: { ...edit, entities: upToLimit(Entity.Entity) },
  /** The entity as it is afterwards, at its new cell, and the cell it left. */
  EntityMoved: { ...edit, entity: Entity.Entity, from: Cell.Cell },
  /** The entities as they were. */
  EntitiesRemoved: { ...edit, entities: upToLimit(Entity.Entity) },
});

const cellsOf = ({
  entities,
}: {
  readonly entities: readonly (typeof Entity.Entity.Type)[];
}) => Arr.map(entities, (entity) => entity.cell);

/** The cells an event touched, where things are now before where they were. */
export const cells = (event: typeof Event.Type) => {
  const touched: readonly (typeof Cell.Cell.Type)[] = Event.match(event, {
    EntitiesChanged: cellsOf,
    EntitiesPlaced: cellsOf,
    EntitiesRemoved: cellsOf,
    EntityMoved: ({ entity, from }) => [entity.cell, from],
  });

  return touched;
};
