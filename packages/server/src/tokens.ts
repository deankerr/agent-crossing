import { sameName, Username } from "@agent-crossing/world/values";
import * as Arr from "effect/Array";
import * as Data from "effect/Data";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

export const Token = Schema.String.check(
  Schema.isPattern(/^[\w.~-]{16,256}$/u)
).pipe(Schema.brand("Token"));

export type Token = typeof Token.Type;

export class MalformedTokens extends Data.TaggedError("MalformedTokens")<{
  readonly message: string;
}> {}

export interface Characters {
  readonly usernames: readonly Username[];
  readonly byToken: HashMap.HashMap<Token, Username>;
}

const malformed = (message: string) =>
  Result.fail(
    new MalformedTokens({
      message: `AGENT_CROSSING_TOKENS is malformed: ${message}. Write comma-separated username:token pairs, each token at least 16 characters of letters, digits, _ . ~ or -.`,
    })
  );

const decodeUsername = Schema.decodeUnknownResult(Username);
const decodeToken = Schema.decodeUnknownResult(Token);

const parsePair = (pair: string) =>
  Option.match(Str.indexOf(":")(pair), {
    onNone: () => malformed(`"${pair}" has no colon`),
    onSome: (colon) => {
      const username = decodeUsername(Str.trim(Str.slice(0, colon)(pair)));
      const token = decodeToken(Str.trim(Str.slice(colon + 1)(pair)));

      if (Result.isFailure(username)) {
        return malformed(`the username in "${pair}" is not 1-24 characters`);
      }

      if (Result.isFailure(token)) {
        return malformed(`the token for ${username.success} is not acceptable`);
      }

      return Result.succeed({
        token: token.success,
        username: username.success,
      });
    },
  });

export const parseCharacters = (text: string) =>
  Result.flatMap(
    Result.all(
      Arr.map(
        Arr.filter(Str.split(text, /[,\n]/u), (pair) => Str.trim(pair) !== ""),
        parsePair
      )
    ),
    (pairs) => {
      if (pairs.length === 0) {
        return malformed("it names no characters");
      }

      const clash = Arr.findFirst(pairs, (pair, index) =>
        Arr.some(
          pairs.slice(index + 1),
          (other) =>
            sameName(other.username, pair.username) ||
            other.token === pair.token
        )
      );

      if (Option.isSome(clash)) {
        return malformed(
          `${clash.value.username} shares its username (ignoring case) or its token with another pair`
        );
      }

      return Result.succeed({
        byToken: HashMap.fromIterable(
          Arr.map(pairs, ({ token, username }) => [token, username] as const)
        ),
        usernames: Arr.map(pairs, ({ username }) => username),
      } satisfies Characters);
    }
  );

export const bearerToken = (authorization: string | undefined) =>
  Option.flatMap(
    Option.fromNullishOr(
      /^Bearer\s+(?<token>\S+)\s*$/iu.exec(authorization ?? "")?.groups?.token
    ),
    (token) => Option.getSuccess(decodeToken(token))
  );

export const characterFor = (
  characters: Characters,
  authorization: string | undefined
) =>
  Option.flatMap(bearerToken(authorization), (token) =>
    HashMap.get(characters.byToken, token)
  );

export const reservedBy = (
  characters: Characters,
  name: string,
  self: Username
) =>
  Arr.findFirst(
    characters.usernames,
    (username) => username !== self && sameName(username, name)
  );
