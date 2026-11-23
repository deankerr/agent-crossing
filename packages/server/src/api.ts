import { Command } from "@agent-crossing/world/command";
import type { Username } from "@agent-crossing/world/values";
import * as Docker from "@alchemy.run/docker";
import * as Rivet from "@alchemy.run/rivet";
import * as McpProtocol from "effect/ai/McpProtocol";
import * as McpSchema from "effect/ai/McpSchema";
import * as McpServer from "effect/ai/McpServer";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import { Cluster } from "./cluster.ts";
import { INSTRUCTIONS } from "./instructions.ts";
import { Audience, characterAudience, spectator } from "./journal.ts";
import type { Seq } from "./journal.ts";
import { quoted } from "./narration.ts";
import {
  comment,
  cursorFrom,
  Snapshot,
  snapshotFrame,
  worldFrame,
} from "./sse.ts";
import { characterFor, parseCharacters } from "./tokens.ts";
import type { Characters } from "./tokens.ts";
import { Caller, toolHandlers, Tools } from "./tools.ts";
import type { WorldClient } from "./tools.ts";
import { CatchUp, Report, StreamItem } from "./wire.ts";
import WorldObject, { WORLD_NAME } from "./world-object.ts";

const decodeReport = Schema.decodeUnknownEffect(Report);
const decodeCatchUp = Schema.decodeUnknownEffect(CatchUp);
const decodeSnapshot = Schema.decodeUnknownEffect(Snapshot);
const decodeStreamItem = Schema.decodeUnknownEffect(StreamItem);

const encodeCommand = (command: Command) =>
  Effect.orDie(Schema.encodeEffect(Command)(command));

const encodeAudience = (audience: Audience) =>
  Effect.orDie(Schema.encodeEffect(Audience)(audience));

const TEXT_CONTENT = (text: string) => [{ text, type: "text" as const }];

const SSE_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-expose-headers": "*",
  "cache-control": "no-cache",
  "x-accel-buffering": "no",
};

const unauthorized = HttpServerResponse.text(
  "A valid Authorization: Bearer <token> header is required.",
  { headers: { "www-authenticate": "Bearer" }, status: 401 }
);

const sse = (body: Stream.Stream<string>) =>
  HttpServerResponse.stream(Stream.encodeText(body), {
    contentType: "text/event-stream",
    headers: SSE_HEADERS,
  });

const authenticated = (characters: Characters) =>
  McpServer.middleware<{ provides: Caller }>()((effect, { headers }) =>
    Option.match(characterFor(characters, headers.authorization), {
      onNone: () =>
        Effect.fail(
          new McpSchema.InvalidRequest({ message: "Unknown or missing token" })
        ),
      onSome: (username) => Effect.provideService(effect, Caller, { username }),
    })
  );

