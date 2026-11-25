import { EntityId } from "@agent-crossing/world/state/entity";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { AFTER_EDIT, editing } from "../edit.ts";
import { ComponentsInput, parsedCommand } from "../inputs.ts";
import { editTool } from "../tool.ts";

const ChangeInput = Schema.Struct({
  id: EntityId.annotate({ description: "The entity's id, like e12." }),
  components: ComponentsInput.annotate({
    description:
      'The entity\'s own components, replacing those it had; its prefab\'s still apply beneath. {} resets it to its prefab. Example: {"text":"Gone fishing","colors":{"board":"blue"}}.',
  }),
});

/** `change_entity`: replaces an entity's own components. */
export const ChangeEntity = editTool(
  "change_entity",
  {
    description: `Replaces an entity's own components, for example a sign's text or a block's colors; its prefab's components still apply beneath. ${AFTER_EDIT}`,
    parameters: ChangeInput,
  },
  { destructive: true, idempotent: true }
);

/** The handler of `change_entity`. */
export const changeEntity = Effect.map(
  editing,
  (edit) => (input: typeof ChangeInput.Type) =>
    edit(
      parsedCommand({
        _tag: "Change",
        components: input.components,
        entity: input.id,
      })
    )
);
