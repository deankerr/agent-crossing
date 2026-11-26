import type * as Components from "@agent-crossing/definitions/Components";
import * as Entity from "@agent-crossing/world/Entity";
import * as Region from "@agent-crossing/world/Region";
import * as Arr from "effect/Array";
import * as Order from "effect/Order";
import * as Str from "effect/String";

type Described = Parameters<typeof Entity.components>[0];

export const labelOf = (entity: Described) => Entity.components(entity).label;

export const nounOf = (entity: Described) => labelOf(entity).noun;

export const pluralOf = (label: typeof Components.Label.Type) =>
  label.plural ?? `${label.noun}s`;

export const counted = (count: number, label: typeof Components.Label.Type) =>
  `${count} ${count === 1 ? label.noun : pluralOf(label)}`;

export const article = (noun: string) =>
  /^[aeiou]/u.test(noun) ? `an ${noun}` : `a ${noun}`;

export const listed = (parts: readonly string[]) => Arr.join(parts, ", ");

/** The parts joined with commas and a final "and". */
export const joined = (parts: readonly string[]) =>
  parts.length <= 1
    ? Arr.join(parts, "")
    : `${Arr.join(Arr.dropRight(parts, 1), ", ")} and ${parts.at(-1) ?? ""}`;

export const rectText = (given: typeof Region.Rect.Type) => {
  const { from, to } = Region.rect(given.from, given.to);

  return `x ${from.x} to ${to.x}, y ${from.y} to ${to.y}`;
};

export const quoted = (text: string) => `"${Str.replaceAll('"', "'")(text)}"`;

export const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

export const cellsWord = (count: number) => plural(count, "cell", "cells");

export const entitiesWord = (count: number) =>
  plural(count, "entity", "entities");

interface Count {
  readonly key: string;
  readonly count: number;
}

/** How many items share each key, most first, then by key. */
export const countsBy = <A>(items: Iterable<A>, keyOf: (item: A) => string) => {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Arr.sort(
    Arr.map(Arr.fromIterable(counts), ([key, count]) => ({ count, key })),
    Order.combine(
      Order.mapInput(Order.flip(Order.Number), (entry: Count) => entry.count),
      Order.mapInput(Order.String, (entry: Count) => entry.key)
    )
  );
};
