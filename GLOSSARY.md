# Agent Crossing world

The words for what the world is made of and how it is described. They cover the world's definitions and what exists in it, not how agents act or how edits are made.

## Language

### Where things are

**Cell**: One square of the grid, named by its coordinates. Cells are never created or destroyed; the world is wherever entities are, and its edge is only where floors stop. _Avoid_: Tile, square, coordinate

**Level**: The vertical step of a position. It is a fact of a floor, a liquid or anything resting on nothing, and a consequence for everything standing on a floor. _Avoid_: Height, elevation, altitude

**Layer**: A slot of a cell that at most one entity may fill: floor, liquid, cover or object. An entity that claims no layer shares its cell freely. _Avoid_: Slot, tier

**Floor**: The bottom layer. Other entities stand on the entity that fills it and take their level from it. Grass is a floor; so is the bed of a pond, or a bridge deck. _Avoid_: Ground, tile, surface

**Liquid**: The layer over a floor that turns the place from land into water. The floor beneath it is still there. _Avoid_: Wet, fluid

**Land**: A place with a floor and no liquid over it. Derived from what is there, never stored. _Avoid_: Walkable, dry ground

**Water**: A place with liquid over its floor. Derived from what is there, never stored. _Avoid_: Swimmable, wet ground

### What exists

**Entity**: One thing in the world: a prefab, at a cell, with whatever differs from its prefab. _Avoid_: Thing, object, tile, instance

**Component**: One property an entity can have, from a closed set. An entity has the components of its prefab, and may override or add any of them. _Avoid_: Trait, property, attribute

**Habitat**: A component: the places an entity can be, which is land, water or both. It holds for a plant being placed and for a character moving. _Avoid_: Aquatic, floating, walks, swims

**Obstacle**: A component: the entity is in the way, so no character can move into its cell whatever its habitat. Other entities may still share the cell, as a mushroom does under an oak. The floor under an obstacle is still land. _Avoid_: Blocking, solid, unwalkable

### Definitions

**Definition**: Any authored description of the world, held as data: a prefab or a biome. _Avoid_: Content, catalog, config

**Prefab**: A named definition of a sort of entity, such as oak, grass or sign: the components every entity of that sort starts with. _Avoid_: Kind, type, prototype, blueprint

**Category**: A grouping of prefabs for organization, such as terrain, nature or made. No rule reads it. _Avoid_: Class, group, family

**Terrain**: The category of the natural prefabs that make up the land and water. It is not a kind of entity and carries no rules of its own. _Avoid_: Ground, a terrain

**Label**: A component: what an agent calls the entity and the glyph it is drawn with on a text map. _Avoid_: Noun, name, description

**Model**: A component: the named parts the entity is drawn from. _Avoid_: Appearance, mesh, sprite

**Part**: A named piece of a model with one shade, made of one or more forms. An oak has a trunk and a crown. _Avoid_: Mesh, piece, tinted part

**Colors**: A component: the shades an entity gives to named parts of its model, in place of the model's own. An entity has no single color. _Avoid_: Tint, dye, the entity's color

**Palette**: Every shade the world is drawn in. It is vocabulary that definitions are written in, not a definition itself. _Avoid_: Ink, swatches, theme

**Shade**: A named color in the palette, with the value the spectator view paints. _Avoid_: Ink, hex, hue

**Biome**: A recipe for generating an area: a floor, any liquid over it, and what grows there and how often. It is not stored in the world. _Avoid_: Region, zone, area
