import * as Schema from "effect/Schema";
import * as Str from "effect/String";

import { Cell } from "./cell.ts";
import { Components, overlay } from "./components.ts";
import type { Label } from "./components.ts";
import { kindDefaults, KindName } from "./kind.ts";

export const EntityId = Schema.String.check(
  Schema.isPattern(/^e[1-9]\d{0,8}$/u)
).pipe(Schema.brand("EntityId"));

export type EntityId = typeof EntityId.Type;

export const entityIdFor = (serial: number) => EntityId.make(`e${serial}`);

export const entitySerial = (id: EntityId) => Number(Str.slice(1)(id));

/**
 * A thing in the world. `components` holds only what differs from its kind,
 * so it is often empty, or just a colour or a text.
 */
export const Entity = Schema.Struct({
  id: EntityId,
  kind: KindName,
  cell: Cell,
  components: Components,
});

export type Entity = typeof Entity.Type;

/** The entity's effective components: its kind's defaults overlaid by its own. */
export const componentsOf = (entity: Pick<Entity, "kind" | "components">) =>
  overlay(kindDefaults(entity.kind), entity.components);

const unlabelled = (kind: string) =>
  ({ glyph: "?", noun: kind }) satisfies Label;

export const labelOf = (entity: Pick<Entity, "kind" | "components">) =>
  componentsOf(entity).label ?? unlabelled(entity.kind);

export const nounOf = (entity: Pick<Entity, "kind" | "components">) =>
  labelOf(entity).noun;

export const pluralOf = (label: Label) => label.plural ?? `${label.noun}s`;
