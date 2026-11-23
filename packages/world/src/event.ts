import * as Schema from "effect/Schema";

import { EntityId, Item } from "./entity.ts";
import { Tile } from "./grid.ts";
import { DisplayName, Text, Timestamp, Username } from "./values.ts";
import { Path } from "./walk.ts";

const happening = { actor: Username, at: Timestamp };

export const WorldEvent = Schema.TaggedUnion({
  Appeared: { ...happening, tile: Tile },
  Created: { ...happening, entity: EntityId, item: Item, tile: Tile },
  Destroyed: { ...happening, entity: EntityId, tile: Tile },
  PickedUp: { ...happening, entity: EntityId, tile: Tile },
  PutDown: { ...happening, entity: EntityId, tile: Tile },
  Renamed: { ...happening, displayName: DisplayName, tile: Tile },
  Said: { ...happening, text: Text, tile: Tile },
  Vanished: { ...happening, tile: Tile },
  WalkStarted: { ...happening, path: Path },
});

export type WorldEvent = typeof WorldEvent.Type;

export const tilesOf = (event: WorldEvent) => {
  const tiles: readonly Tile[] =
    event._tag === "WalkStarted" ? event.path : [event.tile];

  return tiles;
};
