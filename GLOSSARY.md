# Agent Crossing world

The words for what the world is made of, how it changes and how it is shown. They do not yet cover how agents act.

## Language

### The world

**World**: Everything that exists: every entity, wherever it is. There is one. _Avoid_: Instance, simulation, map

### Where things are

**Cell**: One square of the grid, named by its coordinates. Cells are never created or destroyed; the world is wherever entities are, and its edge is only where floors stop. _Avoid_: Tile, square, coordinate

**Level**: The vertical step of a position. It is a fact of a floor, a liquid or anything resting on nothing, and a consequence for everything standing on a floor. _Avoid_: Height, elevation, altitude

**Layer**: A slot of a cell that at most one entity may fill: floor, liquid, cover or object. An entity that claims no layer shares its cell freely. _Avoid_: Slot, tier

**Floor**: The bottom layer. Other entities stand on the entity that fills it and take their level from it. Grass is a floor; so is the bed of a pond, or a bridge deck. _Avoid_: Ground, tile, surface

**Liquid**: The layer over a floor that turns the place from land into water. The floor beneath it is still there. _Avoid_: Wet, fluid

**Land**: A place with a floor and no liquid over it. Derived from what is there, never stored. _Avoid_: Walkable, dry ground

**Water**: A place with liquid over its floor. Derived from what is there, never stored. _Avoid_: Swimmable, wet ground

**Terrain**: The floor of a cell and any liquid over it. Everything else in the cell stands on it. _Avoid_: Ground, base, a terrain

**Region**: A set of cells, given as a rectangle, a disc or a list. _Avoid_: Area, span, zone

### What exists

**Entity**: One thing in the world: a prefab, at a cell, with whatever differs from its prefab. _Avoid_: Thing, object, tile, instance

**Character**: An entity that an agent controls. _Avoid_: Avatar, villager, player, role

**Component**: One property an entity can have, from a closed set. An entity has the components of its prefab, and may override or add any of them. _Avoid_: Trait, property, attribute

**Habitat**: A component: the places an entity can be, which is land, water or both. It holds for a plant being placed and for a character moving. _Avoid_: Aquatic, floating, walks, swims

**Obstacle**: A component: the entity is in the way, so no character can move into its cell whatever its habitat. Other entities may still share the cell, as a mushroom does under an oak. The floor under an obstacle is still land. _Avoid_: Blocking, solid, unwalkable

### Definitions

**Definition**: Any authored description of the world, held as data: a prefab or a biome. _Avoid_: Content, catalog, config

**Prefab**: A named definition of a sort of entity, such as oak, grass or sign: the components every entity of that sort starts with. _Avoid_: Kind, type, prototype, blueprint

**Category**: A grouping of prefabs for organization, such as nature or made. No rule reads it. _Avoid_: Class, group, family

**Label**: A component: what an agent calls the entity and the glyph it is drawn with on the map. _Avoid_: Noun, name, description

**Model**: A component: the named parts the entity is drawn from. _Avoid_: Appearance, mesh, sprite

**Part**: A named piece of a model with one shade, made of one or more forms. An oak has a trunk and a crown. _Avoid_: Mesh, piece, tinted part

**Colors**: A component: the shades an entity gives to named parts of its model, in place of the model's own. An entity has no single color. _Avoid_: Tint, dye, the entity's color

**Palette**: Every shade the world is drawn in. It is vocabulary that definitions are written in, not a definition itself. _Avoid_: Ink, swatches, theme

**Shade**: A named color in the palette, with the value the spectator view paints. _Avoid_: Ink, hex, hue

**Biome**: A recipe for generating a region: a floor, any liquid over it, and what grows there and how often. It is not stored in the world. _Avoid_: Region, zone, area

### How the world changes

**Command**: A request to change the world, which the world either accepts or refuses. Nothing else changes it. _Avoid_: Edit, action, mutation

**Event**: Something that happened to the world because a command was accepted. One command may cause several. An event is a fact and is never refused. It says everything that happened: what, and where. _Avoid_: Change, update, delta

**Rule**: Something that must hold in the world, such as one entity per layer, or an entity only where its habitat allows. _Avoid_: Constraint, law, validation

**Refusal**: The world's answer to a command that would break a rule, saying which. _Avoid_: Rejection, error, failure

**History**: Every event, in order. _Avoid_: Log, journal, timeline

### How the world is shown

**View**: The world as shown to one kind of reader, such as the spectator view in 3D or the map in text. _Avoid_: Render, readout, display

**Map**: The view that draws each cell as one glyph. _Avoid_: Grid, text map, chart

### Outside the world

**Agent**: An AI that someone runs in their own harness, outside the world. It reaches the world over MCP, and only its character is in the world. _Avoid_: Bot, player, user

**Generator**: A program outside the world that turns a seed and biomes into commands. _Avoid_: Worldgen, builder
