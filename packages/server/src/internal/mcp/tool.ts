import * as Tool from "effect/ai/Tool";
import * as Effect from "effect/Effect";
import * as Record from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as Str from "effect/String";

class Refused extends Schema.TaggedError<
  Refused,
  { readonly brand: unique symbol }
>()("Refused", { message: Schema.String }) {}

const reply = {
  failure: Refused,
  success: Schema.String,
};

/** A tool that only reads the world: it answers in text and may refuse. */
export const queryTool = <
  const Name extends string,
  Parameters extends Schema.Constraint = typeof Tool.EmptyParams,
>(
  name: Name,
  options: { readonly description: string; readonly parameters?: Parameters }
) =>
  Tool.make(name, { ...reply, ...options })
    .annotate(Tool.Readonly, true)
    .annotate(Tool.Idempotent, true)
    .annotate(Tool.OpenWorld, false);

/** A tool that edits the world: it answers in text and may refuse. */
export const editTool = <
  const Name extends string,
  Parameters extends Schema.Constraint,
>(
  name: Name,
  options: { readonly description: string; readonly parameters: Parameters },
  hints: { readonly destructive: boolean; readonly idempotent: boolean }
) =>
  Tool.make(name, { ...reply, ...options })
    .annotate(Tool.Destructive, hints.destructive)
    .annotate(Tool.Idempotent, hints.idempotent)
    .annotate(Tool.OpenWorld, false);

/** A tool's text answer as the MCP content of its result. */
export const textContent = (text: string) => [{ text, type: "text" as const }];

/** Refuses the call with a sentence saying why. */
export const refused = (message: string) =>
  Effect.fail(new Refused({ message }));

/** The parsed value, or the refusal its sentence describes. */
export const parsed = <A>(result: Result.Result<A, string>) =>
  Result.match(result, { onFailure: refused, onSuccess: Effect.succeed });

/** A member of a tagged union that tools are built from, such as a command or a view. */
interface Member {
  readonly ast: SchemaAST.AST;
  readonly fields: {
    readonly _tag: Schema.tag<string>;
    readonly [field: string]: Schema.Codec<unknown, unknown>;
  };
}

/**
 * The tool a member of a tagged union becomes: named for its tag in snake
 * case, taking its fields but its tag, and described by it.
 */
export const asTool = (member: Member) => {
  const { _tag, ...fields } = member.fields;

  return {
    description: SchemaAST.resolveDescription(member.ast) ?? "",
    name: Str.pascalToSnake(_tag.schema.literal),
    parameters: Record.isEmptyRecord(fields)
      ? Tool.EmptyParams
      : Schema.Struct(fields),
  };
};

/** A tool's arguments, before they are parsed. */
export const Arguments = Schema.Record(Schema.String, Schema.Unknown);

/**
 * Parses a tool's arguments as the member of the union it was built from,
 * or says in a sentence, after `what`, why they are not one.
 */
export const parsedAs = <A>(union: Schema.Decoder<A>, what: string) => {
  const decode = Schema.decodeUnknownResult(union);

  return (member: Member, asked: typeof Arguments.Type) =>
    Result.mapError(
      decode({ ...asked, _tag: member.fields._tag.schema.literal }),
      (issue) => `${what} is not valid: ${issue.message}`
    );
};
