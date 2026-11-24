import { Editor } from "@agent-crossing/world/values";
import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { bearerToken, editorFor, parseEditors } from "../src/tokens.ts";

const CLAUDE_TOKEN = "claude-token-0123456789";
const DEAN_TOKEN = "dean-token-0123456789ab";

const parsed = Result.getOrThrow(
  parseEditors(`claude:${CLAUDE_TOKEN}, dean : ${DEAN_TOKEN}\n`)
);

const failureOf = (text: string) =>
  Result.match(parseEditors(text), {
    onFailure: (malformed) => malformed.message,
    onSuccess: () => "parsed",
  });

describe("admin tokens", () => {
  it("parses comma- or newline-separated name:token pairs", () => {
    expect(Arr.map(parsed.pairs, ({ editor }) => editor)).toStrictEqual([
      Editor.make("claude"),
      Editor.make("dean"),
    ]);
  });

  it("finds the editor for a bearer token and nothing for others", () => {
    expect(editorFor(parsed, `Bearer ${DEAN_TOKEN}`)).toStrictEqual(
      Option.some(Editor.make("dean"))
    );
    expect(editorFor(parsed, `bearer   ${CLAUDE_TOKEN}`)).toStrictEqual(
      Option.some(Editor.make("claude"))
    );
    expect(editorFor(parsed, "Bearer someone-elses-token-000")).toStrictEqual(
      Option.none()
    );
    expect(editorFor(parsed, undefined)).toStrictEqual(Option.none());
    expect(bearerToken(`Basic ${DEAN_TOKEN}`)).toStrictEqual(Option.none());
  });

  it("says what is wrong with a malformed list", () => {
    expect(failureOf("")).toContain("it names nobody");
    expect(failureOf("claude")).toContain('"claude" has no colon');
    expect(failureOf("claude:short")).toContain(
      "the token for claude is not acceptable"
    );
    expect(failureOf(`:${CLAUDE_TOKEN}`)).toContain("not 1-24 characters");
  });

  it("refuses names or tokens used twice", () => {
    expect(failureOf(`claude:${CLAUDE_TOKEN},Claude:${DEAN_TOKEN}`)).toContain(
      "claude shares its name"
    );
    expect(failureOf(`claude:${CLAUDE_TOKEN},dean:${CLAUDE_TOKEN}`)).toContain(
      "shares its name (ignoring case) or its token"
    );
  });
});
