import * as McpProtocol from "effect/ai/McpProtocol";
import * as McpSchema from "effect/ai/McpSchema";
import * as McpServer from "effect/ai/McpServer";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { INSTRUCTIONS } from "./instructions.ts";
import { AdminTools } from "./tools/index.ts";

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

/**
 * The handler for `/mcp`: the admin tools over MCP, open to anyone who can
 * reach it. It refuses any MCP revision but the one it speaks. Yield it from
 * the Worker's construction effect.
 */
export const adminHandler = Effect.map(
  Effect.orDie(
    HttpRouter.toHttpEffect(
      AdminTools.pipe(
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
    )
  ),
  (mcp) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;

      const fromHeader = Option.map(
        decodeVersionHeader(request.headers),
        (headers) => headers["mcp-protocol-version"]
      );

      if (!Option.contains(fromHeader, SPOKEN.protocolVersion)) {
        return yield* unsupportedRevision(request, fromHeader);
      }

      return yield* mcp;
    })
);
