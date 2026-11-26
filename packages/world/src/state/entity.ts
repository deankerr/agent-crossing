import * as Components from "@agent-crossing/definitions/Components";
import * as Prefabs from "@agent-crossing/definitions/Prefabs";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

import { Cell } from "../schema/cell.ts";

export const EntityId = Schema.String.check(
  Schema.isPattern(/^e[1-9]\d{0,8}$/u)
).pipe(Schema.brand("EntityId"));

export const entityIdFor = (serial: number) => EntityId.make(`e${serial}`);

export const entitySerial = (id: typeof EntityId.Type) =>
  Number(Str.slice(1)(id));

/**
 * One thing in the world: a prefab, at a cell, with whatever differs from
 * its prefab. Floors and liquids keep their level in `components`.
 */
export const Entity = Schema.Struct({
  id: EntityId,
  prefab: Prefabs.Name,
  cell: Cell,
  components: Components.Components,
});

type Described = Pick<typeof Entity.Type, "prefab" | "components">;

/**
 * The components every entity of the prefab starts with. Prefab names are
 * read from the prefabs, so every name has one.
 */
export const prefabComponents = (prefab: typeof Prefabs.Name.Type) =>
  Option.getOrThrow(Option.fromUndefinedOr(Prefabs.byName.get(prefab)))
    .components;

/** `over` wins wherever it says something. */
export const overlay = <Under extends typeof Components.Components.Type>(
  under: Under,
  over: typeof Components.Components.Type
) => ({ ...under, ...over }) satisfies typeof Components.Components.Type;

/** The entity's effective components: its prefab's overlaid by its own. */
export const componentsOf = (entity: Described) =>
  overlay(prefabComponents(entity.prefab), entity.components);

/** The level a floor or liquid stores; a missing one reads as 0. */
export const storedLevel = (entity: Described) =>
  componentsOf(entity).level ?? 0;

export const labelOf = (entity: Described) => componentsOf(entity).label;

export const nounOf = (entity: Described) => labelOf(entity).noun;

export const pluralOf = (label: typeof Components.Label.Type) =>
  label.plural ?? `${label.noun}s`;
