import * as Tool from "effect/ai/Tool";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

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
