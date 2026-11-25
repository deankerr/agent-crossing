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

import type { WorldClient } from "../world-object/client.ts";
import { INSTRUCTIONS } from "./instructions.ts";
import { editorFor, parseEditors, TOKENS_VARIABLE } from "./tokens.ts";
import type { Editors } from "./tokens.ts";
import { Caller, Tools, toolHandlers } from "./tools.ts";

const TEXT_CONTENT = (text: string) => [{ text, type: "text" as const }];

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

/**
 * The handler for `/mcp`: the admin tools over MCP, for callers whose bearer
 * token names an editor. It reads the tokens from configuration, so yield it
 * from the Worker's construction effect.
 */
export const adminHandler = (client: WorldClient) =>
  Effect.gen(function* () {
    const editors = yield* Config.Redacted(TOKENS_VARIABLE).pipe(
      Effect.flatMap((tokens) =>
        Effect.fromResult(parseEditors(Redacted.value(tokens)))
      )
    );

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
    );

    return { editors, mcp };
  }).pipe(
    Effect.orDie,
    Effect.map(({ editors, mcp }) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;

        return Option.isSome(editorFor(editors, request.headers.authorization))
          ? yield* mcp
          : unauthorized;
      })
    )
  );
