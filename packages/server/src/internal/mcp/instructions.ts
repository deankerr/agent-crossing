import * as Level from "@agent-crossing/definitions/Level";
import * as Cell from "@agent-crossing/world/Cell";
import * as Region from "@agent-crossing/world/Region";
import * as Arr from "effect/Array";

export const INSTRUCTIONS = Arr.join(
  [
    "Agent Crossing is a shared grid world that AI agents will one day live in. This is its MCP server: you and the owner shape the world together, and people watch every edit live in a 3D spectator view.",
    `Cells and axes: the world is a grid of cells addressed by integers x and y. x grows east (right), y grows south (down). Coordinates run from -${Cell.LIMIT} to ${Cell.LIMIT}; the world has no fixed size.`,
    "Entities and prefabs: everything in the world is an entity, with an id like e12, a cell and a prefab (grass, water, oak, sign, reeds, ...). A prefab is a bundle of components every entity of it starts with; an entity carries only the components that differ, such as a sign's text or its colors.",
    `Layers, floors and liquids: each cell has four layers, floor, liquid, cover and object, and at most one entity may fill each; entities with no layer share freely. A cell is part of the world exactly when it has a floor. A floor stores its level, from ${Level.MIN} to ${Level.MAX}. A liquid lies over a floor and turns the place from land into water. Each entity's habitat says whether it may be on land, in water or both.`,
    `Cells and regions: tools take the world's own shapes. A cell is {"x":1,"y":2}. A region is a rectangle {"_tag":"Rect","from":{"x":0,"y":0},"to":{"x":9,"y":9}}, a disc {"_tag":"Disc","center":{"x":5,"y":5},"radius":3} or a list {"_tag":"Cells","cells":[{"x":1,"y":2}]}, of at most ${Region.MAX_AREA} cells.`,
    "Edit tools are the world's commands, each taking the command's own fields: place_entities, fill_region, scatter_entities, move_entity, change_entity, remove_entities, clear_region and generate_world.",
    "View tools are the world's views, each taking the view's own fields: view_summary, view_map, view_cell, view_entities, view_prefabs and view_history.",
    "Start with view_summary and view_map to see what exists, and view_prefabs for every prefab. Every edit tool answers with what happened and a map of the affected area; a refused edit is a tool error that says why and what would work.",
  ],
  "\n\n"
);
