import { DatabaseSync } from "node:sqlite";

import { Change } from "@agent-crossing/world/change";
import { Command } from "@agent-crossing/world/command";
import { EntityId } from "@agent-crossing/world/entity";
import type { Entity } from "@agent-crossing/world/entity";
import { changesOf } from "@agent-crossing/world/event";
import {
  changesFor,
  fromSnapshot,
  toSnapshot,
} from "@agent-crossing/world/snapshot";
import { applyAll, emptyWorld } from "@agent-crossing/world/world";
import type { World } from "@agent-crossing/world/world";
import { assert, describe, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import {
  ROWS_PER_STATEMENT,
  SCHEMA,
  snapshotOfRows,
  statementOf,
  statementsOf,
} from "../src/rows.ts";
import { cell, eventsOf, garden, span, spawn } from "./world.fixture.ts";

const sign: Entity = {
  cell: cell(3, -4),
  components: { text: "Hello" },
  id: EntityId.make("e7"),
  kind: "sign",
};

const database = () => {
  const db = new DatabaseSync(":memory:");

  for (const statement of SCHEMA) {
    db.exec(statement);
  }

  return db;
};

const persist = (db: DatabaseSync, changes: readonly Change[]) =>
  Effect.map(statementsOf(changes), (statements) => {
    for (const { bindings, sql } of statements) {
      db.prepare(sql).run(...bindings);
    }
  });

const stored = (db: DatabaseSync) =>
  snapshotOfRows({
    entities: db
      .prepare("SELECT id, kind, x, y, components FROM entities")
      .all(),
    ground: db.prepare("SELECT x, y, kind, height FROM ground").all(),
    meta: db.prepare("SELECT spawned FROM meta WHERE id = 1").all(),
  });

const persistedThrough = (
  db: DatabaseSync,
  start: World,
  commands: readonly Command[]
) =>
  Effect.gen(function* () {
    let world = start;

    for (const command of commands) {
      for (const event of eventsOf(world, command)) {
        const changes = changesOf(world, event);
        yield* persist(db, changes);
        world = applyAll(world, changes);
      }
    }

    return world;
  });

describe("statements", () => {
  it.effect("maps each change to one statement", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* statementOf(
          Change.cases.GroundSet.make({
            cell: cell(1, 2),
            ground: { height: 3, kind: "sand" },
          })
        ),
        {
          bindings: [1, 2, "sand", 3],
          sql: "INSERT INTO ground (x, y, kind, height) VALUES (?, ?, ?, ?) ON CONFLICT (x, y) DO UPDATE SET kind = excluded.kind, height = excluded.height",
        }
      );

      assert.deepStrictEqual(
        yield* statementOf(
          Change.cases.GroundCleared.make({ cell: cell(1, 2) })
        ),
        {
          bindings: [1, 2],
          sql: "DELETE FROM ground WHERE (x, y) IN (VALUES (?, ?))",
        }
      );

      assert.deepStrictEqual(
        yield* statementOf(Change.cases.EntityPut.make({ entity: sign })),
        {
          bindings: ["e7", "sign", 3, -4, '{"text":"Hello"}'],
          sql: "INSERT INTO entities (id, kind, x, y, components) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET kind = excluded.kind, x = excluded.x, y = excluded.y, components = excluded.components",
        }
      );

      assert.deepStrictEqual(
        yield* statementOf(Change.cases.EntityDropped.make({ id: sign.id })),
        {
          bindings: ["e7"],
          sql: "DELETE FROM entities WHERE id IN (?)",
        }
      );

      assert.deepStrictEqual(
        yield* statementOf(Change.cases.SpawnCounted.make({ spawned: 9 })),
        {
          bindings: [1, 9],
          sql: "INSERT INTO meta (id, spawned) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET spawned = MAX(spawned, excluded.spawned)",
        }
      );
    })
  );

  it.effect(
    "shares one statement between consecutive writes of the same kind",
    () =>
      Effect.gen(function* () {
        const tiles = Arr.makeBy(ROWS_PER_STATEMENT + 1, (x) =>
          Change.cases.GroundSet.make({
            cell: cell(x, 0),
            ground: { height: 0, kind: "grass" },
          })
        );

        const statements = yield* statementsOf([
          ...tiles,
          Change.cases.EntityDropped.make({ id: sign.id }),
          Change.cases.EntityDropped.make({ id: EntityId.make("e8") }),
        ]);

        assert.deepStrictEqual(
          Arr.map(statements, ({ bindings }) => bindings.length),
          [ROWS_PER_STATEMENT * 4, 4, 2]
        );
        assert.strictEqual(
          statements[2]?.sql,
          "DELETE FROM entities WHERE id IN (?, ?)"
        );
      })
  );
});

describe("rows", () => {
  it.effect("reload the world they were written from", () =>
    Effect.gen(function* () {
      const db = database();
      yield* persist(db, changesFor(garden));

      const reloaded = fromSnapshot(yield* stored(db));

      assert.deepStrictEqual(toSnapshot(reloaded), toSnapshot(garden));
    })
  );

  it.effect("follow every edit, including removals, erasure and moves", () =>
    Effect.gen(function* () {
      const db = database();

      const world = yield* persistedThrough(db, emptyWorld, [
        Command.cases.Paint.make({ kind: "grass", region: span(-4, -4, 3, 3) }),
        spawn("sign", cell(1, 1), { text: "Here" }),
        spawn("bench", cell(2, 2)),
        spawn("flowers", cell(-3, -3), { colour: "yellow" }),
        Command.cases.Move.make({
          entity: EntityId.make("e2"),
          to: cell(3, 3),
        }),
        Command.cases.Change.make({
          components: { text: "There" },
          entity: EntityId.make("e1"),
        }),
        Command.cases.Erase.make({ region: span(-4, -4, 3, -2) }),
        Command.cases.Paint.make({ height: 5, region: span(0, 0, 3, 3) }),
        Command.cases.Generate.make({
          height: 10,
          origin: cell(4, 4),
          seed: 9,
          width: 10,
        }),
      ]);

      assert.deepStrictEqual(
        toSnapshot(fromSnapshot(yield* stored(db))),
        toSnapshot(world)
      );
    })
  );

  it.effect("refuse rows that do not parse", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        snapshotOfRows({
          entities: [],
          ground: [{ height: 9, kind: "grass", x: 0, y: 0 }],
          meta: [],
        })
      );

      assert.isTrue(Exit.isFailure(exit));
    })
  );
});
