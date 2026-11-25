import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as Arr from "effect/Array";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Record from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

import { parseEditors, TOKENS_VARIABLE } from "../src/admin/tokens.ts";

const USAGE = `Calls the Agent Crossing admin MCP server and prints the tool's text.

Usage:
  bun scripts/admin.ts <tool> ['<json arguments>']   call a tool, for example
      bun scripts/admin.ts view_map '{"x1":0,"y1":0,"x2":20,"y2":10}'
  bun scripts/admin.ts tools                         list the tools and their arguments
  bun scripts/admin.ts schema <tool>                 print a tool's JSON input schema

Settings, from the environment or packages/server/.env:
  AGENT_CROSSING_URL          the server, default http://localhost:3000
  AGENT_CROSSING_ADMIN_TOKEN  the bearer token to use, or else
  ${TOKENS_VARIABLE} with AGENT_CROSSING_EDITOR naming which pair (default the first)

Exit status: 0 done, 1 the tool refused the edit, 2 the call itself failed.`;

class Failed extends Data.TaggedError("Failed")<{ readonly message: string }> {}

const failed = (message: string) => Effect.fail(new Failed({ message }));

const RpcError = Schema.Struct({
  code: Schema.Int,
  message: Schema.String,
  data: Schema.optional(Schema.Unknown),
});

const RpcReply = Schema.Struct({
  result: Schema.optional(Schema.Unknown),
  error: Schema.optional(RpcError),
});

const ToolResult = Schema.Struct({
  content: Schema.Array(
    Schema.Struct({ type: Schema.String, text: Schema.optional(Schema.String) })
  ),
  isError: Schema.optional(Schema.Boolean),
});

const JsonSchemaObject = Schema.Record(Schema.String, Schema.Unknown);

const Property = Schema.Struct({
  type: Schema.optional(Schema.String),
  enum: Schema.optional(Schema.Array(Schema.String)),
});

type Property = typeof Property.Type;

const InputSchema = Schema.Struct({
  properties: Schema.optional(Schema.Record(Schema.String, Property)),
  required: Schema.optional(Schema.Array(Schema.String)),
});

const ToolList = Schema.Struct({
  tools: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      description: Schema.optional(Schema.String),
      inputSchema: JsonSchemaObject,
    })
  ),
});

type ToolInfo = (typeof ToolList.Type)["tools"][number];

const decodeRpcReply = Schema.decodeUnknownEffect(
  Schema.fromJsonString(RpcReply)
);

const decodeToolResult = Schema.decodeUnknownEffect(ToolResult);
const decodeToolList = Schema.decodeUnknownEffect(ToolList);
const decodeInputSchema = Schema.decodeUnknownOption(InputSchema);
const noArguments: typeof InputSchema.Type = {};

const encodeJson = (schema: typeof JsonSchemaObject.Type) =>
  Effect.orDie(
    Schema.encodeEffect(Schema.fromJsonString(JsonSchemaObject))(schema)
  );

const decodeArguments = Schema.decodeUnknownResult(
  Schema.fromJsonString(JsonSchemaObject)
);

const settings = Effect.gen(function* () {
  const url = yield* Config.String("AGENT_CROSSING_URL").pipe(
    Config.withDefault("http://localhost:3000")
  );

  const single = yield* Config.option(
    Config.Redacted("AGENT_CROSSING_ADMIN_TOKEN")
  );

  if (Option.isSome(single)) {
    return { token: Redacted.value(single.value), url };
  }

  const pairs = yield* Config.option(Config.Redacted(TOKENS_VARIABLE));

  if (Option.isNone(pairs)) {
    return yield* failed(
      `No token: set AGENT_CROSSING_ADMIN_TOKEN, or ${TOKENS_VARIABLE} in packages/server/.env.`
    );
  }

  const editors = yield* Result.match(
    parseEditors(Redacted.value(pairs.value)),
    {
      onFailure: ({ message }) => failed(message),
      onSuccess: Effect.succeed,
    }
  );

  const wanted = yield* Config.option(Config.String("AGENT_CROSSING_EDITOR"));

  const pair = Option.match(wanted, {
    onNone: () => Arr.head(editors.pairs),
    onSome: (name) =>
      Arr.findFirst(
        editors.pairs,
        ({ editor }) => Str.toLowerCase(editor) === Str.toLowerCase(name)
      ),
  });

  return yield* Option.match(pair, {
    onNone: () =>
      failed(
        `AGENT_CROSSING_EDITOR names nobody in ${TOKENS_VARIABLE}; it lists ${Arr.join(
          Arr.map(editors.pairs, ({ editor }) => editor),
          ", "
        )}.`
      ),
    onSome: ({ token }) => Effect.succeed({ token, url }),
  });
}).pipe(
  Effect.catchTag("ConfigError", (issue) =>
    failed(`The settings are not readable: ${issue.message}`)
  )
);

