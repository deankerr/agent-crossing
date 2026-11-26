import type * as Components from "@agent-crossing/definitions/Components";
import * as Arr from "effect/Array";
import * as Str from "effect/String";

import * as Entity from "../Entity.ts";
import type * as Span from "../Span.ts";

export const counted = (count: number, label: typeof Components.Label.Type) =>
  `${count} ${count === 1 ? label.noun : Entity.pluralOf(label)}`;

export const article = (noun: string) =>
  /^[aeiou]/u.test(noun) ? `an ${noun}` : `a ${noun}`;

export const listed = (parts: readonly string[]) => Arr.join(parts, ", ");

export const spanText = (span: Span.Span) =>
  `x ${span.minX} to ${span.maxX}, y ${span.minY} to ${span.maxY}`;

export const quoted = (text: string) => `"${Str.replaceAll('"', "'")(text)}"`;

export const cellsWord = (count: number) =>
  count === 1 ? "1 cell" : `${count} cells`;

export const entitiesWord = (count: number) =>
  count === 1 ? "1 entity" : `${count} entities`;
