import { assert, describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Record from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { Command } from "../src/command.ts";
import { ENTITY_LIMIT, entityIdFor, Item } from "../src/entity.ts";
import { WorldEvent } from "../src/event.ts";
import { evolveAll } from "../src/evolve.ts";
import { centre, tileAt, tileIndex } from "../src/grid.ts";
import type { Tile } from "../src/grid.ts";
import { execute, expire } from "../src/presence.ts";
import { Rejection } from "../src/rejection.ts";
import { seededRandom } from "../src/seeded-random.ts";
import type { SeededRandom } from "../src/seeded-random.ts";
import { isLand } from "../src/terrain.ts";
import { Colour, DisplayName, Text, Username } from "../src/values.ts";
import { positionAt } from "../src/walk.ts";
import {
  allEntities,
  characterOf,
  emptyServer,
  Server,
  World,
} from "../src/world.ts";

const actors = Arr.map(["alice", "bob", "carol", "dave"] as const, (name) =>
  Username.make(name)
);

const names = Arr.map(["Al", "BOB", "Robin", "Dee", "carol"] as const, (name) =>
  DisplayName.make(name)
);

const pick = <A>(random: SeededRandom, from: Arr.NonEmptyReadonlyArray<A>) =>
  from[random.integer(from.length)] ?? from[0];

const near = (random: SeededRandom, origin: Tile, reach: number) =>
  tileAt(
    origin.x + random.integer(2 * reach + 1) - reach,
    origin.y + random.integer(2 * reach + 1) - reach
  ).pipe(Option.getOrElse(() => origin));

const randomItem = (random: SeededRandom) =>
  pick<Item>(random, [
    Item.cases.Block.make({ colour: pick(random, Colour.literals) }),
    Item.cases.Flower.make({ colour: pick(random, Colour.literals) }),
    Item.cases.Sign.make({ text: Text.make("Welcome") }),
  ]);

const randomCommand = (random: SeededRandom, server: Server, now: number) => {
  const actor = pick(random, actors);

  const here = Option.match(characterOf(server.world, actor), {
    onNone: () => centre,
    onSome: (character) => positionAt(character.motion, now),
  });

  const someEntity = entityIdFor(
    1 + random.integer(server.world.entitiesCreated + 2)
  );

  return pick<Command>(random, [
    Command.cases.Move.make({ actor, to: near(random, here, 6) }),
    Command.cases.Create.make({
      actor,
      item: randomItem(random),
      tile: near(random, here, 1),
    }),
    Command.cases.Create.make({
      actor,
      item: randomItem(random),
      tile: near(random, here, 1),
    }),
    Command.cases.PickUp.make({ actor, entity: someEntity }),
    Command.cases.PutDown.make({ actor, tile: near(random, here, 1) }),
    Command.cases.Destroy.make({ actor, entity: someEntity }),
    Command.cases.Say.make({ actor, text: Text.make("hello") }),
    Command.cases.Rename.make({ actor, name: pick(random, names) }),
    Command.cases.Look.make({ actor }),
    Command.cases.StreamOpened.make({ actor }),
    Command.cases.StreamClosed.make({ actor }),
  ]);
};

interface Step {
  readonly server: Server;
  readonly events: readonly WorldEvent[];
}

const ALARM_CHANCE = 0.1;
const LONG_PAUSE_CHANCE = 0.1;

const simulate = (seed: number, length: number) => {
  const random = seededRandom(seed);
  const steps: Arr.NonEmptyArray<Step> = [{ events: [], server: emptyServer }];
  let now = 1_000_000;

  for (let turn = 0; turn < length; turn += 1) {
    now += random.integer(random.next() < LONG_PAUSE_CHANCE ? 200_000 : 3000);
    const current = Arr.lastNonEmpty(steps).server;

    const outcome =
      random.next() < ALARM_CHANCE
        ? Result.succeed(expire(current, now))
        : execute(current, randomCommand(random, current, now), now);

    if (Result.isSuccess(outcome)) {
      steps.push(outcome.success);
    }
  }

  return steps;
};

const jsonText = <
  S extends Schema.Top & {
    readonly DecodingServices: never;
    readonly EncodingServices: never;
  },
>(
  schema: S
) => Schema.fromJsonString(Schema.toCodecJson(schema));

const throughJson = <A>(codec: Schema.Codec<A, string>, value: A) =>
  Result.getOrThrow(
    Result.flatMap(
      Schema.encodeResult(codec)(value),
      Schema.decodeUnknownResult(codec)
    )
  );

const WorldJson = jsonText(World);
const EventsJson = jsonText(Schema.Array(WorldEvent));
const RejectionJson = jsonText(Rejection);
const ServerJson = jsonText(Server);

const laterEvents = (steps: readonly Step[], after: number) =>
  Arr.flatMap(Arr.drop(steps, after + 1), (step) => step.events);

const groundTiles = (world: World) =>
  Arr.flatMap(allEntities(world), (entity) =>
    entity.location._tag === "Ground" ? [entity.location.tile] : []
  );

const carriers = (world: World) =>
  Arr.flatMap(allEntities(world), (entity) =>
    entity.location._tag === "Carried" ? [entity.location.by] : []
  );

const isDistinct = (values: readonly unknown[]) =>
  new Set(values).size === values.length;

const anySeed = Schema.Int.check(
  Schema.isBetween({ maximum: 1_000_000, minimum: 1 })
);

describe("replaying events onto a snapshot", () => {
  it.prop(
    "arrives at the server's public state from any snapshot",
    { seed: anySeed },
    ({ seed }) => {
      const steps = simulate(seed, 150);
      const final = Arr.lastNonEmpty(steps).server.world;

      assert.isAbove(steps.length, 40);

      for (const [index, step] of steps.entries()) {
        const replayed = evolveAll(
          throughJson(WorldJson, step.server.world),
          throughJson(EventsJson, laterEvents(steps, index))
        );

        assert.deepStrictEqual(replayed, final);
      }
    },
    { arbitrary: { runs: 20 } }
  );

  it("exercises every kind of event", () => {
    const tags = new Set(
      Arr.flatMap(simulate(7, 2000), (step) =>
        Arr.map(step.events, (event) => event._tag)
      )
    );

    expect(Arr.sort(tags, Order.String)).toStrictEqual(
      Arr.sort(Record.keys(WorldEvent.cases), Order.String)
    );
  });

  it.prop(
    "keeps the world's invariants",
    { seed: anySeed },
    ({ seed }) => {
      for (const { server } of simulate(seed, 300)) {
        const onGround = groundTiles(server.world);
        assert.isTrue(isDistinct(Arr.map(onGround, tileIndex)));
        assert.isTrue(Arr.every(onGround, isLand));
        assert.isAtMost(allEntities(server.world).length, ENTITY_LIMIT);
        assert.isTrue(isDistinct(carriers(server.world)));
      }
    },
    { arbitrary: { runs: 10 } }
  );
});

describe("JSON boundaries", () => {
  it("round-trips rejections", () => {
    const rejection = Result.getFailure(
      execute(
        emptyServer,
        Command.cases.Destroy.make({
          actor: Username.make("alice"),
          entity: entityIdFor(9),
        }),
        0
      )
    );

    expect(
      Option.map(rejection, (failure) => throughJson(RejectionJson, failure))
    ).toStrictEqual(rejection);
  });

  it("round-trips the whole server state", () => {
    const { server } = Arr.lastNonEmpty(simulate(3, 200));

    expect(throughJson(ServerJson, server)).toStrictEqual(server);
  });
});
