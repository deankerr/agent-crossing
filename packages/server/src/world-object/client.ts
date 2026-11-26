import * as View from "@agent-crossing/views/View";
import * as Command from "@agent-crossing/world/Command";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import { StreamItem, Verdict } from "./wire.ts";
import WorldObject, { WORLD_NAME } from "./world-object.ts";

const decodeVerdict = Schema.decodeUnknownEffect(Verdict);
const decodeStreamItem = Schema.decodeUnknownEffect(StreamItem);
const decodeText = Schema.decodeUnknownEffect(Schema.String);

const encodeCommand = Schema.encodeEffect(Command.Command);
const encodeView = Schema.encodeEffect(View.View);

/** The World object as typed calls: decoded values in and out, for the one world every caller shares. */
export class WorldClient extends Context.Service<
  WorldClient,
  {
    readonly act: (
      command: typeof Command.Command.Type
    ) => Effect.Effect<typeof Verdict.Type>;
    /** The view in words. */
    readonly view: (view: typeof View.View.Type) => Effect.Effect<string>;
    /** The world's stream, opened afresh by each run. */
    readonly follow: Stream.Stream<typeof StreamItem.Type, unknown>;
  }
>()("agent-crossing/WorldClient", {
  make: Effect.gen(function* () {
    const worlds = yield* WorldObject;
    const world = worlds.getByName(WORLD_NAME);
    const runtime = yield* Effect.context();

    const decoded = <A, E, R>(answer: Effect.Effect<A, E, R>) =>
      answer.pipe(Effect.provideContext(runtime), Effect.orDie);

    return {
      act: (command) =>
        decoded(
          encodeCommand(command).pipe(
            Effect.flatMap((encoded) => world.act(encoded)),
            Effect.flatMap(decodeVerdict)
          )
        ),
      follow: Stream.suspend(() =>
        world.follow().pipe(
          Stream.mapEffect((item) => decodeStreamItem(item)),
          Stream.provideContext(runtime)
        )
      ),
      view: (view) =>
        decoded(
          encodeView(view).pipe(
            Effect.flatMap((encoded) => world.view(encoded)),
            Effect.flatMap(decodeText)
          )
        ),
    };
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}
