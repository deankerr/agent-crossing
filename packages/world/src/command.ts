import * as Schema from "effect/Schema";

import { EntityId, Item } from "./entity.ts";
import { Tile } from "./grid.ts";
import { DisplayName, Text, Username } from "./values.ts";

const byActor = { actor: Username };

export const Command = Schema.TaggedUnion({
  Create: { ...byActor, tile: Tile, item: Item },
  Destroy: { ...byActor, entity: EntityId },
  Look: byActor,
  Move: { ...byActor, to: Tile },
  PickUp: { ...byActor, entity: EntityId },
  PutDown: { ...byActor, tile: Tile },
  Rename: { ...byActor, name: DisplayName },
  Say: { ...byActor, text: Text },
  StreamClosed: byActor,
  StreamOpened: byActor,
});

export type Command = typeof Command.Type;

export const decodeCommand = Schema.decodeUnknownResult(Command);
