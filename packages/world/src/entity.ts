import * as Schema from "effect/Schema";
import * as Str from "effect/String";

import { Tile } from "./grid.ts";
import { Colour, Text, Username } from "./values.ts";

export const ENTITY_LIMIT = 500;

export const EntityId = Schema.String.check(
  Schema.isPattern(/^e[1-9]\d*$/u)
).pipe(Schema.brand("EntityId"));

export type EntityId = typeof EntityId.Type;

export const entityIdFor = (serial: number) => EntityId.make(`e${serial}`);

export const entitySerial = (id: EntityId) => Number(Str.slice(1)(id));

export const Item = Schema.TaggedUnion({
  Block: { colour: Colour },
  Flower: { colour: Colour },
  Sign: { text: Text },
});

export type Item = typeof Item.Type;

export const Location = Schema.TaggedUnion({
  Carried: { by: Username },
  Ground: { tile: Tile },
});

export type Location = typeof Location.Type;

export const Entity = Schema.Struct({
  id: EntityId,
  item: Item,
  location: Location,
});

export type Entity = typeof Entity.Type;
