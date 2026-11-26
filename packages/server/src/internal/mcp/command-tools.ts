import * as Command from "@agent-crossing/world/Command";
import * as Toolkit from "effect/ai/Toolkit";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Record from "effect/Record";

import { AFTER_EDIT, editing } from "./edit.ts";
import type { Arguments } from "./tool.ts";
import { editTool, parsedAs, asTool } from "./tool.ts";

type Member = (typeof Command.Command.members)[number];

type Tag = (typeof Command.Command.Type)["_tag"];

const hints = {
  ChangeEntity: { destructive: true, idempotent: true },
  ClearRegion: { destructive: true, idempotent: true },
  FillRegion: { destructive: true, idempotent: true },
  MoveEntity: { destructive: true, idempotent: true },
  PlaceEntities: { destructive: false, idempotent: false },
  RemoveEntities: { destructive: true, idempotent: true },
  ScatterEntities: { destructive: false, idempotent: false },
} satisfies Record<
  Tag,
  { readonly destructive: boolean; readonly idempotent: boolean }
>;

const commandOf = parsedAs(Command.Command, "The edit");

const toolOf = (member: Member) => {
  const { description, name, parameters } = asTool(member);

  return editTool(
    name,
    { description: `${description} ${AFTER_EDIT}`, parameters },
    hints[member.fields._tag.schema.literal]
  );
};

const toolkit = Toolkit.make(...Arr.map(Command.Command.members, toolOf));

const handlers = Effect.map(editing, (edit) =>
  Record.fromEntries(
    Arr.map(Command.Command.members, (member) => [
      asTool(member).name,
      (asked: typeof Arguments.Type) => edit(commandOf(member, asked)),
    ])
  )
);

/**
 * One tool for each command, which is the command itself: named for it in
 * snake case, taking its fields but its tag, and described by it.
 */
export const CommandTools = { handlers, toolkit };
