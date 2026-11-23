import { Command } from "@agent-crossing/world/command";
import { EntityId, Item } from "@agent-crossing/world/entity";
import { Coordinate, Tile } from "@agent-crossing/world/grid";
import {
  Colour,
  DisplayName,
  NAME_MAX_LENGTH,
  Text,
  TEXT_MAX_LENGTH,
} from "@agent-crossing/world/values";
import type { Username } from "@agent-crossing/world/values";
import { arrivalAt } from "@agent-crossing/world/walk";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Arr from "effect/Array";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { nearbyText, reservedNameText } from "./narration.ts";
import { actedText, arrivedText, lookedText, refusalOf } from "./replies.ts";
import { reservedBy } from "./tokens.ts";
import type { Characters } from "./tokens.ts";
import type { CatchUp, Report } from "./wire.ts";

export class Caller extends Context.Service<
  Caller,
  { readonly username: Username }
>()("agent-crossing/Caller") {}

export class Refused extends Schema.TaggedError<
  Refused,
  { readonly brand: unique symbol }
>()("Refused", {
  message: Schema.String,
}) {}

const X = Coordinate.annotate({
  description: "Column, 0 (west edge) to 31 (east edge).",
});

const Y = Coordinate.annotate({
  description: "Row, 0 (north edge) to 31 (south edge).",
});

const Thing = EntityId.annotate({
  description: "The id of an entity, like e12, as shown by look.",
});

const Placed = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("block"),
    colour: Colour,
  }),
  Schema.Struct({
    kind: Schema.Literal("flower"),
    colour: Colour,
  }),
  Schema.Struct({
    kind: Schema.Literal("sign"),
    text: Text.annotate({
      description: `What the sign says, 1-${TEXT_MAX_LENGTH} characters.`,
    }),
  }),
]).annotate({
  description:
    "What to create: a block or flower in a colour, or a sign with text.",
});

const reply = {
  dependencies: [Caller],
  failure: Refused,
  success: Schema.String,
};

export const Tools = Toolkit.make(
  Tool.make("look", {
    ...reply,
    description:
      "See your position, a map of the 17x17 tiles around you, and the entities and characters within 8 tiles.",
  }),
  Tool.make("move_to", {
    ...reply,
    description:
      "Walk to a free land tile. Returns when you arrive, at 3 tiles per second, at most about 20 seconds.",
    parameters: Schema.Struct({ x: X, y: Y }),
  }),
  Tool.make("pick_up", {
    ...reply,
    description:
      "Pick up an entity on one of the four tiles beside you. You carry at most one.",
    parameters: Schema.Struct({ entity: Thing }),
  }),
  Tool.make("put_down", {
    ...reply,
    description:
      "Put what you carry on a free land tile beside you (north, east, south or west).",
    parameters: Schema.Struct({ x: X, y: Y }),
  }),
  Tool.make("create", {
    ...reply,
    description:
      "Create a block, a flower or a sign on a free land tile beside you (north, east, south or west).",
    parameters: Schema.Struct({ x: X, y: Y, item: Placed }),
  }),
  Tool.make("destroy", {
    ...reply,
    description: "Destroy an entity on one of the four tiles beside you.",
    parameters: Schema.Struct({ entity: Thing }),
  }),
  Tool.make("say", {
    ...reply,
    description: "Say something to every character within 8 tiles.",
    parameters: Schema.Struct({
      text: Text.annotate({
        description: `What to say, 1-${TEXT_MAX_LENGTH} characters.`,
      }),
    }),
  }),
  Tool.make("set_name", {
    ...reply,
    description:
      "Choose the name others see for your character. It must differ, ignoring case, from every other character's name and username.",
    parameters: Schema.Struct({
      name: DisplayName.annotate({
        description: `Your new name, 1-${NAME_MAX_LENGTH} characters.`,
      }),
    }),
  })
);

export interface WorldClient {
  readonly act: (command: Command) => Effect.Effect<Report>;
  readonly catchUp: (username: Username) => Effect.Effect<CatchUp>;
}

const answered = (report: Report, text: (report: Report) => string) =>
  Option.match(refusalOf(report), {
    onNone: () => Effect.succeed(text(report)),
    onSome: (message) => Effect.fail(new Refused({ message })),
  });

const tileOf = ({ x, y }: { readonly x: Coordinate; readonly y: Coordinate }) =>
  Tile.make({ x, y });

const itemOf = (placed: typeof Placed.Type) =>
  Match.value(placed).pipe(
    Match.discriminatorsExhaustive("kind")({
      block: ({ colour }) => Item.cases.Block.make({ colour }),
      flower: ({ colour }) => Item.cases.Flower.make({ colour }),
      sign: ({ text }) => Item.cases.Sign.make({ text }),
    })
  );

const arrivalOf = (report: Report, self: Username) =>
  report.verdict._tag === "Accepted"
    ? Arr.findFirst(report.verdict.events, (event) =>
        event._tag === "WalkStarted" && event.actor === self
          ? Option.some(arrivalAt(event.path, event.at))
          : Option.none()
      )
    : Option.none<number>();

export const toolHandlers = (world: WorldClient, characters: Characters) => {
  const acting = (
    command: (actor: Username) => Command,
    text: (report: Report, self: Username) => string = actedText
  ) =>
    Effect.gen(function* () {
      const { username } = yield* Caller;
      const report = yield* world.act(command(username));

      return yield* answered(report, (accepted) => text(accepted, username));
    });

  return Tools.toLayer({
    create: ({ item, x, y }) =>
      acting((actor) =>
        Command.cases.Create.make({
          actor,
          item: itemOf(item),
          tile: tileOf({ x, y }),
        })
      ),
    destroy: ({ entity }) =>
      acting((actor) => Command.cases.Destroy.make({ actor, entity })),
    look: () =>
      acting((actor) => Command.cases.Look.make({ actor }), lookedText),
    move_to: (to) =>
      Effect.gen(function* () {
        const { username } = yield* Caller;

        const departure = yield* world.act(
          Command.cases.Move.make({ actor: username, to: tileOf(to) })
        );

        yield* answered(departure, () => "");

        yield* Option.match(arrivalOf(departure, username), {
          onNone: () => Effect.void,
          onSome: (arrival) =>
            Effect.sleep(Duration.millis(Math.max(0, arrival - departure.now))),
        });

        const arrival = yield* world.catchUp(username);

        return arrivedText(departure, arrival, username);
      }),
    pick_up: ({ entity }) =>
      acting((actor) => Command.cases.PickUp.make({ actor, entity })),
    put_down: (at) =>
      acting((actor) =>
        Command.cases.PutDown.make({ actor, tile: tileOf(at) })
      ),
    say: ({ text }) =>
      acting((actor) => Command.cases.Say.make({ actor, text })),
    set_name: ({ name }) =>
      Effect.gen(function* () {
        const { username } = yield* Caller;

        return yield* Option.match(reservedBy(characters, name, username), {
          onNone: () =>
            acting((actor) => Command.cases.Rename.make({ actor, name })),
          onSome: (owner) =>
            Effect.flatMap(
              world.act(Command.cases.Look.make({ actor: username })),
              (report) =>
                Effect.fail(
                  new Refused({
                    message: `Refused: ${reservedNameText(name, owner)}\n\n${nearbyText(report.world, report.nearby, report.now, "since your last call")}`,
                  })
                )
            ),
        });
      }),
  });
};
