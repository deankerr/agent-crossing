import { EntityId } from "@agent-crossing/world/state/entity";
import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { AFTER_EDIT, editing } from "../edit.ts";
import { parsedCommand, X, Y } from "../inputs.ts";
import { reply, textContent } from "../tool.ts";

export const MoveInput = Schema.Struct({
  id: EntityId.annotate({ description: "The entity's id, like e12." }),
  x: X,
  y: Y,
});

const MoveEntity = Tool.make("move_entity", {
  ...reply,
  description: `Moves an entity to another cell, if it may be there. ${AFTER_EDIT}`,
  parameters: MoveInput,
})
  .annotate(Tool.Destructive, true)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false);

/** The command a move asks for, or what is wrong with it. */
export const moveCommand = (input: typeof MoveInput.Type) =>
  parsedCommand({
    _tag: "Move",
    entity: input.id,
    to: { x: input.x, y: input.y },
  });

const toolkit = Toolkit.make(MoveEntity);

/** Registers `move_entity`: moves an entity to another cell. */
export const moveEntity = McpServer.registerToolkit(toolkit, {
  content: { move_entity: textContent },
}).pipe(
  Effect.provide(
    toolkit.toLayer(
      Effect.map(editing, (edit) => ({
        move_entity: (input) => edit(moveCommand(input)),
      }))
    )
  )
);
