import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as McpClient from "effect/ai/McpClient";
import * as McpProtocol from "effect/ai/McpProtocol";
import * as Arr from "effect/Array";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

const USAGE = `Calls the Agent Crossing MCP server and prints the tool's text.

Usage:
  bun scripts/mcp.ts <tool> ['<json arguments>']   call a tool, for example
      bun scripts/mcp.ts view_map '{"x1":0,"y1":0,"x2":20,"y2":10}'
  bun scripts/mcp.ts tools                         list the tools
  bun scripts/mcp.ts schema <tool>                 print a tool's JSON input schema

Settings, from the environment or the .env at the root of the repository:
  AGENT_CROSSING_URL  the Api, the api address alchemy deploy prints

Exit status: 0 done, 1 the tool reported an error, 2 the call itself failed.`;

class Failed extends Data.TaggedError("Failed")<{ readonly message: string }> {}

const failed = (message: string) => Effect.fail(new Failed({ message }));

const JsonObject = Schema.Record(Schema.String, Schema.Unknown);

const decodeArguments = Schema.decodeUnknownResult(
  Schema.fromJsonString(JsonObject)
);

const encodeJson = Schema.encodeEffect(Schema.fromJsonString(JsonObject));

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

const endpoint = Effect.gen(function* () {
  const url = yield* Config.option(Config.String("AGENT_CROSSING_URL"));

  if (Option.isNone(url)) {
    return yield* failed(
      "No Api: set AGENT_CROSSING_URL to the Api's address (http://localhost:1337 under alchemy dev, or the api address a deploy prints), in the environment or in the .env at the root of the repository."
    );
  }

  return `${Str.endsWith("/")(url.value) ? Str.slice(0, -1)(url.value) : url.value}/mcp`;
}).pipe(
  Effect.catchTag("ConfigError", (issue) =>
    failed(`The settings are not readable: ${issue.message}`)
  )
);

const toolNamed = (name: string | undefined) =>
  Effect.flatMap(McpClient.McpClient, (client) =>
    Effect.flatMap(client.listTools(), (tools) =>
      Option.match(
        Arr.findFirst(tools, (tool) => tool.name === name),
        {
          onNone: () =>
            failed(
              `No tool called ${name ?? "(none given)"}; try: bun scripts/mcp.ts tools`
            ),
          onSome: Effect.succeed,
        }
      )
    )
  );

const run = (command: string, json: string | undefined) =>
  Effect.gen(function* () {
    const client = yield* McpClient.McpClient;

    if (command === "tools") {
      const tools = yield* client.listTools();
      yield* Console.log(
        Arr.join(
          Arr.map(tools, (tool) => `${tool.name}\n  ${tool.description ?? ""}`),
          "\n"
        )
      );

      return 0;
    }

    if (command === "schema") {
      const tool = yield* toolNamed(json);
      yield* Console.log(yield* Effect.orDie(encodeJson(tool.inputSchema)));

      return 0;
    }

    const args = yield* argumentsOf(json);
    const tool = yield* toolNamed(command);
    const result = yield* client.callTool({ arguments: args, tool });

    const text = Arr.join(
      Arr.filterMap(result.content, (part) =>
        part.type === "text" ? Result.succeed(part.text) : Result.failVoid
      ),
      "\n"
    );

    if (result.isError === true) {
      yield* Console.error(text);

      return 1;
    }

    yield* Console.log(text);

    return 0;
  });

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

  const url = yield* endpoint;

  return yield* run(command, json).pipe(
    Effect.provide(
      McpClient.layerHttp({
        name: "agent-crossing-cli",
        protocol: McpProtocol.v2026_07_28,
        url,
        version: "0.1.0",
      })
    ),
    Effect.catchTag("McpClientError", (issue) =>
      failed(
        `The call to the MCP server at ${url} failed: ${issue.message}. Is the Api running?`
      )
    )
  );
}).pipe(
  Effect.catchTag("Failed", ({ message }) =>
    Effect.as(Console.error(`mcp: ${message}`), 2)
  ),
  Effect.flatMap((status) =>
    Effect.sync(() => {
      process.exitCode = status;
    })
  )
);

const dotEnv = ConfigProvider.fromDotEnv({
  path: `${import.meta.dirname}/../../../.env`,
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
