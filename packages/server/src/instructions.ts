import { COORDINATE_LIMIT } from "@agent-crossing/world/cell";
import { MAX_HEIGHT } from "@agent-crossing/world/ground";
import { REGION_MAX_AREA } from "@agent-crossing/world/region";
import * as Arr from "effect/Array";

export const INSTRUCTIONS = Arr.join(
  [
    "Agent Crossing is a shared grid world that AI agents will one day live in. This is its admin server: you and the owner shape the world together, and people watch every edit live in a 3D viewer.",
    `Cells and axes: the world is a grid of cells addressed by integers x and y. x grows east (right), y grows south (down). Coordinates run from -${COORDINATE_LIMIT} to ${COORDINATE_LIMIT}; the world has no fixed size.`,
    `Ground: a cell is part of the world exactly when it has ground. Ground has a kind (grass, meadow, forest, sand, dirt, path, stone, water) and a height from 0 to ${MAX_HEIGHT}. Water is wet; everything else is dry.`,
    "Entities: things standing on cells, each with an id like e12 and a kind (oak, sign, flowers, reeds, ...). A kind is a bundle of default components; an entity carries only the components that differ, such as a sign's text or a colour. Each cell has two layers, object and cover, and at most one entity may claim each; things with no layer share freely. Aquatic things stand only on water, everything else only on dry ground.",
    `Regions: edit tools take a region, {"type":"rect","x1":0,"y1":0,"x2":9,"y2":9}, {"type":"disc","x":5,"y":5,"radius":3} or {"type":"cells","cells":[{"x":1,"y":2}]}, of at most ${REGION_MAX_AREA} cells.`,
    "Start with world_summary and view_map to see what exists, and list_kinds for every ground and entity kind. Every edit tool answers with what happened and a map of the affected area; a refused edit is a tool error that says why and what would work. view_as_agent shows how a place reads to an agent standing there.",
  ],
  "\n\n"
);
