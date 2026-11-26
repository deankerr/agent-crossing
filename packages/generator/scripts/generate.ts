import * as Cell from "@agent-crossing/world/Cell";
import * as Command from "@agent-crossing/world/Command";
import * as Entity from "@agent-crossing/world/Entity";
import * as Region from "@agent-crossing/world/Region";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as McpClient from "effect/ai/McpClient";
import * as McpProtocol from "effect/ai/McpProtocol";
import type * as McpSchema from "effect/ai/McpSchema";
import * as Arr from "effect/Array";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

import * as Landscape from "../src/Landscape.ts";

const USAGE = `Generates a landscape and lays it on the world over MCP.

Usage:
  pnpm --filter @agent-crossing/generator generate <seed> <width> <height> [<x> <y>]

  seed           an integer; the same seed gives the same landscape
  width, height  cells a side, ${Landscape.MIN_SIZE} to ${Landscape.MAX_SIZE}
  x, y           the north-west corner, 0 0 if left out

It clears the rectangle, terrain included, then places the landscape in
batches of at most ${Command.PLACE_MAX_ENTITIES} entities.

Settings, from the environment or the .env at the root of the repository:
  AGENT_CROSSING_URL  the Api, the api address alchemy deploy prints

Exit status: 0 done, 1 a call was refused, 2 the arguments or a call failed.`;

class Failed extends Data.TaggedError("Failed")<{ readonly message: string }> {}

const failed = (message: string) => Effect.fail(new Failed({ message }));

const Integer = Schema.FiniteFromString.pipe(Schema.decodeTo(Schema.Int));

const Side = Schema.FiniteFromString.pipe(
  Schema.decodeTo(
    Schema.Int.check(
      Schema.isBetween({
        maximum: Landscape.MAX_SIZE,
        minimum: Landscape.MIN_SIZE,
      })
    )
  )
);

const Coordinate = Schema.FiniteFromString.pipe(
  Schema.decodeTo(Cell.Coordinate)
);

const ZERO = Cell.Coordinate.make(0);

const Arguments = Schema.Union([
  Schema.Tuple([Integer, Side, Side]),
  Schema.Tuple([Integer, Side, Side, Coordinate, Coordinate]),
]).check(
  Schema.makeFilter(
    ([, width, height, x = ZERO, y = ZERO]) =>
      (x + width - 1 <= Cell.LIMIT && y + height - 1 <= Cell.LIMIT) ||
      "the landscape must fit inside the coordinate range"
  )
);

const specOf = (argv: readonly string[]) =>
  Result.map(
    Schema.decodeUnknownResult(Arguments)(argv),
    ([seed, width, height, x = ZERO, y = ZERO]) =>
      ({
        height,
        origin: { x, y },
        seed,
        width,
      }) satisfies Landscape.Spec
  );

const layerRank = (entity: Landscape.NewEntity) => {
  const { layer } = Entity.components(entity);

  if (layer === "floor") {
    return 0;
  }

  return layer === "liquid" ? 1 : 2;
};

const commandsFor = (spec: Landscape.Spec) => {
  const ordered = Arr.sortWith(
    Landscape.entities(spec),
    layerRank,
    Order.Number
  );

  return [
    Command.ClearRegion.make({
      region: Region.sized(spec.origin, spec.width, spec.height),
      removing: Command.Clearing.cases.Terrain.make({}),
    }),
    ...Arr.filterMap(
      Arr.chunksOf(ordered, Command.PLACE_MAX_ENTITIES),
      (batch) =>
        Arr.isReadonlyArrayNonEmpty(batch)
          ? Result.succeed(Command.PlaceEntities.make({ entities: batch }))
          : Result.failVoid
    ),
  ];
};

const encodeCommand = Schema.encodeEffect(Command.Command);

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

const call = (
  tools: readonly McpSchema.Tool[],
  command: typeof Command.Command.Type
) =>
  Effect.gen(function* () {
    const client = yield* McpClient.McpClient;
    const { _tag, ...args } = yield* Effect.orDie(encodeCommand(command));
    const name = Str.pascalToSnake(_tag);

    const tool = yield* Option.match(
      Arr.findFirst(tools, (one) => one.name === name),
      {
        onNone: () => failed(`The server has no tool called ${name}.`),
        onSome: Effect.succeed,
      }
    );

    const result = yield* client.callTool({ arguments: args, tool });

    const text = Arr.join(
      Arr.filterMap(result.content, (part) =>
        part.type === "text" ? Result.succeed(part.text) : Result.failVoid
      ),
      "\n"
    );

    return { name, refused: result.isError === true, text };
  });

const summaryOf = (command: typeof Command.Command.Type) =>
  command._tag === "PlaceEntities"
    ? `${command.entities.length} entities`
    : "the rectangle, terrain included";

const lay = (spec: Landscape.Spec) =>
  Effect.gen(function* () {
    const commands = commandsFor(spec);

    const tools = yield* Effect.flatMap(McpClient.McpClient, (client) =>
      client.listTools()
    );

    for (const [index, command] of commands.entries()) {
      const { name, refused, text } = yield* call(tools, command);
      const step = `${index + 1}/${commands.length}`;

      if (refused) {
        yield* Console.error(`${step} ${name} refused: ${text}`);

        return 1;
      }

      yield* Console.log(`${step} ${name} ${summaryOf(command)}: done`);
    }

    yield* Console.log(
      `Laid seed ${spec.seed}, ${spec.width} by ${spec.height} from ${Cell.format(spec.origin)}.`
    );

    return 0;
  });

const main = Effect.gen(function* () {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === "help" || argv[0] === "--help") {
    yield* Console.log(USAGE);

    return 0;
  }

  const spec = specOf(argv);

  if (Result.isFailure(spec)) {
    yield* Console.error(`generate: ${spec.failure.message}\n\n${USAGE}`);

    return 2;
  }

  const url = yield* endpoint;

  return yield* lay(spec.success).pipe(
    Effect.provide(
      McpClient.layerHttp({
        name: "agent-crossing-generator",
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
    Effect.as(Console.error(`generate: ${message}`), 2)
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
