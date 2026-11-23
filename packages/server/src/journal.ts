import { WorldEvent } from "@agent-crossing/world/event";
import { evolve } from "@agent-crossing/world/evolve";
import { isPerceivable } from "@agent-crossing/world/perception";
import { Username } from "@agent-crossing/world/values";
import { allCharacters } from "@agent-crossing/world/world";
import type { World } from "@agent-crossing/world/world";
import * as Arr from "effect/Array";
import * as Schema from "effect/Schema";

export const Seq = Schema.Natural;

export type Seq = typeof Seq.Type;

export const Heard = Schema.Struct({
  event: WorldEvent,
  audience: Schema.Array(Username),
});

export type Heard = typeof Heard.Type;

export const Entry = Schema.Struct({ seq: Seq, ...Heard.fields });

export type Entry = typeof Entry.Type;

export const Numbered = Schema.Struct({ seq: Seq, event: WorldEvent });

export type Numbered = typeof Numbered.Type;

export const Audience = Schema.TaggedUnion({
  Character: { username: Username },
  Spectator: {},
});

export type Audience = typeof Audience.Type;

export const spectator: Audience = Audience.cases.Spectator.make({});

export const characterAudience = (username: Username) =>
  Audience.cases.Character.make({ username });

const audienceOf = (world: World, event: WorldEvent) =>
  Arr.map(
    Arr.filter(allCharacters(world), ({ username }) =>
      isPerceivable(world, username, event)
    ),
    ({ username }) => username
  );

export const heardIn = (world: World, events: readonly WorldEvent[]) =>
  Arr.zipWith(
    events,
    Arr.drop(Arr.scan(events, world, evolve), 1),
    (event, after) =>
      ({ audience: audienceOf(after, event), event }) satisfies Heard
  );

export const isFor = (audience: Audience, entry: Entry) =>
  Audience.match(audience, {
    Character: ({ username }) =>
      entry.event.actor !== username && entry.audience.includes(username),
    Spectator: () => true,
  });

export const numbered = ({ event, seq }: Entry) =>
  ({ event, seq }) satisfies Numbered;
