import * as Components from "@agent-crossing/definitions/Components";
import * as Prefabs from "@agent-crossing/definitions/Prefabs";
import * as Cell from "@agent-crossing/world/Cell";
import * as Entity from "@agent-crossing/world/Entity";
import * as Event from "@agent-crossing/world/Event";
import * as World from "@agent-crossing/world/World";
import type * as Rivet from "@alchemy.run/rivet";
import * as Arr from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS entities (id TEXT PRIMARY KEY NOT NULL, prefab TEXT NOT NULL, x INTEGER NOT NULL, y INTEGER NOT NULL, components TEXT NOT NULL) WITHOUT ROWID",
  "CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY CHECK (id = 1), spawned INTEGER NOT NULL)",
] as const;

const EventRow = Schema.Struct({
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

const upserted = (entity: typeof Entity.Entity.Type) =>
  Effect.map(
    encodeEntityRow(rowOfEntity(entity)),
    (row) =>
      ({
        op: "upsert",
        table: "entities",
        values: [row.id, row.prefab, row.x, row.y, row.components],
      }) satisfies Write
  );

const upsertedAll = (entities: readonly (typeof Entity.Entity.Type)[]) =>
  Effect.forEach(entities, upserted);

const writesOf = (event: typeof Event.Event.Type) =>
  Event.Event.match(event, {
    EntitiesChanged: ({ entities }) => upsertedAll(entities),
    EntitiesPlaced: ({ entities }) =>
      Effect.map(upsertedAll(entities), (writes) =>
        Arr.append(writes, {
          op: "upsert",
          table: "meta",
          values: [
            1,
            Math.max(
              ...Arr.map(entities, (entity) => Entity.serial(entity.id))
            ),
          ],
        } satisfies Write)
      ),
    EntitiesRemoved: ({ entities }) =>
      Effect.succeed(
        Arr.map(
          entities,
          (entity) =>
            ({
              op: "delete",
              table: "entities",
              values: [entity.id],
            }) satisfies Write
        )
      ),
    EntityMoved: ({ entity }) => upsertedAll([entity]),
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

const statementsOf = (event: typeof Event.Event.Type) =>
  Effect.map(writesOf(event), (writes) =>
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

const decodeEntityRows = Schema.decodeUnknownEffect(Schema.Array(EntityRow));
const decodeMetaRows = Schema.decodeUnknownEffect(Schema.Array(MetaRow));

const worldOfRows = (rows: {
  readonly entities: readonly unknown[];
  readonly meta: readonly unknown[];
}) =>
  Effect.gen(function* () {
    const entities = yield* decodeEntityRows(rows.entities);
    const meta = yield* decodeMetaRows(rows.meta);

    return World.make(Arr.map(entities, entityOfRow), meta[0]?.spawned ?? 0);
  });

const COMMIT_TIMEOUT = Duration.minutes(5);

/** An event the World object has stored, with the sequence number it was given. */
export interface Happened {
  readonly seq: typeof Event.Seq.Type;
  readonly event: typeof Event.Event.Type;
}

const decodeSeq = Schema.decodeUnknownEffect(Event.Seq);
const decodeEventRows = Schema.decodeUnknownEffect(Schema.Array(EventRow));
const encodeEventJson = Schema.encodeEffect(Schema.fromJsonString(Event.Event));

const run = <Row extends Record<string, unknown>>(
  storage: Rivet.DurableObjectStorage,
  query: string,
  ...bindings: readonly unknown[]
) =>
  Effect.flatMap(storage.sql.exec<Row>(query, ...bindings), (cursor) =>
    cursor.toArray()
  );

/**
 * Creates the tables if they are missing, then reads back the world they hold
 * and the sequence number of the last stored event. `entities` holds the
 * current world, one row per entity, floors and liquids included; `events` is
 * the history; `meta` holds the one row with the count of entities ever
 * spawned.
 */
export const load = (storage: Rivet.DurableObjectStorage) =>
  Effect.gen(function* () {
    yield* Effect.forEach(SCHEMA, (statement) => run(storage, statement), {
      discard: true,
    });

    const world = yield* Effect.orDie(
      worldOfRows({
        entities: yield* run(
          storage,
          "SELECT id, prefab, x, y, components FROM entities"
        ),
        meta: yield* run(storage, "SELECT spawned FROM meta WHERE id = 1"),
      })
    );

    const head = yield* Effect.flatMap(
      run<{ head: number }>(
        storage,
        "SELECT COALESCE(MAX(seq), 0) AS head FROM events"
      ),
      (rows) => Effect.orDie(decodeSeq(rows[0]?.head ?? 0))
    );

    return { head, world };
  });

const storeOne = (
  storage: Rivet.DurableObjectStorage,
  event: typeof Event.Event.Type
) =>
  Effect.gen(function* () {
    const rows = yield* run<{ seq: number }>(
      storage,
      "INSERT INTO events (event) VALUES (?) RETURNING seq",
      yield* encodeEventJson(event)
    );

    const seq = yield* decodeSeq(rows[0]?.seq);

    yield* Effect.forEach(
      yield* statementsOf(event),
      ({ bindings, sql }) => run(storage, sql, ...bindings),
      { discard: true }
    );

    return { event, seq } satisfies Happened;
  });

/**
 * Stores the events and the rows they change in one transaction, and returns
 * each event with the sequence number it was given. Consecutive writes to the
 * same table with the same operation share one multi-row statement, because
 * each statement is a round trip to the database.
 */
export const store = (
  storage: Rivet.DurableObjectStorage,
  events: readonly (typeof Event.Event.Type)[]
) =>
  storage.transaction(
    Effect.forEach(events, (event) => storeOne(storage, event)),
    { timeout: COMMIT_TIMEOUT }
  );

/** The last `count` stored events, oldest first. */
export const latest = (storage: Rivet.DurableObjectStorage, count: number) =>
  Effect.flatMap(
    run(
      storage,
      "SELECT seq, event FROM (SELECT seq, event FROM events ORDER BY seq DESC LIMIT ?) ORDER BY seq",
      count
    ),
    decodeEventRows
  );
