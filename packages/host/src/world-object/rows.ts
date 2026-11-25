import { PrefabName } from "@agent-crossing/world/definitions/prefabs";
import { Coordinate } from "@agent-crossing/world/schema/cell";
import { Components } from "@agent-crossing/world/schema/components";
import { Change } from "@agent-crossing/world/state/change";
import { EntityId } from "@agent-crossing/world/state/entity";
import type { Entity } from "@agent-crossing/world/state/entity";
import type { WorldSnapshot } from "@agent-crossing/world/state/snapshot";
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
  "CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, by TEXT NOT NULL, event TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY CHECK (id = 1), spawned INTEGER NOT NULL)",
] as const;

/** What a statement binds: SQLite text or integers. */
export type SqlValue = string | number;

export interface Statement {
  readonly sql: string;
  readonly bindings: readonly SqlValue[];
}

type Table = "entities" | "meta";

interface TableLayout {
  readonly columns: readonly string[];
  readonly key: readonly string[];
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
    key: ["id"],
    merge: replacing(["prefab", "x", "y", "components"]),
  },
  meta: {
    columns: ["id", "spawned"],
    key: ["id"],
    merge: "spawned = MAX(spawned, excluded.spawned)",
  },
};

/** One row written or deleted: the unit a `Change` amounts to in SQL. */
export interface Write {
  readonly op: "upsert" | "delete";
  readonly table: Table;
  /** The row's columns for an upsert, its key for a delete, in table order. */
  readonly values: readonly SqlValue[];
}

export const EntityRow = Schema.Struct({
  id: EntityId,
  prefab: PrefabName,
  x: Coordinate,
  y: Coordinate,
  components: Schema.fromJsonString(Components),
});

const encodeEntityRow = Schema.encodeEffect(EntityRow);

export const rowOfEntity = (entity: typeof Entity.Type) =>
  ({
    components: entity.components,
    id: entity.id,
    prefab: entity.prefab,
    x: entity.cell.x,
    y: entity.cell.y,
  }) satisfies typeof EntityRow.Type;

/** The row write a change amounts to. The single SQL definition of each change. */
export const writeOf = (change: typeof Change.Type) =>
  Change.match(change, {
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

const tuple = (columns: readonly string[]) =>
  columns.length === 1 ? (columns[0] ?? "") : `(${Arr.join(columns, ", ")})`;

const sqlOf = (op: Write["op"], table: Table, rows: number) => {
  const layout = tables[table];

  if (op === "upsert") {
    const values = Arr.join(
      Arr.makeBy(rows, () => placeholders(layout.columns.length)),
      ", "
    );

    return `INSERT INTO ${table} (${Arr.join(layout.columns, ", ")}) VALUES ${values} ON CONFLICT (${Arr.join(layout.key, ", ")}) DO UPDATE SET ${layout.merge}`;
  }

  const keys =
    layout.key.length === 1
      ? Arr.join(
          Arr.makeBy(rows, () => "?"),
          ", "
        )
      : `VALUES ${Arr.join(
          Arr.makeBy(rows, () => placeholders(layout.key.length)),
          ", "
        )}`;

  return `DELETE FROM ${table} WHERE ${tuple(layout.key)} IN (${keys})`;
};

/** Rows per statement; keeps bindings far below SQLite's limit. */
export const ROWS_PER_STATEMENT = 400;

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
export const statementsOf = (changes: readonly (typeof Change.Type)[]) =>
  Effect.map(Effect.forEach(changes, writeOf), (writes) =>
    Arr.map(runsOf(writes), statementOfRun)
  );

/** The statement that persists one change. */
export const statementOf = (change: typeof Change.Type) =>
  Effect.map(writeOf(change), (write) => statementOfRun([write]));

export const MetaRow = Schema.Struct({
  spawned: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export const entityOfRow = (row: typeof EntityRow.Type) =>
  ({
    cell: { x: row.x, y: row.y },
    components: row.components,
    id: row.id,
    prefab: row.prefab,
  }) satisfies typeof Entity.Type;

/** What the stored rows hold, before parsing. */
export interface StoredRows {
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

    const snapshot: typeof WorldSnapshot.Type = {
      entities: Arr.map(entities, entityOfRow),
      spawned: meta[0]?.spawned ?? 0,
    };

    return snapshot;
  });
