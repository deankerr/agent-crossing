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

import { INSTRUCTIONS } from "./instructions.ts";
import { editorFor, parseEditors, TOKENS_VARIABLE } from "./tokens.ts";
import type { Editors } from "./tokens.ts";
import { Caller } from "./tool.ts";
import { AdminTools } from "./tools/index.ts";

const unauthorized = HttpServerResponse.text(
  "A valid Authorization: Bearer <token> header is required. Tokens are configured in AGENT_CROSSING_ADMIN_TOKENS.",
  { headers: { "www-authenticate": "Bearer" }, status: 401 }
);

const SPOKEN = McpProtocol.v2026_07_28;

const decodeVersionHeader = Schema.decodeUnknownOption(
  Schema.Struct({ "mcp-protocol-version": Schema.String })
);

const decodeRpcRequest = Schema.decodeUnknownOption(
  Schema.fromJsonString(
    Schema.Struct({
      id: Schema.optionalKey(Schema.Union([Schema.String, Schema.Finite])),
      params: Schema.optionalKey(
        Schema.Struct({ protocolVersion: Schema.optionalKey(Schema.String) })
      ),
    })
  )
);

const refusalMessage = (requested: Option.Option<string>) =>
  Option.match(requested, {
    onNone: () =>
      `This server speaks only MCP revision ${SPOKEN.protocolVersion}, but the request named no revision.`,
    onSome: (version) =>
      `This server speaks only MCP revision ${SPOKEN.protocolVersion}, but the request asked for revision ${version}.`,
  });

const unsupportedRevision = (
  request: HttpServerRequest.HttpServerRequest,
  fromHeader: Option.Option<string>
) =>
  Effect.map(Effect.option(request.text), (body) => {
    const parsedBody = Option.flatMap(body, decodeRpcRequest);

    const requested = Option.orElse(fromHeader, () =>
      Option.flatMap(parsedBody, ({ params }) =>
        Option.fromUndefinedOr(params?.protocolVersion)
      )
    );

    return HttpServerResponse.jsonUnsafe(
      {
        error: {
          code: McpSchema.UNSUPPORTED_PROTOCOL_VERSION_ERROR_CODE,
          data: {
            requested: Option.getOrNull(requested),
            supported: [SPOKEN.protocolVersion],
          },
          message: refusalMessage(requested),
        },
        id: Option.getOrNull(
          Option.flatMap(parsedBody, ({ id }) => Option.fromUndefinedOr(id))
        ),
        jsonrpc: "2.0",
      },
      { status: 400 }
    );
  });

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
export const adminHandler = Effect.gen(function* () {
  const editors = yield* Config.Redacted(TOKENS_VARIABLE).pipe(
    Effect.flatMap((tokens) =>
      Effect.fromResult(parseEditors(Redacted.value(tokens)))
    )
  );

  const mcp = yield* HttpRouter.toHttpEffect(
    AdminTools.pipe(
      Layer.provide(authenticated(editors).layer),
      Layer.provide(
        McpServer.layerHttpRequestScoped({
          instructions: INSTRUCTIONS,
          name: "agent-crossing-admin",
          path: "/mcp",
          protocols: [SPOKEN],
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

      const fromHeader = Option.map(
        decodeVersionHeader(request.headers),
        (headers) => headers["mcp-protocol-version"]
      );

      if (!Option.contains(fromHeader, SPOKEN.protocolVersion)) {
        return yield* unsupportedRevision(request, fromHeader);
      }

      return Option.isSome(editorFor(editors, request.headers.authorization))
        ? yield* mcp
        : unauthorized;
    })
  )
);
