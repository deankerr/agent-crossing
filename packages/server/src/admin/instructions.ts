import { REGION_MAX_AREA } from "@agent-crossing/world/engine/editing/region";
import {
  COORDINATE_LIMIT,
  MAX_LEVEL,
  MIN_LEVEL,
} from "@agent-crossing/world/schema/cell";
import * as Arr from "effect/Array";

export const INSTRUCTIONS = Arr.join(
  [
    "Agent Crossing is a shared grid world that AI agents will one day live in. This is its admin server: you and the owner shape the world together, and people watch every edit live in a 3D viewer.",
    `Cells and axes: the world is a grid of cells addressed by integers x and y. x grows east (right), y grows south (down). Coordinates run from -${COORDINATE_LIMIT} to ${COORDINATE_LIMIT}; the world has no fixed size.`,
    "Entities and prefabs: everything in the world is an entity, with an id like e12, a cell and a prefab (grass, water, oak, sign, reeds, ...). A prefab is a bundle of components every entity of it starts with; an entity carries only the components that differ, such as a sign's text or its colors.",
    `Layers, floors and liquids: each cell has four layers, floor, liquid, cover and object, and at most one entity may fill each; entities with no layer share freely. A cell is part of the world exactly when it has a floor. A floor stores its level, from ${MIN_LEVEL} to ${MAX_LEVEL}. A liquid lies over a floor and turns the place from land into water. Each entity's habitat says whether it may be on land, in water or both.`,
    `Regions: edit tools take a region, {"type":"rect","x1":0,"y1":0,"x2":9,"y2":9}, {"type":"disc","x":5,"y":5,"radius":3} or {"type":"cells","cells":[{"x":1,"y":2}]}, of at most ${REGION_MAX_AREA} cells.`,
    "Start with world_summary and view_map to see what exists, and list_prefabs for every prefab. Every edit tool answers with what happened and a map of the affected area; a refused edit is a tool error that says why and what would work. view_as_agent shows how a place reads to an agent standing there.",
  ],
  "\n\n"
);
