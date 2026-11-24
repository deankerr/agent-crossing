import { Coordinate } from "@agent-crossing/world/cell";
import type { Cell } from "@agent-crossing/world/cell";
import { Change } from "@agent-crossing/world/change";
import { Components } from "@agent-crossing/world/components";
import { EntityId } from "@agent-crossing/world/entity";
import type { Entity } from "@agent-crossing/world/entity";
import { GroundKind, Height } from "@agent-crossing/world/ground";
import type { Tile } from "@agent-crossing/world/ground";
import { KindName } from "@agent-crossing/world/kind";
import type { WorldSnapshot } from "@agent-crossing/world/snapshot";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

/**
 * The tables the World object keeps. Ground and entities hold the current
 * world, one row per cell and per entity; `events` is the history; `meta`
 * holds the one row with the count of entities ever spawned.
 */
export const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS ground (x INTEGER NOT NULL, y INTEGER NOT NULL, kind TEXT NOT NULL, height INTEGER NOT NULL, PRIMARY KEY (x, y)) WITHOUT ROWID",
  "CREATE TABLE IF NOT EXISTS entities (id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, x INTEGER NOT NULL, y INTEGER NOT NULL, components TEXT NOT NULL) WITHOUT ROWID",
  "CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, by TEXT NOT NULL, event TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY CHECK (id = 1), spawned INTEGER NOT NULL)",
] as const;

/** What a statement binds: SQLite text or integers. */
export type SqlValue = string | number;

export interface Statement {
  readonly sql: string;
  readonly bindings: readonly SqlValue[];
}

type Table = "ground" | "entities" | "meta";

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
    columns: ["id", "kind", "x", "y", "components"],
    key: ["id"],
    merge: replacing(["kind", "x", "y", "components"]),
  },
  ground: {
    columns: ["x", "y", "kind", "height"],
    key: ["x", "y"],
    merge: replacing(["kind", "height"]),
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

/** The row write a change amounts to. The single SQL definition of each change. */
export const writeOf = (change: Change) =>
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
            values: [row.id, row.kind, row.x, row.y, row.components],
          }) satisfies Write
      ),
    GroundCleared: ({ cell }) =>
      Effect.succeed({
        op: "delete",
        table: "ground",
        values: [cell.x, cell.y],
      } satisfies Write),
    GroundSet: ({ cell, ground }) =>
      Effect.succeed({
        op: "upsert",
        table: "ground",
        values: [cell.x, cell.y, ground.kind, ground.height],
      } satisfies Write),
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
 * The statements that persist `changes`, in order. Consecutive writes of the
 * same shape share one multi-row statement, because each statement is a round
 * trip to the database.
 */
export const statementsOf = (changes: readonly Change[]) =>
  Effect.map(Effect.forEach(changes, writeOf), (writes) =>
    Arr.map(runsOf(writes), statementOfRun)
  );

/** The statement that persists one change. */
export const statementOf = (change: Change) =>
  Effect.map(writeOf(change), (write) => statementOfRun([write]));

export const GroundRow = Schema.Struct({
  x: Coordinate,
  y: Coordinate,
  kind: GroundKind,
  height: Height,
});

export type GroundRow = typeof GroundRow.Type;

export const EntityRow = Schema.Struct({
  id: EntityId,
  kind: KindName,
  x: Coordinate,
  y: Coordinate,
  components: Schema.fromJsonString(Components),
});

export type EntityRow = typeof EntityRow.Type;

const encodeEntityRow = Schema.encodeEffect(EntityRow);

export const rowOfEntity = (entity: Entity) =>
  ({
    components: entity.components,
    id: entity.id,
    kind: entity.kind,
    x: entity.cell.x,
    y: entity.cell.y,
  }) satisfies EntityRow;

export const MetaRow = Schema.Struct({
  spawned: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

const cellOf = (row: { readonly x: Coordinate; readonly y: Coordinate }) =>
  ({ x: row.x, y: row.y }) satisfies Cell;

export const tileOfRow = (row: GroundRow) =>
  ({
    cell: cellOf(row),
    ground: { height: row.height, kind: row.kind },
  }) satisfies Tile;

export const entityOfRow = (row: EntityRow) =>
  ({
    cell: cellOf(row),
    components: row.components,
    id: row.id,
    kind: row.kind,
  }) satisfies Entity;

/** What the stored rows hold, before parsing. */
export interface StoredRows {
  readonly ground: readonly unknown[];
  readonly entities: readonly unknown[];
  readonly meta: readonly unknown[];
}

const decodeGroundRows = Schema.decodeUnknownEffect(Schema.Array(GroundRow));
const decodeEntityRows = Schema.decodeUnknownEffect(Schema.Array(EntityRow));
const decodeMetaRows = Schema.decodeUnknownEffect(Schema.Array(MetaRow));

/** Parses the stored rows into the snapshot they amount to. */
export const snapshotOfRows = (rows: StoredRows) =>
  Effect.gen(function* () {
    const ground = yield* decodeGroundRows(rows.ground);
    const entities = yield* decodeEntityRows(rows.entities);
    const meta = yield* decodeMetaRows(rows.meta);

    const snapshot: WorldSnapshot = {
      entities: Arr.map(entities, entityOfRow),
      ground: Arr.map(ground, tileOfRow),
      spawned: meta[0]?.spawned ?? 0,
    };

    return snapshot;
  });
