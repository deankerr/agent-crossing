import * as Entity from "@agent-crossing/world/Entity";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { AFTER_EDIT, editing } from "../edit.ts";
import { parsedCommand, X, Y } from "../inputs.ts";
import { editTool } from "../tool.ts";

const MoveInput = Schema.Struct({
  id: Entity.Id.annotate({ description: "The entity's id, like e12." }),
  x: X,
  y: Y,
});

/** `move_entity`: moves an entity to another cell. */
export const MoveEntity = editTool(
  "move_entity",
  {
    description: `Moves an entity to another cell, if it may be there. ${AFTER_EDIT}`,
    parameters: MoveInput,
  },
  { destructive: true, idempotent: true }
);

/** The handler of `move_entity`. */
export const moveEntity = Effect.map(
  editing,
  (edit) => (input: typeof MoveInput.Type) =>
    edit(
      parsedCommand({
        _tag: "Move",
        entity: input.id,
        to: { x: input.x, y: input.y },
      })
    )
);
