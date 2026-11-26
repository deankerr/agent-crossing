import * as McpServer from "effect/ai/McpServer";
import * as Toolkit from "effect/ai/Toolkit";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Record from "effect/Record";

import { textContent } from "../tool.ts";
import { CommandTools } from "./commands.ts";
import { FindEntities, findEntities } from "./find-entities.ts";
import { History, history } from "./history.ts";
import { InspectCell, inspectCell } from "./inspect-cell.ts";
import { ListPrefabs, listPrefabs } from "./list-prefabs.ts";
import { ViewMap, viewMap } from "./view-map.ts";
import { WorldSummary, worldSummary } from "./world-summary.ts";

const queries = Toolkit.make(
  WorldSummary,
  ViewMap,
  InspectCell,
  FindEntities,
  ListPrefabs,
  History
);

const queryHandlers = Effect.all({
  world_summary: worldSummary,
  view_map: viewMap,
  inspect_cell: inspectCell,
  find_entities: findEntities,
  list_prefabs: listPrefabs,
  history,
});

/**
 * Every MCP tool, each answering in text, listed in this order: the queries,
 * then one tool for each command.
 */
export const McpTools = Layer.effectDiscard(
  Effect.andThen(
    McpServer.registerToolkit(queries, {
      content: Record.map(queries.tools, () => textContent),
    }).pipe(Effect.provide(queries.toLayer(queryHandlers))),
    McpServer.registerToolkit(CommandTools.toolkit, {
      content: Record.map(CommandTools.toolkit.tools, () => textContent),
    }).pipe(Effect.provide(CommandTools.toolkit.toLayer(CommandTools.handlers)))
  )
);
