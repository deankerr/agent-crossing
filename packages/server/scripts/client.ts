import { WorldEvent } from "@agent-crossing/world/event";
import * as Arr from "effect/Array";
import * as Clock from "effect/Clock";
import * as Config from "effect/Config";
import type * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as HashMap from "effect/HashMap";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

import { Seq } from "../src/journal.ts";
import { Snapshot } from "../src/sse.ts";
import { parseCharacters } from "../src/tokens.ts";

export const BASE_URL = "http://localhost:3000";

export const tokens = Effect.gen(function* () {
  const configured = yield* Config.Redacted("AGENT_CROSSING_TOKENS");

  const characters = yield* Effect.fromResult(
    parseCharacters(Redacted.value(configured))
  );

  return (username: string) =>
    Option.getOrThrow(
      Option.map(
        Arr.findFirst(
          HashMap.toEntries(characters.byToken),
          ([, owner]) => owner === username
        ),
        ([token]) => token
      )
    );
});

const Reply = Schema.Struct({
  result: Schema.optional(
    Schema.Struct({
      content: Schema.optional(
        Schema.Array(Schema.Struct({ text: Schema.String }))
      ),
      isError: Schema.optional(Schema.Boolean),
    })
  ),
  error: Schema.optional(Schema.Struct({ message: Schema.String })),
});

export interface ToolReply {
  readonly isError: boolean;
  readonly text: string;
}

export const connect = (token: string, protocolVersion = "2025-06-18") =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;

    const post = (body: Schema.Json, session: Option.Option<string>) =>
      client.execute(
        HttpClientRequest.post(`${BASE_URL}/mcp`).pipe(
          HttpClientRequest.bearerToken(token),
          HttpClientRequest.setHeaders({
            accept: "application/json, text/event-stream",
            "mcp-protocol-version": protocolVersion,
            ...Option.match(session, {
              onNone: () => ({}),
              onSome: (id) => ({ "mcp-session-id": id }),
            }),
          }),
          HttpClientRequest.bodyJsonUnsafe(body)
        )
      );

    const initialized = yield* post(
      {
        id: 0,
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          capabilities: {},
          clientInfo: { name: "prove", version: "1" },
          protocolVersion,
        },
      },
      Option.none()
    );

    const session = Option.fromNullishOr(initialized.headers["mcp-session-id"]);

    yield* post(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      session
    );

    const counter = yield* Ref.make(1);

    return {
      call: (name: string, args: Schema.JsonObject = {}) =>
        Effect.gen(function* () {
          const id = yield* Ref.getAndUpdate(counter, (next) => next + 1);

          const response = yield* post(
            {
              id,
              jsonrpc: "2.0",
              method: "tools/call",
              params: { arguments: args, name },
            },
            session
          );

          const reply = yield* Schema.decodeUnknownEffect(Reply)(
            yield* response.json
          );

          const answer: ToolReply =
            reply.error === undefined
              ? {
                  isError: reply.result?.isError ?? false,
                  text: Arr.join(
                    Arr.map(reply.result?.content ?? [], ({ text }) => text),
                    "\n"
                  ),
                }
              : {
                  isError: true,
                  text: `JSON-RPC error: ${reply.error.message}`,
                };

          return answer;
        }),
    };
  });

export interface Received {
  readonly receivedAt: number;
  readonly event: string;
  readonly id: Option.Option<string>;
  readonly data: string;
}

const WorldMessage = Schema.fromJsonString(
  Schema.Struct({ seq: Seq, event: WorldEvent })
);

export const decodeWorldMessage = Schema.decodeUnknownEffect(WorldMessage);

export const decodeSnapshot = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Snapshot)
);

const fieldOf = (lines: readonly string[], name: string) =>
  Arr.findFirst(lines, (line) => Str.startsWith(`${name}: `)(line)).pipe(
    Option.map(Str.slice(name.length + 2))
  );

const parsed = (block: readonly string[], receivedAt: number) =>
  ({
    data: Arr.join(
      Arr.filterMap(block, (line) =>
        Str.startsWith("data: ")(line)
          ? Result.succeed(Str.slice(6)(line))
          : Result.failVoid
      ),
      "\n"
    ),
    event: Arr.some(block, (line) => Str.startsWith(":")(line))
      ? "comment"
      : Option.getOrElse(fieldOf(block, "event"), () => "message"),
    id: fieldOf(block, "id"),
    receivedAt,
  }) satisfies Received;

export const listen = (
  token: Option.Option<string>,
  cursor: Option.Option<number> = Option.none()
) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const received = yield* Ref.make(Arr.empty<Received>());
    const pending = yield* Ref.make(Arr.empty<string>());

    const request = HttpClientRequest.get(`${BASE_URL}/events`).pipe(
      Option.match(token, {
        onNone: () => (same: HttpClientRequest.HttpClientRequest) => same,
        onSome: (bearer) => HttpClientRequest.bearerToken(bearer),
      }),
      Option.match(cursor, {
        onNone: () => (same: HttpClientRequest.HttpClientRequest) => same,
        onSome: (after) => HttpClientRequest.setUrlParam("cursor", `${after}`),
      })
    );

    const fiber = yield* client.execute(request).pipe(
      Effect.flatMap((response) =>
        response.stream.pipe(
          Stream.decodeText,
          Stream.splitLines,
          Stream.runForEach((line) =>
            line === ""
              ? Effect.gen(function* () {
                  const block = yield* Ref.getAndSet(pending, []);
                  const now = yield* Clock.currentTimeMillis;

                  if (block.length > 0) {
                    yield* Ref.update(received, Arr.append(parsed(block, now)));
                  }
                })
              : Ref.update(pending, Arr.append(line))
          )
        )
      ),
      Effect.ignore,
      Effect.forkDetach
    );

    return {
      close: Fiber.interrupt(fiber),
      done: Fiber.await(fiber),
      received: Ref.get(received),
    };
  });

export const worldEvents = (received: readonly Received[]) =>
  Effect.forEach(
    Arr.filter(received, ({ event }) => event === "world"),
    ({ data }) => decodeWorldMessage(data)
  );

export const waitFor = <A, E, R>(
  probe: Effect.Effect<Option.Option<A>, E, R>,
  within: Duration.Input
) =>
  probe.pipe(
    Effect.flatMap(Effect.fromOption),
    Effect.retry({ schedule: Schedule.spaced("100 millis") }),
    Effect.timeoutOption(within)
  );

export const snapshotNow = Effect.gen(function* () {
  const spectator = yield* listen(Option.none());

  const first = yield* waitFor(
    Effect.map(spectator.received, (received) =>
      Arr.findFirst(received, ({ event }) => event === "snapshot")
    ),
    "30 seconds"
  );

  yield* spectator.close;

  return yield* decodeSnapshot(
    Option.getOrThrowWith(first, () => new Error("no snapshot in 30 s")).data
  );
});
