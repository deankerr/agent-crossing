import * as Components from "@agent-crossing/definitions/Components";
import * as Prefabs from "@agent-crossing/definitions/Prefabs";
import * as Cell from "@agent-crossing/world/Cell";
import * as Change from "@agent-crossing/world/Change";
import * as Entity from "@agent-crossing/world/Entity";
import * as Event from "@agent-crossing/world/Event";
import type * as World from "@agent-crossing/world/World";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

/**
 * The tables the World object keeps. `entities` holds the current world, one
 * row per entity, floors and liquids included; `events` is the history;
 * `meta` holds the one row with the count of entities ever spawned.
 */
export const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS entities (id TEXT PRIMARY KEY NOT NULL, prefab TEXT NOT NULL, x INTEGER NOT NULL, y INTEGER NOT NULL, components TEXT NOT NULL) WITHOUT ROWID",
  "CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY CHECK (id = 1), spawned INTEGER NOT NULL)",
] as const;

/** A stored event, as `history` reads it back. */
export const EventRow = Schema.Struct({
  seq: Event.Seq,
  event: Schema.fromJsonString(Event.Event),
});

type SqlValue = string | number;

interface Statement {
  readonly sql: string;
  readonly bindings: readonly SqlValue[];
}

type Table = "entities" | "meta";

interface TableLayout {
  readonly columns: readonly string[];
  readonly merge: string;
}

const replacing = (columns: readonly string[]) =>
  Arr.join(
    Arr.map(columns, (column) => `${column} = excluded.${column}`),
    ", "
  );

const tables: Record<Table, TableLayout> = {
  entities: {
    columns: ["id", "prefab", "x", "y", "components"],
    merge: replacing(["prefab", "x", "y", "components"]),
  },
  meta: {
    columns: ["id", "spawned"],
    merge: "spawned = MAX(spawned, excluded.spawned)",
  },
};

interface Write {
  readonly op: "upsert" | "delete";
  readonly table: Table;
  readonly values: readonly SqlValue[];
}

const EntityRow = Schema.Struct({
  id: Entity.Id,
  prefab: Prefabs.Name,
  x: Cell.Coordinate,
  y: Cell.Coordinate,
  components: Schema.fromJsonString(Components.Components),
});

const encodeEntityRow = Schema.encodeEffect(EntityRow);

const rowOfEntity = (entity: typeof Entity.Entity.Type) =>
  ({
    components: entity.components,
    id: entity.id,
    prefab: entity.prefab,
    x: entity.cell.x,
    y: entity.cell.y,
  }) satisfies typeof EntityRow.Type;

const writeOf = (change: typeof Change.Change.Type) =>
  Change.Change.match(change, {
    EntityDropped: ({ id }) =>
      Effect.succeed({
        op: "delete",
        table: "entities",
        values: [id],
      } satisfies Write),
    EntityPut: ({ entity }) =>
      Effect.map(
        encodeEntityRow(rowOfEntity(entity)),
        (row) =>
          ({
            op: "upsert",
            table: "entities",
            values: [row.id, row.prefab, row.x, row.y, row.components],
          }) satisfies Write
      ),
    SpawnCounted: ({ spawned }) =>
      Effect.succeed({
        op: "upsert",
        table: "meta",
        values: [1, spawned],
      } satisfies Write),
  });

const placeholders = (count: number) =>
  `(${Arr.join(
    Arr.makeBy(count, () => "?"),
    ", "
  )})`;

const sqlOf = (op: Write["op"], table: Table, rows: number) => {
  const layout = tables[table];

  if (op === "upsert") {
    const values = Arr.join(
      Arr.makeBy(rows, () => placeholders(layout.columns.length)),
      ", "
    );

    return `INSERT INTO ${table} (${Arr.join(layout.columns, ", ")}) VALUES ${values} ON CONFLICT (id) DO UPDATE SET ${layout.merge}`;
  }

  const keys = Arr.join(
    Arr.makeBy(rows, () => "?"),
    ", "
  );

  return `DELETE FROM ${table} WHERE id IN (${keys})`;
};

const ROWS_PER_STATEMENT = 400;

const sameTarget = (a: Write, b: Write) => a.op === b.op && a.table === b.table;

const runsOf = (writes: readonly Write[]) => {
  const runs: Write[][] = [];

  for (const write of writes) {
    const last = runs.at(-1);
    const first = last?.[0];

    if (
      last !== undefined &&
      first !== undefined &&
      sameTarget(first, write) &&
      last.length < ROWS_PER_STATEMENT
    ) {
      last.push(write);
    } else {
      runs.push([write]);
    }
  }

  return runs;
};

const statementOfRun = (run: readonly Write[]) => {
  const [first] = run;

  return {
    bindings: Arr.flatMap(run, (write) => write.values),
    sql: first === undefined ? "" : sqlOf(first.op, first.table, run.length),
  } satisfies Statement;
};

/**
 * The statements that persist `changes`, in order. Consecutive writes to the
 * same table with the same operation share one multi-row statement, because
 * each statement is a round trip to the database.
 */
export const statementsOf = (changes: readonly (typeof Change.Change.Type)[]) =>
  Effect.map(Effect.forEach(changes, writeOf), (writes) =>
    Arr.map(runsOf(writes), statementOfRun)
  );

const MetaRow = Schema.Struct({
  spawned: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

const entityOfRow = (row: typeof EntityRow.Type) =>
  ({
    cell: { x: row.x, y: row.y },
    components: row.components,
    id: row.id,
    prefab: row.prefab,
  }) satisfies typeof Entity.Entity.Type;

/** What the stored rows hold, before parsing. */
interface StoredRows {
  readonly entities: readonly unknown[];
  readonly meta: readonly unknown[];
}

const decodeEntityRows = Schema.decodeUnknownEffect(Schema.Array(EntityRow));
const decodeMetaRows = Schema.decodeUnknownEffect(Schema.Array(MetaRow));

/** Parses the stored rows into the snapshot they amount to. */
export const snapshotOfRows = (rows: StoredRows) =>
  Effect.gen(function* () {
    const entities = yield* decodeEntityRows(rows.entities);
    const meta = yield* decodeMetaRows(rows.meta);

    const snapshot: typeof World.Snapshot.Type = {
      entities: Arr.map(entities, entityOfRow),
      spawned: meta[0]?.spawned ?? 0,
    };

    return snapshot;
  });