const bodyJson = (body: string, contentType: string) =>
  Str.includes("text/event-stream")(contentType)
    ? Option.getOrElse(
        Arr.last(
          Arr.filterMap(Str.split(body, /\r?\n/u), (line) =>
            Str.startsWith("data:")(line)
              ? Result.succeed(Str.trim(Str.slice(5)(line)))
              : Result.failVoid
          )
        ),
        () => body
      )
    : body;

const PROTOCOL_VERSION = "2025-06-18";

const connect = Effect.gen(function* () {
  const { token, url } = yield* settings;
  const client = yield* HttpClient.HttpClient;
  const endpoint = `${Str.endsWith("/")(url) ? Str.slice(0, -1)(url) : url}/mcp`;
  const session = yield* Ref.make(Option.none<string>());
  const counter = yield* Ref.make(1);

  const post = (body: Schema.Json) =>
    Effect.gen(function* () {
      const sessionId = yield* Ref.get(session);

      const response = yield* client
        .execute(
          HttpClientRequest.post(endpoint).pipe(
            HttpClientRequest.bearerToken(token),
            HttpClientRequest.setHeaders({
              accept: "application/json, text/event-stream",
              "mcp-protocol-version": PROTOCOL_VERSION,
              ...Option.match(sessionId, {
                onNone: () => ({}),
                onSome: (id) => ({ "mcp-session-id": id }),
              }),
            }),
            HttpClientRequest.bodyJsonUnsafe(body)
          )
        )
        .pipe(
          Effect.catchTag("HttpClientError", (issue) =>
            failed(
              `Could not reach the admin MCP server at ${endpoint}: ${issue.message}. Is the stack deployed (pnpm exec alchemy deploy in packages/server)?`
            )
          )
        );

      const text = yield* response.text.pipe(
        Effect.catchTag("HttpClientError", (issue) =>
          failed(`The server's reply could not be read: ${issue.message}`)
        )
      );

      if (response.status === 401) {
        return yield* failed(
          `The server refused the token (401). Check it against ${TOKENS_VARIABLE} in the deployed service's .env.`
        );
      }

      if (response.status >= 400) {
        return yield* failed(
          `The server answered ${response.status}: ${Str.trim(text) || "(no body)"}`
        );
      }

      yield* Option.match(
        Option.fromNullishOr(response.headers["mcp-session-id"]),
        {
          onNone: () => Effect.void,
          onSome: (id) => Ref.set(session, Option.some(id)),
        }
      );

      return { contentType: response.headers["content-type"] ?? "", text };
    });

  const request = (method: string, params: Schema.Json) =>
    Effect.gen(function* () {
      const id = yield* Ref.getAndUpdate(counter, (next) => next + 1);
      const reply = yield* post({ id, jsonrpc: "2.0", method, params });

      const decoded = yield* decodeRpcReply(
        bodyJson(reply.text, reply.contentType)
      ).pipe(
        Effect.catchTag("SchemaError", () =>
          failed(
            `The server's reply to ${method} is not JSON-RPC: ${reply.text}`
          )
        )
      );

      if (decoded.error !== undefined) {
        return yield* failed(
          `${method} failed (JSON-RPC ${decoded.error.code}): ${decoded.error.message}`
        );
      }

      return decoded.result;
    });

  yield* request("initialize", {
    capabilities: {},
    clientInfo: { name: "agent-crossing-admin-cli", version: "1" },
    protocolVersion: PROTOCOL_VERSION,
  });
  yield* post({ jsonrpc: "2.0", method: "notifications/initialized" });

  return request;
});

