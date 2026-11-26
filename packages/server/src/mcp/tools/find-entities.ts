import * as Prefabs from "@agent-crossing/definitions/Prefabs";
import * as EntityListView from "@agent-crossing/views/EntityListView";
import * as Region from "@agent-crossing/world/Region";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { WorldClient } from "../../world-object/client.ts";
import { queryTool } from "../tool.ts";

const FindEntitiesInput = Schema.Struct({
  region: Schema.optionalKey(Region.Region),
  prefab: Schema.optionalKey(Prefabs.Name),
  limit: Schema.optionalKey(Schema.Int),
});

/** `find_entities`: entities with their ids, in a region or everywhere. */
export const FindEntities = queryTool("find_entities", {
  description: `Lists entities with their ids, prefabs and cells, oldest first: in a region or the whole world. Without a prefab it lists every entity but the floors and liquids; with one, only entities of that prefab. Shows at most \`limit\` (default ${EntityListView.DEFAULT_LIMIT}, at most ${EntityListView.MAX_LIMIT}) and says how many there are in all.`,
  parameters: FindEntitiesInput,
});

/** The handler of `find_entities`. */
export const findEntities = Effect.map(
  WorldClient,
  (world) =>
    ({ limit, prefab, region }: typeof FindEntitiesInput.Type) =>
      world.find(
        Option.fromNullishOr(region),
        Option.fromNullishOr(prefab),
        limit ?? EntityListView.DEFAULT_LIMIT
      )
);
