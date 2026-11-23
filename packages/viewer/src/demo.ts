import { Command } from "@agent-crossing/world/command";
import { Item } from "@agent-crossing/world/entity";
import type { WorldEvent } from "@agent-crossing/world/event";
import { neighbours, tileAt } from "@agent-crossing/world/grid";
import type { Tile } from "@agent-crossing/world/grid";
import { execute, expire } from "@agent-crossing/world/presence";
import { isLand } from "@agent-crossing/world/terrain";
import { DisplayName, Text, Username } from "@agent-crossing/world/values";
import type { Colour } from "@agent-crossing/world/values";
import { positionAt, walkInProgressAt } from "@agent-crossing/world/walk";
import {
  carriedBy,
  characterOf,
  emptyServer,
  entityCount,
  entityOnTile,
} from "@agent-crossing/world/world";
import type { Server, World } from "@agent-crossing/world/world";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Record from "effect/Record";
import * as Result from "effect/Result";

import { randomFrom } from "./random.ts";
import type { Random } from "./random.ts";

export const DEMO_SEED = 1124;
export const STEP_MILLIS = 250;
export const PREHISTORY_MILLIS = 240_000;

const WANDER_RADIUS = 5;
const CROWDED = 45;
const SPARSE = 24;
const NAP_CHANCE = 0.01;
const NAP_MILLIS = 125_000;
const NAP_SPREAD = 40_000;

interface CastMember {
  readonly username: Username;
  readonly home: readonly [number, number];
  readonly names: readonly [DisplayName, ...DisplayName[]];
}

const member = (
  username: string,
  home: readonly [number, number],
  names: readonly [string, ...string[]]
) =>
  ({
    home,
    names: Arr.map(names, (name) => DisplayName.make(name)),
    username: Username.make(username),
  }) satisfies CastMember;

export const cast: readonly [CastMember, ...CastMember[]] = [
  member("fern", [13, 14], ["Fern", "Fernsby", "Fern the Gardener"]),
  member("mossy", [19, 15], ["Mossy", "Moss", "Captain Moss"]),
  member("pip", [15, 19], ["Pip", "Pipsqueak", "Pip the Builder"]),
  member("juniper", [18, 19], ["Juniper", "June", "Juni"]),
  member("wisp", [14, 17], ["Wisp", "Will-o-Wisp", "Wispy"]),
];

const sayings = [
  "Good morning, everyone!",
  "These flowers smell lovely.",
  "Has anyone seen my red block?",
  "I think I will build a little wall here.",
  "The pond looks so calm today.",
  "Who put this sign up?",
  "Let's plant a garden by the hill.",
  "I'm going for a wander.",
  "What a nice breeze.",
  "Hello neighbour!",
] as const;

const signTexts = [
  "Welcome to the meadow",
  "Please water the flowers",
  "Pond ahead, mind your step",
  "Fern's garden",
  "Bridge coming soon",
  "Free blocks, take one!",
  "Quiet hill: shh",
] as const;

const colours: readonly [Colour, ...Colour[]] = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "white",
];

interface Nap {
  readonly from: number;
  readonly until: number;
}

export interface Demo {
  readonly server: Server;
  readonly seed: number;
  readonly seq: number;
  readonly nextActionAt: number;
  readonly naps: Readonly<Record<string, Nap>>;
}

export interface Stepped {
  readonly demo: Demo;
  readonly events: readonly WorldEvent[];
}

const isNapping = (demo: Demo, username: Username, now: number) =>
  Option.exists(
    Option.fromNullishOr(demo.naps[username]),
    (nap) => nap.from <= now && now < nap.until
  );

const anyoneNapping = (demo: Demo, now: number) =>
  Arr.some(Record.values(demo.naps), (nap) => now < nap.until);

const isFreeLand = (world: World, tile: Tile) =>
  isLand(tile) && Option.isNone(entityOnTile(world, tile));

const randomItem = (random: Random) => {
  const roll = random.next();

  if (roll < 0.42) {
    return Item.cases.Block.make({ colour: random.pick(colours) });
  }

  if (roll < 0.86) {
    return Item.cases.Flower.make({ colour: random.pick(colours) });
  }

  return Item.cases.Sign.make({ text: Text.make(random.pick(signTexts)) });
};

const wanderTarget = (world: World, actor: CastMember, random: Random) =>
  Arr.findFirst(
    Arr.getSomes(
      Arr.makeBy(8, () =>
        tileAt(
          actor.home[0] + random.integer(WANDER_RADIUS * 2 + 1) - WANDER_RADIUS,
          actor.home[1] + random.integer(WANDER_RADIUS * 2 + 1) - WANDER_RADIUS
        )
      )
    ),
    (tile) => isFreeLand(world, tile)
  );

const createWeight = (count: number) => {
  if (count > CROWDED) {
    return 3;
  }

  return count < SPARSE ? 30 : 16;
};

const pickWeighted = <A>(
  random: Random,
  choices: readonly (readonly [number, () => Option.Option<A>])[]
) => {
  const total = Arr.reduce(choices, 0, (sum, [weight]) => sum + weight);
  const roll = random.next() * total;

  const chosen = Arr.reduce(
    choices,
    { found: Option.none<() => Option.Option<A>>(), sum: 0 },
    (sofar, [weight, choose]) =>
      Option.isSome(sofar.found) || roll >= sofar.sum + weight
        ? { ...sofar, sum: sofar.sum + weight }
        : { found: Option.some(choose), sum: sofar.sum + weight }
  );

  return Option.flatMap(chosen.found, (choose) => choose());
};

