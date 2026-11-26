import * as Command from "@agent-crossing/world/Command";
import * as Toolkit from "effect/ai/Toolkit";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Record from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as Str from "effect/String";

import { AFTER_EDIT, editing } from "../edit.ts";
import { editTool } from "../tool.ts";

type Member = (typeof Command.Command.members)[number];

type Tag = (typeof Command.Command.Type)["_tag"];

const hints = {
  ChangeEntity: { destructive: true, idempotent: true },
  ClearRegion: { destructive: true, idempotent: true },
  FillRegion: { destructive: true, idempotent: true },
  GenerateWorld: { destructive: true, idempotent: false },
  MoveEntity: { destructive: true, idempotent: true },
  PlaceEntities: { destructive: false, idempotent: false },
  RemoveEntities: { destructive: true, idempotent: true },
  ScatterEntities: { destructive: false, idempotent: false },
} satisfies Record<
  Tag,
  { readonly destructive: boolean; readonly idempotent: boolean }
>;

const Asked = Schema.Record(Schema.String, Schema.Unknown);

const decodeCommand = Schema.decodeUnknownResult(Command.Command);

const tagOf = (member: Member) => member.fields._tag.schema.literal;

const nameOf = (member: Member) => Str.pascalToSnake(tagOf(member));

const toolOf = (member: Member) => {
  const { _tag, ...rest } = member.fields;

  const fields: { readonly [field: string]: Schema.Codec<unknown, unknown> } =
    rest;

  return editTool(
    nameOf(member),
    {
      description: `${SchemaAST.resolveDescription(member.ast) ?? ""} ${AFTER_EDIT}`,
      parameters: Schema.Struct(fields),
    },
    hints[tagOf(member)]
  );
};

const commandOf = (member: Member, asked: typeof Asked.Type) =>
  Result.mapError(
    decodeCommand({ ...asked, _tag: tagOf(member) }),
    (issue) => `The edit is not valid: ${issue.message}`
  );

const toolkit = Toolkit.make(...Arr.map(Command.Command.members, toolOf));

const handlers = Effect.map(editing, (edit) =>
  Record.fromEntries(
    Arr.map(Command.Command.members, (member) => [
      nameOf(member),
      (asked: typeof Asked.Type) => edit(commandOf(member, asked)),
    ])
  )
);

/**
 * One tool for each command, which is the command itself: named for it in
 * snake case, taking its fields but its tag, and described by it.
 */
export const CommandTools = { handlers, toolkit };
