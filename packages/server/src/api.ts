import { PrefabName } from "@agent-crossing/world/definitions/prefabs";
import { Command } from "@agent-crossing/world/engine/editing/command";
import { Region } from "@agent-crossing/world/engine/editing/region";
import { Cell } from "@agent-crossing/world/schema/cell";
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
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import { Area } from "./admin/affected.ts";
import { INSTRUCTIONS } from "./admin/instructions.ts";
import { editorFor, parseEditors, TOKENS_VARIABLE } from "./admin/tokens.ts";
import type { Editors } from "./admin/tokens.ts";
import { Caller, Tools, toolHandlers } from "./admin/tools.ts";
import type { WorldClient } from "./admin/tools.ts";
import { Cluster } from "./cluster.ts";
import { sseComment, sseFrame } from "./feed/sse.ts";
import { FeedItem, Verdict } from "./feed/wire.ts";
import WorldObject, { WORLD_NAME } from "./storage/world-object.ts";

const decodeVerdict = Schema.decodeUnknownEffect(Verdict);
const decodeFeedItem = Schema.decodeUnknownEffect(FeedItem);
const decodeText = Schema.decodeUnknownEffect(Schema.String);

const encodeCommand = Schema.encodeEffect(Command);
const encodeCell = Schema.encodeEffect(Cell);
const encodeArea = Schema.encodeEffect(Schema.NullOr(Area));
const encodeRegion = Schema.encodeEffect(Schema.NullOr(Region));
const encodePrefab = Schema.encodeEffect(Schema.NullOr(PrefabName));

const TEXT_CONTENT = (text: string) => [{ text, type: "text" as const }];

const SSE_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-expose-headers": "*",
  "cache-control": "no-cache",
  "x-accel-buffering": "no",
};

const unauthorized = HttpServerResponse.text(
  "A valid Authorization: Bearer <token> header is required. Tokens are configured in AGENT_CROSSING_ADMIN_TOKENS.",
  { headers: { "www-authenticate": "Bearer" }, status: 401 }
);

const authenticated = (editors: Editors) =>
  McpServer.middleware<{ provides: Caller }>()((effect, { headers }) =>
    Option.match(editorFor(editors, headers.authorization), {
      onNone: () =>
        Effect.fail(
          new McpSchema.InvalidRequest({ message: "Unknown or missing token" })
        ),
      onSome: (editor) => Effect.provideService(effect, Caller, { editor }),
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
    const editors = yield* Config.Redacted(TOKENS_VARIABLE).pipe(
      Effect.flatMap((tokens) =>
        Effect.fromResult(parseEditors(Redacted.value(tokens)))
      ),
      Effect.orDie
    );

    const worlds = yield* WorldObject;
    const world = worlds.getByName(WORLD_NAME);
    const runtime = yield* Effect.context();

    const text = <E, R>(answer: Effect.Effect<unknown, E, R>) =>
      answer.pipe(
        Effect.flatMap(decodeText),
        Effect.provideContext(runtime),
        Effect.orDie
      );

    const client: WorldClient = {
      act: (command, by) =>
        encodeCommand(command).pipe(
          Effect.flatMap((encoded) => world.act(encoded, by)),
          Effect.flatMap(decodeVerdict),
          Effect.provideContext(runtime),
          Effect.orDie
        ),
      agentView: (cell, radius) =>
        text(
          Effect.flatMap(encodeCell(cell), (at) => world.agentView(at, radius))
        ),
      find: (region, prefab, limit) =>
        text(
          Effect.gen(function* () {
            const within = yield* encodeRegion(Option.getOrNull(region));
            const only = yield* encodePrefab(Option.getOrNull(prefab));

            return yield* world.find(within, only, limit);
          })
        ),
      history: (limit) => text(world.history(limit)),
      inspect: (cell) =>
        text(Effect.flatMap(encodeCell(cell), (at) => world.inspect(at))),
      map: (area) =>
        text(
          Effect.flatMap(encodeArea(Option.getOrNull(area)), (shown) =>
            world.map(shown)
          )
        ),
      summary: text(Effect.suspend(() => world.summary())),
    };

    const mcp = yield* HttpRouter.toHttpEffect(
      McpServer.toolkit(Tools, {
        content: {
          change_entity: TEXT_CONTENT,
          erase_floor: TEXT_CONTENT,
          find_entities: TEXT_CONTENT,
          generate_world: TEXT_CONTENT,
          history: TEXT_CONTENT,
          inspect_cell: TEXT_CONTENT,
          list_prefabs: TEXT_CONTENT,
          move_entity: TEXT_CONTENT,
          paint_floor: TEXT_CONTENT,
          pour_liquid: TEXT_CONTENT,
          remove_entities: TEXT_CONTENT,
          scatter: TEXT_CONTENT,
          spawn: TEXT_CONTENT,
          view_as_agent: TEXT_CONTENT,
          view_map: TEXT_CONTENT,
          world_summary: TEXT_CONTENT,
        },
      }).pipe(
        Layer.provide(authenticated(editors).layer),
        Layer.provide(toolHandlers(client)),
        Layer.provide(
          McpServer.layerHttp({
            instructions: INSTRUCTIONS,
            name: "agent-crossing-admin",
            path: "/mcp",
            protocols: [
              McpProtocol.v2026_07_28,
              McpProtocol.v2025_11_25,
              McpProtocol.v2025_06_18,
              McpProtocol.v2025_03_26,
              McpProtocol.v2024_11_05,
            ],
            version: "0.2.0",
          })
        )
      )
    ).pipe(Effect.orDie);

    const spectate = () =>
      HttpServerResponse.stream(
        Stream.encodeText(
          world.feed().pipe(
            Stream.mapEffect((item) => decodeFeedItem(item)),
            Stream.mapEffect((item) =>
              FeedItem.match(item, {
                Frame: ({ frame }) => sseFrame(frame),
                Heartbeat: () => Effect.succeed(sseComment("keep-alive")),
              })
            ),
            Stream.catchCause((cause) =>
              Stream.fromEffect(
                Effect.as(
                  Effect.logWarning("World feed ended", cause),
                  sseComment("stream ended; reconnect for a fresh snapshot")
                )
              )
            ),
            Stream.provideContext(runtime)
          )
        ),
        { contentType: "text/event-stream", headers: SSE_HEADERS }
      );

    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const { pathname } = new URL(request.url, "http://api");

        if (pathname === "/events" && request.method === "OPTIONS") {
          return HttpServerResponse.empty({
            headers: {
              "access-control-allow-headers": "last-event-id",
              "access-control-allow-methods": "GET, OPTIONS",
              "access-control-allow-origin": "*",
            },
            status: 204,
          });
        }

        if (pathname === "/events" && request.method === "GET") {
          return spectate();
        }

        if (pathname === "/mcp") {
          return Option.isSome(
            editorFor(editors, request.headers.authorization)
          )
            ? yield* mcp
            : unauthorized;
        }

        return HttpServerResponse.text("Not found", { status: 404 });
      }),
    };
  })
) {}
