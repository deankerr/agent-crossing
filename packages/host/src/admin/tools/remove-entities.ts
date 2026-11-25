import { PrefabName } from "@agent-crossing/world/definitions/prefabs";
import { EntityId } from "@agent-crossing/world/state/entity";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { AFTER_EDIT, editing } from "../edit.ts";
import { parsedCommand, RegionInput, regionOf } from "../inputs.ts";
import { editTool } from "../tool.ts";

const RemoveInput = Schema.Struct({
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

/** `remove_entities`: removes entities by id or from a region. */
export const RemoveEntities = editTool(
  "remove_entities",
  {
    description: `Removes entities, either listed by id or everything in a region. In a region without a prefab the floors and liquids stay; with a prefab, only entities of that prefab go. ${AFTER_EDIT}`,
    parameters: RemoveInput,
  },
  { destructive: true, idempotent: true }
);

const removeCommand = ({ ids, region, ...only }: typeof RemoveInput.Type) => {
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

/** The handler of `remove_entities`. */
export const removeEntities = Effect.map(
  editing,
  (edit) => (input: typeof RemoveInput.Type) => edit(removeCommand(input))
);
