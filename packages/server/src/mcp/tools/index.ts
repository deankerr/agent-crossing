import * as McpServer from "effect/ai/McpServer";
import * as Toolkit from "effect/ai/Toolkit";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Record from "effect/Record";

import { textContent } from "../tool.ts";
import { ChangeEntity, changeEntity } from "./change-entity.ts";
import { EraseFloor, eraseFloor } from "./erase-floor.ts";
import { FindEntities, findEntities } from "./find-entities.ts";
import { GenerateWorld, generateWorld } from "./generate-world.ts";
import { History, history } from "./history.ts";
import { InspectCell, inspectCell } from "./inspect-cell.ts";
import { ListPrefabs, listPrefabs } from "./list-prefabs.ts";
import { MoveEntity, moveEntity } from "./move-entity.ts";
import { PaintFloor, paintFloor } from "./paint-floor.ts";
import { PourLiquid, pourLiquid } from "./pour-liquid.ts";
import { RemoveEntities, removeEntities } from "./remove-entities.ts";
import { Scatter, scatter } from "./scatter.ts";
import { Spawn, spawn } from "./spawn.ts";
import { ViewMap, viewMap } from "./view-map.ts";
import { WorldSummary, worldSummary } from "./world-summary.ts";

const toolkit = Toolkit.make(
  WorldSummary,
  ViewMap,
  InspectCell,
  FindEntities,
  ListPrefabs,
  History,
  PaintFloor,
  PourLiquid,
  EraseFloor,
  Spawn,
  Scatter,
  MoveEntity,
  ChangeEntity,
  RemoveEntities,
  GenerateWorld
);

const handlers = Effect.all({
  world_summary: worldSummary,
  view_map: viewMap,
  inspect_cell: inspectCell,
  find_entities: findEntities,
  list_prefabs: listPrefabs,
  history,
  paint_floor: paintFloor,
  pour_liquid: pourLiquid,
  erase_floor: eraseFloor,
  spawn,
  scatter,
  move_entity: moveEntity,
  change_entity: changeEntity,
  remove_entities: removeEntities,
  generate_world: generateWorld,
});

/**
 * Every MCP tool as one toolkit, each answering in text, listed in this
 * order: the queries, then the edits.
 */
export const McpTools = Layer.effectDiscard(
  McpServer.registerToolkit(toolkit, {
    content: Record.map(toolkit.tools, () => textContent),
  }).pipe(Effect.provide(toolkit.toLayer(handlers)))
);