export default class Api extends Docker.Service<Api>()(
  "Api",
  Effect.gen(function* () {
    const cluster = yield* Rivet.Cluster;

    return {
      main: import.meta.url,
      port: 3000,
      ports: [{ external: 3000, internal: 3000 }],
      networks:
        cluster.network?.kind === "docker"
          ? [{ name: cluster.network.name }]
          : [],
    };
  }).pipe(Effect.provide(Cluster)),
  Effect.gen(function* () {
    const characters = yield* Config.Redacted("AGENT_CROSSING_TOKENS").pipe(
      Effect.flatMap((tokens) =>
        Effect.fromResult(parseCharacters(Redacted.value(tokens)))
      ),
      Effect.orDie
    );

    const worlds = yield* WorldObject;
    const world = worlds.getByName(WORLD_NAME);
    const runtime = yield* Effect.context();

    const client: WorldClient = {
      act: (command) =>
        encodeCommand(command).pipe(
          Effect.flatMap((encoded) => world.act(encoded)),
          Effect.flatMap(decodeReport),
          Effect.provideContext(runtime),
          Effect.orDie
        ),
      catchUp: (username) =>
        world
          .catchUp(username)
          .pipe(
            Effect.flatMap(decodeCatchUp),
            Effect.provideContext(runtime),
            Effect.orDie
          ),
    };

    const mcp = yield* HttpRouter.toHttpEffect(
      McpServer.toolkit(Tools, {
        content: {
          create: TEXT_CONTENT,
          destroy: TEXT_CONTENT,
          look: TEXT_CONTENT,
          move_to: TEXT_CONTENT,
          pick_up: TEXT_CONTENT,
          put_down: TEXT_CONTENT,
          say: TEXT_CONTENT,
          set_name: TEXT_CONTENT,
        },
      }).pipe(
        Layer.provide(authenticated(characters).layer),
        Layer.provide(toolHandlers(client, characters)),
        Layer.provide(
          McpServer.layerHttp({
            instructions: INSTRUCTIONS,
            name: "agent-crossing",
            path: "/mcp",
            protocols: [
              McpProtocol.v2026_07_28,
              McpProtocol.v2025_11_25,
              McpProtocol.v2025_06_18,
              McpProtocol.v2025_03_26,
              McpProtocol.v2024_11_05,
            ],
            version: "0.1.0",
          })
        )
      )
    ).pipe(Effect.orDie);

    const frames = (audience: Audience, cursor: Option.Option<Seq>) =>
      Stream.unwrap(
        Effect.map(encodeAudience(audience), (encoded) =>
          world.events(encoded, Option.getOrNull(cursor))
        )
      ).pipe(
        Stream.mapEffect((item) => decodeStreamItem(item)),
        Stream.mapEffect((item) =>
          StreamItem.match(item, {
            Happened: worldFrame,
            Heartbeat: () => Effect.succeed(comment("keep-alive")),
          })
        ),
        Stream.catchCause((cause) =>
          Stream.fromEffect(
            Effect.as(
              Effect.logWarning("World event stream ended", cause),
              comment("stream ended; reconnect with your cursor")
            )
          )
        )
      );

    const spectate = Effect.gen(function* () {
      const snapshot = yield* world
        .snapshot()
        .pipe(Effect.flatMap(decodeSnapshot), Effect.orDie);

      return sse(
        Stream.concat(
          Stream.fromEffect(Effect.orDie(snapshotFrame(snapshot))),
          frames(spectator, Option.some(snapshot.cursor))
        ).pipe(Stream.provideContext(runtime))
      );
    });

    const listen = (
      username: Username,
      request: HttpServerRequest.HttpServerRequest
    ) =>
      Result.match(
        cursorFrom(
          new URL(request.url, "http://api").searchParams.get("cursor") ??
            undefined,
          request.headers["last-event-id"]
        ),
        {
          onFailure: (given) =>
            HttpServerResponse.text(
              `The cursor ${quoted(given)} is not a sequence number.`,
              { status: 400 }
            ),
          onSuccess: (cursor) =>
            sse(
              frames(characterAudience(username), cursor).pipe(
                Stream.provideContext(runtime)
              )
            ),
        }
      );

    const events = (request: HttpServerRequest.HttpServerRequest) => {
      const { authorization } = request.headers;

      if (authorization === undefined) {
        return spectate;
      }

      return Effect.succeed(
        Option.match(characterFor(characters, authorization), {
          onNone: () => unauthorized,
          onSome: (username) => listen(username, request),
        })
      );
    };

    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const { pathname } = new URL(request.url, "http://api");

        if (pathname === "/events" && request.method === "OPTIONS") {
          return HttpServerResponse.empty({
            headers: {
              "access-control-allow-headers": "authorization, last-event-id",
              "access-control-allow-methods": "GET, OPTIONS",
              "access-control-allow-origin": "*",
            },
            status: 204,
          });
        }

        if (pathname === "/events" && request.method === "GET") {
          return yield* events(request);
        }

        if (pathname === "/mcp") {
          return Option.isSome(
            characterFor(characters, request.headers.authorization)
          )
            ? yield* mcp
            : unauthorized;
        }

        return HttpServerResponse.text("Not found", { status: 404 });
      }),
    };
  })
) {}
