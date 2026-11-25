import * as Schema from "effect/Schema";
import * as Str from "effect/String";

import { PrefabName, prefabsByName } from "../../definitions/prefabs/index.ts";
import { Cell } from "../../schema/cell.ts";
import { Components } from "../../schema/components.ts";
import type { Label } from "../../schema/components.ts";

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
  prefab: PrefabName,
  cell: Cell,
  components: Components,
});

type Described = Pick<typeof Entity.Type, "prefab" | "components">;

/** The components every entity of the prefab starts with. */
export const prefabComponents = (prefab: typeof PrefabName.Type) => {
  const components: typeof Components.Type =
    prefabsByName.get(prefab)?.components ?? {};

  return components;
};

/** `over` wins wherever it says something. */
export const overlay = (
  under: typeof Components.Type,
  over: typeof Components.Type
) => ({ ...under, ...over }) satisfies typeof Components.Type;

/** The entity's effective components: its prefab's overlaid by its own. */
export const componentsOf = (entity: Described) =>
  overlay(prefabComponents(entity.prefab), entity.components);

/** The level a floor or liquid stores; a missing one reads as 0. */
export const storedLevel = (entity: Described) =>
  componentsOf(entity).level ?? 0;

const unlabeled = (prefab: string) =>
  ({ glyph: "?", noun: prefab }) satisfies typeof Label.Type;

export const labelOf = (entity: Described) =>
  componentsOf(entity).label ?? unlabeled(entity.prefab);

export const nounOf = (entity: Described) => labelOf(entity).noun;

export const pluralOf = (label: typeof Label.Type) =>
  label.plural ?? `${label.noun}s`;
