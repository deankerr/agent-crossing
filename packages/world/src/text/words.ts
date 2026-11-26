import type * as Components from "@agent-crossing/definitions/Components";
import * as Arr from "effect/Array";
import * as Str from "effect/String";

import { pluralOf } from "../state/entity.ts";
import type { Span } from "../state/span.ts";

export const counted = (count: number, label: typeof Components.Label.Type) =>
  `${count} ${count === 1 ? label.noun : pluralOf(label)}`;

export const article = (noun: string) =>
  /^[aeiou]/u.test(noun) ? `an ${noun}` : `a ${noun}`;

export const listed = (parts: readonly string[]) => Arr.join(parts, ", ");

export const spanText = (span: Span) =>
  `x ${span.minX} to ${span.maxX}, y ${span.minY} to ${span.maxY}`;

export const quoted = (text: string) => `"${Str.replaceAll('"', "'")(text)}"`;

export const cellsWord = (count: number) =>
  count === 1 ? "1 cell" : `${count} cells`;

export const entitiesWord = (count: number) =>
  count === 1 ? "1 entity" : `${count} entities`;