const argumentsOf = (json: string | undefined) =>
  json === undefined || Str.trim(json) === ""
    ? Effect.succeed({})
    : Result.match(decodeArguments(json), {
        onFailure: () =>
          failed(
            `The arguments must be one JSON object, for example '{"x":3,"y":4}'. Got: ${json}`
          ),
        onSuccess: Effect.succeed,
      });

const propertyType = (property: Property) => {
  if (property.enum !== undefined) {
    return Arr.join(
      Arr.map(property.enum, (value) => `"${value}"`),
      " | "
    );
  }

  if (property.type === undefined || property.type === "array") {
    return `${property.type ?? "object"} (see schema)`;
  }

  return property.type;
};

const toolLines = (tool: ToolInfo) => {
  const { properties = {}, required = [] } = Option.getOrElse(
    decodeInputSchema(tool.inputSchema),
    () => noArguments
  );

  const args = Arr.map(
    Record.toEntries(properties),
    ([name, property]) =>
      `${name}${required.includes(name) ? "" : "?"}: ${propertyType(property)}`
  );

  return [
    `${tool.name}(${Arr.join(args, ", ")})`,
    `  ${tool.description ?? ""}`,
  ];
};

const listTools = (request: Effect.Success<typeof connect>) =>
  Effect.gen(function* () {
    const { tools } = yield* decodeToolList(yield* request("tools/list", {}));

    return { tools };
  }).pipe(
    Effect.catchTag("SchemaError", (issue) =>
      failed(`The tool list is not as expected: ${issue.message}`)
    )
  );

const main = Effect.gen(function* () {
  const [command, json, ...rest] = process.argv.slice(2);

  if (command === undefined || command === "help" || command === "--help") {
    yield* Console.log(USAGE);

    return 0;
  }

  if (rest.length > 0) {
    return yield* failed(
      `Expected one JSON argument after the tool name, got ${rest.length + 1}. Quote the JSON, for example '{"x":3,"y":4}'.`
    );
  }

  const request = yield* connect;

  if (command === "tools") {
    const { tools } = yield* listTools(request);
    yield* Console.log(Arr.join(Arr.flatMap(tools, toolLines), "\n"));

    return 0;
  }

  if (command === "schema") {
    const { tools } = yield* listTools(request);
    const tool = Arr.findFirst(tools, ({ name }) => name === json);

    return yield* Option.match(tool, {
      onNone: () =>
        failed(
          `No tool called ${json ?? "(none given)"}; try: bun scripts/admin.ts tools`
        ),
      onSome: (found) =>
        Effect.flatMap(encodeJson(found.inputSchema), (schema) =>
          Effect.as(Console.log(schema), 0)
        ),
    });
  }

  const args = yield* argumentsOf(json);

  const result = yield* decodeToolResult(
    yield* request("tools/call", { arguments: args, name: command })
  ).pipe(
    Effect.catchTag("SchemaError", (issue) =>
      failed(`The tool result is not as expected: ${issue.message}`)
    )
  );

  const text = Arr.join(
    Arr.filterMap(result.content, ({ text: part }) =>
      part === undefined ? Result.failVoid : Result.succeed(part)
    ),
    "\n"
  );

  if (result.isError === true) {
    yield* Console.error(text);

    return 1;
  }

  yield* Console.log(text);

  return 0;
}).pipe(
  Effect.catchTag("Failed", ({ message }) =>
    Effect.as(Console.error(`admin: ${message}`), 2)
  ),
  Effect.flatMap((status) =>
    Effect.sync(() => {
      process.exitCode = status;
    })
  )
);

const dotEnv = ConfigProvider.fromDotEnv({
  path: `${import.meta.dirname}/../.env`,
}).pipe(Effect.orElseSucceed(() => ConfigProvider.fromUnknown({})));

BunRuntime.runMain(
  main.pipe(
    Effect.provide(
      Layer.mergeAll(
        FetchHttpClient.layer,
        ConfigProvider.layerAdd(dotEnv).pipe(Layer.provide(BunFileSystem.layer))
      )
    )
  )
);
