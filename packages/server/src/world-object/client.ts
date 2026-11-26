import { PrefabName } from "@agent-crossing/world/definitions/prefabs";
import { Command } from "@agent-crossing/world/editing/command";
import { Region } from "@agent-crossing/world/editing/region";
import { Cell } from "@agent-crossing/world/schema/cell";
import { Area } from "@agent-crossing/world/state/area";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import { FeedItem, Verdict } from "./wire.ts";
import WorldObject, { WORLD_NAME } from "./world-object.ts";

const decodeVerdict = Schema.decodeUnknownEffect(Verdict);
const decodeFeedItem = Schema.decodeUnknownEffect(FeedItem);
const decodeText = Schema.decodeUnknownEffect(Schema.String);

const decodeMaybeText = Schema.decodeUnknownEffect(
  Schema.NullOr(Schema.String)
);

const encodeCommand = Schema.encodeEffect(Command);
const encodeCell = Schema.encodeEffect(Cell);
const encodeArea = Schema.encodeEffect(Schema.NullOr(Area));
const encodeRegion = Schema.encodeEffect(Schema.NullOr(Region));
const encodePrefab = Schema.encodeEffect(Schema.NullOr(PrefabName));

/** The World object as typed calls: decoded values in and out, for the one world every caller shares. */
export class WorldClient extends Context.Service<
  WorldClient,
  {
    readonly act: (
      command: typeof Command.Type
    ) => Effect.Effect<typeof Verdict.Type>;
    readonly summary: Effect.Effect<string>;
    /** The map of the area, or of the whole world; none when no area is given and the world is empty. */
    readonly map: (
      area: Option.Option<typeof Area.Type>
    ) => Effect.Effect<Option.Option<string>>;
    readonly inspect: (cell: typeof Cell.Type) => Effect.Effect<string>;
    readonly find: (
      region: Option.Option<typeof Region.Type>,
      prefab: Option.Option<typeof PrefabName.Type>,
      limit: number
    ) => Effect.Effect<string>;
    readonly history: (limit: number) => Effect.Effect<string>;
    /** The spectator feed, opened afresh by each run. */
    readonly feed: Stream.Stream<typeof FeedItem.Type, unknown>;
  }
>()("agent-crossing/WorldClient", {
  make: Effect.gen(function* () {
    const worlds = yield* WorldObject;
    const world = worlds.getByName(WORLD_NAME);
    const runtime = yield* Effect.context();

    const decoded = <A, E, R>(answer: Effect.Effect<A, E, R>) =>
      answer.pipe(Effect.provideContext(runtime), Effect.orDie);

    const text = <E, R>(answer: Effect.Effect<unknown, E, R>) =>
      decoded(Effect.flatMap(answer, decodeText));

    return {
      act: (command) =>
        decoded(
          encodeCommand(command).pipe(
            Effect.flatMap((encoded) => world.act(encoded)),
            Effect.flatMap(decodeVerdict)
          )
        ),
      feed: Stream.suspend(() =>
        world.feed().pipe(
          Stream.mapEffect((item) => decodeFeedItem(item)),
          Stream.provideContext(runtime)
        )
      ),
      find: (region, prefab, limit) =>
        text(
          Effect.gen(function* () {
            const within = yield* encodeRegion(Option.getOrNull(region));
            const only = yield* encodePrefab(Option.getOrNull(prefab));

            return yield* world.find(within, only, limit);
          })
        ),
      history: (limit) => text(world.history(limit)),
      inspect: (cell) =>
        text(Effect.flatMap(encodeCell(cell), (at) => world.inspect(at))),
      map: (area) =>
        decoded(
          encodeArea(Option.getOrNull(area)).pipe(
            Effect.flatMap((shown) => world.map(shown)),
            Effect.flatMap(decodeMaybeText),
            Effect.map(Option.fromNullishOr)
          )
        ),
      summary: text(Effect.suspend(() => world.summary())),
    };
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}
