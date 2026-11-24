import { Editor } from "@agent-crossing/world/values";
import * as Arr from "effect/Array";
import * as Data from "effect/Data";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

export const TOKENS_VARIABLE = "AGENT_CROSSING_ADMIN_TOKENS";

export const Token = Schema.String.check(
  Schema.isPattern(/^[\w.~-]{16,256}$/u)
).pipe(Schema.brand("Token"));

export type Token = typeof Token.Type;

export class MalformedTokens extends Data.TaggedError("MalformedTokens")<{
  readonly message: string;
}> {}

export interface Pair {
  readonly editor: Editor;
  readonly token: Token;
}

/** Who may edit the world, by token. */
export interface Editors {
  readonly pairs: readonly Pair[];
  readonly byToken: HashMap.HashMap<Token, Editor>;
}

const malformed = (message: string) =>
  Result.fail(
    new MalformedTokens({
      message: `${TOKENS_VARIABLE} is malformed: ${message}. Write comma-separated name:token pairs, each name 1-24 characters and each token at least 16 characters of letters, digits, _ . ~ or -.`,
    })
  );

const decodeEditor = Schema.decodeUnknownResult(Editor);
const decodeToken = Schema.decodeUnknownResult(Token);

const parsePair = (pair: string) =>
  Option.match(Str.indexOf(":")(pair), {
    onNone: () => malformed(`"${Str.trim(pair)}" has no colon`),
    onSome: (colon) => {
      const editor = decodeEditor(Str.slice(0, colon)(pair));
      const token = decodeToken(Str.trim(Str.slice(colon + 1)(pair)));

      if (Result.isFailure(editor)) {
        return malformed(
          `the name before the colon in a pair is not 1-24 characters`
        );
      }

      if (Result.isFailure(token)) {
        return malformed(`the token for ${editor.success} is not acceptable`);
      }

      return Result.succeed<Pair>({
        editor: editor.success,
        token: token.success,
      });
    },
  });

const clashes = (a: Pair, b: Pair) =>
  Str.toLowerCase(a.editor) === Str.toLowerCase(b.editor) ||
  a.token === b.token;

/** Parses `name:token` pairs separated by commas or newlines. */
export const parseEditors = (text: string) =>
  Result.flatMap(
    Result.all(
      Arr.map(
        Arr.filter(Str.split(text, /[,\n]/u), (pair) => Str.trim(pair) !== ""),
        parsePair
      )
    ),
    (pairs) => {
      if (pairs.length === 0) {
        return malformed("it names nobody");
      }

      const clash = Arr.findFirst(pairs, (pair, index) =>
        Arr.some(pairs.slice(index + 1), (other) => clashes(pair, other))
      );

      if (Option.isSome(clash)) {
        return malformed(
          `${clash.value.editor} shares its name (ignoring case) or its token with another pair`
        );
      }

      return Result.succeed<Editors>({
        byToken: HashMap.fromIterable(
          Arr.map(pairs, ({ editor, token }) => [token, editor] as const)
        ),
        pairs,
      });
    }
  );

export const bearerToken = (authorization: string | undefined) =>
  Option.flatMap(
    Option.fromNullishOr(
      /^Bearer\s+(?<token>\S+)\s*$/iu.exec(authorization ?? "")?.groups?.token
    ),
    (token) => Option.getSuccess(decodeToken(token))
  );

/** The editor an `Authorization` header names, if its token is known. */
export const editorFor = (
  editors: Editors,
  authorization: string | undefined
) =>
  Option.flatMap(bearerToken(authorization), (token) =>
    HashMap.get(editors.byToken, token)
  );
