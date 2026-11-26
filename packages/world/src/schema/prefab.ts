import type { Components, Label } from "./components.ts";
import type { Model } from "./model.ts";

/**
 * A named definition of a sort of entity: the components every entity of
 * that sort starts with, always with a label and a model. `name` is stored,
 * so it never changes.
 */
export interface Prefab<Name extends string = string> {
  readonly name: Name;
  readonly components: typeof Components.Type & {
    readonly label: typeof Label.Type;
    readonly model: typeof Model.Type;
  };
}

/** A prefab, keeping its name as a literal type. */
export const prefab = <const Name extends string>(
  name: Name,
  components: Prefab["components"]
) => ({ components, name }) satisfies Prefab<Name>;
