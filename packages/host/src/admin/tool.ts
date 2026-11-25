import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

/** A tool call that did nothing, with the reason and what would work. */
export class Refused extends Schema.TaggedError<
  Refused,
  { readonly brand: unique symbol }
>()("Refused", { message: Schema.String }) {}

/** What every admin tool has: it answers in text and may refuse. */
export const reply = {
  failure: Refused,
  success: Schema.String,
};

/** A tool's text answer as the MCP content of its result. */
export const textContent = (text: string) => [{ text, type: "text" as const }];

/** Refuses the call with a sentence saying why. */
export const refused = (message: string) =>
  Effect.fail(new Refused({ message }));

/** The parsed value, or the refusal its sentence describes. */
export const parsed = <A>(result: Result.Result<A, string>) =>
  Result.match(result, { onFailure: refused, onSuccess: Effect.succeed });
