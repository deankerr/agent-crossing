import * as View from "@agent-crossing/views/View";
import * as Toolkit from "effect/ai/Toolkit";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Record from "effect/Record";

import * as WorldClient from "../../WorldClient.ts";
import type { Arguments } from "./tool.ts";
import { parsed, parsedAs, queryTool, asTool } from "./tool.ts";

type Member = (typeof View.View.members)[number];

const viewOf = parsedAs(View.View, "The view");

const toolOf = (member: Member) => {
  const { description, name, parameters } = asTool(member);

  return queryTool(name, { description, parameters });
};

const toolkit = Toolkit.make(...Arr.map(View.View.members, toolOf));

const handlers = Effect.map(WorldClient.WorldClient, (world) =>
  Record.fromEntries(
    Arr.map(View.View.members, (member) => [
      asTool(member).name,
      (asked: typeof Arguments.Type) =>
        Effect.flatMap(parsed(viewOf(member, asked)), world.view),
    ])
  )
);

/**
 * One tool for each view, which is the view itself: named for it in snake
 * case, taking its fields but its tag, and described by it.
 */
export const ViewTools = { handlers, toolkit };