const someOf = <A>(items: readonly A[], random: Random) =>
  Arr.match(items, {
    onEmpty: () => Option.none<A>(),
    onNonEmpty: (present) => Option.some(random.pick(present)),
  });

const commandFor = (
  world: World,
  actor: CastMember,
  now: number,
  random: Random
) => {
  const { username } = actor;

  const say = () =>
    Option.some(
      Command.cases.Say.make({
        actor: username,
        text: Text.make(random.pick(sayings)),
      })
    );

  return Option.match(
    Option.filter(characterOf(world, username), (found) => found.present),
    {
      onNone: () => Option.some(Command.cases.Look.make({ actor: username })),
      onSome: (character) => {
        if (Option.isSome(walkInProgressAt(character.motion, now))) {
          return random.chance(0.15) ? say() : Option.none<Command>();
        }

        const position = positionAt(character.motion, now);
        const around = neighbours(position);
        const carrying = carriedBy(world, username);

        const nearby = Arr.getSomes(
          Arr.map(around, (tile) => entityOnTile(world, tile))
        );

        const free = Arr.filter(around, (tile) => isFreeLand(world, tile));
        const count = entityCount(world);
        const crowded = count > CROWDED;

        return pickWeighted<Command>(random, [
          [
            40,
            () =>
              Option.map(wanderTarget(world, actor, random), (to) =>
                Command.cases.Move.make({ actor: username, to })
              ),
          ],
          [
            createWeight(count),
            () =>
              Option.map(someOf(free, random), (tile) =>
                Command.cases.Create.make({
                  actor: username,
                  item: randomItem(random),
                  tile,
                })
              ),
          ],
          [
            Option.isNone(carrying) ? 14 : 0,
            () =>
              Option.map(someOf(nearby, random), (entity) =>
                Command.cases.PickUp.make({
                  actor: username,
                  entity: entity.id,
                })
              ),
          ],
          [
            Option.isSome(carrying) ? 18 : 0,
            () =>
              Option.map(someOf(free, random), (tile) =>
                Command.cases.PutDown.make({ actor: username, tile })
              ),
          ],
          [
            crowded ? 18 : 3,
            () =>
              Option.map(someOf(nearby, random), (entity) =>
                Command.cases.Destroy.make({
                  actor: username,
                  entity: entity.id,
                })
              ),
          ],
          [10, say],
          [
            2,
            () =>
              Option.some(
                Command.cases.Rename.make({
                  actor: username,
                  name: random.pick(actor.names),
                })
              ),
          ],
        ]);
      },
    }
  );
};

const act = (server: Server, command: Command, now: number) =>
  Result.match(execute(server, command, now), {
    onFailure: () => Option.none(),
    onSuccess: Option.some,
  });

const withNap = (demo: Demo, actor: CastMember, now: number, random: Random) =>
  !anyoneNapping(demo, now) && random.chance(NAP_CHANCE)
    ? {
        ...demo.naps,
        [actor.username]: {
          from: now,
          until: now + NAP_MILLIS + random.integer(NAP_SPREAD),
        },
      }
    : demo.naps;

export const step = (demo: Demo, now: number) => {
  const expired = expire(demo.server, now);

  if (now < demo.nextActionAt) {
    const idle: Stepped = {
      demo: {
        ...demo,
        seq: demo.seq + expired.events.length,
        server: expired.server,
      },
      events: expired.events,
    };

    return idle;
  }

  const random = randomFrom(demo.seed);

  const awake = Arr.filter(
    cast,
    (actor) => !isNapping(demo, actor.username, now)
  );

  const actor = Arr.match(awake, {
    onEmpty: () => Option.none<CastMember>(),
    onNonEmpty: (members) => Option.some(random.pick(members)),
  });

  const outcome = Option.flatMap(actor, (chosen) =>
    Option.flatMap(
      commandFor(expired.server.world, chosen, now, random),
      (command) => act(expired.server, command, now)
    )
  );

  const events = Arr.appendAll(
    expired.events,
    Option.match(outcome, {
      onNone: () => [],
      onSome: (done) => done.events,
    })
  );

  const stepped: Stepped = {
    demo: {
      naps: Option.match(actor, {
        onNone: () => demo.naps,
        onSome: (chosen) => withNap(demo, chosen, now, random),
      }),
      nextActionAt: now + 300 + random.integer(800),
      seed: random.state(),
      seq: demo.seq + events.length,
      server: Option.match(outcome, {
        onNone: () => expired.server,
        onSome: (done) => done.server,
      }),
    },
    events,
  };

  return stepped;
};

const arrive = (server: Server, actor: CastMember, at: number) =>
  Option.match(
    act(server, Command.cases.Look.make({ actor: actor.username }), at),
    {
      onNone: () => server,
      onSome: (done) => done.server,
    }
  );

export const openDemo = (seed: number, now: number) => {
  const start = now - PREHISTORY_MILLIS;
  const sleeper = Arr.lastNonEmpty(cast);

  const arrived = Arr.reduce(cast, emptyServer, (server, actor) =>
    arrive(server, actor, start)
  );

  const begun: Demo = {
    naps: {
      [sleeper.username]: { from: now - 100_000, until: now + 45_000 },
    },
    nextActionAt: start,
    seed,
    seq: 0,
    server: arrived,
  };

  return Arr.reduce(
    Arr.makeBy(
      Math.floor(PREHISTORY_MILLIS / STEP_MILLIS),
      (index) => start + (index + 1) * STEP_MILLIS
    ),
    begun,
    (demo, at) => step(demo, at).demo
  );
};
