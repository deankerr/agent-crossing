import { EntityId } from "@agent-crossing/world/state/entity";
import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { AFTER_EDIT, editing } from "../edit.ts";
import { ComponentsInput, parsedCommand } from "../inputs.ts";
import { reply, textContent } from "../tool.ts";

export const ChangeInput = Schema.Struct({
  id: EntityId.annotate({ description: "The entity's id, like e12." }),
  components: ComponentsInput.annotate({
    description:
      'The entity\'s own components, replacing those it had; its prefab\'s still apply beneath. {} resets it to its prefab. Example: {"text":"Gone fishing","colors":{"board":"blue"}}.',
  }),
});

const ChangeEntity = Tool.make("change_entity", {
  ...reply,
  description: `Replaces an entity's own components, for example a sign's text or a block's colors; its prefab's components still apply beneath. ${AFTER_EDIT}`,
  parameters: ChangeInput,
})
  .annotate(Tool.Destructive, true)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false);

/** The command a change asks for, or what is wrong with it. */
export const changeCommand = (input: typeof ChangeInput.Type) =>
  parsedCommand({
    _tag: "Change",
    components: input.components,
    entity: input.id,
  });

const toolkit = Toolkit.make(ChangeEntity);

/** Registers `change_entity`: replaces an entity's own components. */
export const changeEntity = McpServer.registerToolkit(toolkit, {
  content: { change_entity: textContent },
}).pipe(
  Effect.provide(
    toolkit.toLayer(
      Effect.map(editing, (edit) => ({
        change_entity: (input) => edit(changeCommand(input)),
      }))
    )
  )
);
