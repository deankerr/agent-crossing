import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { changeEntity } from "./change-entity.ts";
import { eraseFloor } from "./erase-floor.ts";
import { findEntities } from "./find-entities.ts";
import { generateWorld } from "./generate-world.ts";
import { history } from "./history.ts";
import { inspectCell } from "./inspect-cell.ts";
import { listPrefabs } from "./list-prefabs.ts";
import { moveEntity } from "./move-entity.ts";
import { paintFloor } from "./paint-floor.ts";
import { pourLiquid } from "./pour-liquid.ts";
import { removeEntities } from "./remove-entities.ts";
import { scatter } from "./scatter.ts";
import { spawn } from "./spawn.ts";
import { viewAsAgent } from "./view-as-agent.ts";
import { viewMap } from "./view-map.ts";
import { worldSummary } from "./world-summary.ts";

/**
 * Every admin tool, registered one after another so that they are listed in
 * this order: the queries, then the edits.
 */
export const AdminTools = Layer.effectDiscard(
  Effect.all(
    [
      worldSummary,
      viewMap,
      viewAsAgent,
      inspectCell,
      findEntities,
      listPrefabs,
      history,
      paintFloor,
      pourLiquid,
      eraseFloor,
      spawn,
      scatter,
      moveEntity,
      changeEntity,
      removeEntities,
      generateWorld,
    ],
    { discard: true }
  )
);
