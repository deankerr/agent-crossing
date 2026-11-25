import { PrefabName } from "@agent-crossing/world/definitions/prefabs";
import { EntityId } from "@agent-crossing/world/state/entity";
import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { AFTER_EDIT, editing } from "../edit.ts";
import { parsedCommand, RegionInput, regionOf } from "../inputs.ts";
import { reply, textContent } from "../tool.ts";

export const RemoveInput = Schema.Struct({
  ids: Schema.optionalKey(
    Schema.NonEmptyArray(EntityId).annotate({
      description: 'The ids of the entities to remove, like ["e3", "e7"].',
    })
  ),
  region: Schema.optionalKey(RegionInput),
  prefab: Schema.optionalKey(
    PrefabName.annotate({
      description:
        "With region: remove only entities of this prefab, floors and liquids included.",
    })
  ),
});

const RemoveEntities = Tool.make("remove_entities", {
  ...reply,
  description: `Removes entities, either listed by id or everything in a region. In a region without a prefab the floors and liquids stay; with a prefab, only entities of that prefab go. ${AFTER_EDIT}`,
  parameters: RemoveInput,
})
  .annotate(Tool.Destructive, true)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false);

/** The command a removal asks for, or what is wrong with it. */
export const removeCommand = ({
  ids,
  region,
  ...only
}: typeof RemoveInput.Type) => {
  if (ids !== undefined && region !== undefined) {
    return Result.fail(
      "Give either ids or a region, not both: ids removes those entities, region (with an optional prefab) removes what is there."
    );
  }

  if (region !== undefined) {
    return parsedCommand({
      ...only,
      _tag: "RemoveIn",
      region: regionOf(region),
    });
  }

  if (ids !== undefined) {
    return only.prefab === undefined
      ? parsedCommand({ _tag: "Remove", entities: ids })
      : Result.fail(
          "prefab only narrows a region; with ids, the listed entities are removed whatever their prefab."
        );
  }

  return Result.fail(
    'Give ids (a non-empty list like ["e3"]) or a region to remove from.'
  );
};

const toolkit = Toolkit.make(RemoveEntities);

/** Registers `remove_entities`: removes entities by id or from a region. */
export const removeEntities = McpServer.registerToolkit(toolkit, {
  content: { remove_entities: textContent },
}).pipe(
  Effect.provide(
    toolkit.toLayer(
      Effect.map(editing, (edit) => ({
        remove_entities: (input) => edit(removeCommand(input)),
      }))
    )
  )
);
