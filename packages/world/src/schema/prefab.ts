import type { Components } from "./components.ts";

/**
 * A named definition of a sort of entity: the components every entity of
 * that sort starts with. `name` is stored, so it never changes.
 */
export interface Prefab<Name extends string = string> {
  readonly name: Name;
  readonly components: typeof Components.Type;
}

/** A prefab, keeping its name as a literal type. */
export const prefab = <const Name extends string>(
  name: Name,
  components: typeof Components.Type
) => ({ components, name }) satisfies Prefab<Name>;
