import { PrefabName } from "@agent-crossing/world/definitions/prefabs";
import {
  FIND_DEFAULT_LIMIT,
  FIND_MAX_LIMIT,
} from "@agent-crossing/world/text/find";
import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { WorldClient } from "../../world-object/client.ts";
import { parsedRegion, RegionInput } from "../inputs.ts";
import { parsed, reply, textContent } from "../tool.ts";

export const FindEntitiesInput = Schema.Struct({
  region: Schema.optionalKey(RegionInput),
  prefab: Schema.optionalKey(PrefabName),
  limit: Schema.optionalKey(Schema.Int),
});

const FindEntities = Tool.make("find_entities", {
  ...reply,
  description: `Lists entities with their ids, prefabs and cells, oldest first: in a region or the whole world. Without a prefab it lists every entity but the floors and liquids; with one, only entities of that prefab. Shows at most \`limit\` (default ${FIND_DEFAULT_LIMIT}, at most ${FIND_MAX_LIMIT}) and says how many there are in all.`,
  parameters: FindEntitiesInput,
})
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false);

const toolkit = Toolkit.make(FindEntities);

/** Registers `find_entities`: entities with their ids, in a region or everywhere. */
export const findEntities = McpServer.registerToolkit(toolkit, {
  content: { find_entities: textContent },
}).pipe(
  Effect.provide(
    toolkit.toLayer(
      Effect.map(WorldClient, (world) => ({
        find_entities: ({ limit, prefab, region }) =>
          Effect.gen(function* () {
            const within = yield* Option.match(Option.fromNullishOr(region), {
              onNone: () => Effect.succeedNone,
              onSome: (input) => Effect.asSome(parsed(parsedRegion(input))),
            });

            return yield* world.find(
              within,
              Option.fromNullishOr(prefab),
              limit ?? FIND_DEFAULT_LIMIT
            );
          }),
      }))
    )
  )
);
