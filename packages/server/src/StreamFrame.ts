import * as Entity from "@agent-crossing/world/Entity";
import * as Event from "@agent-crossing/world/Event";
import * as World from "@agent-crossing/world/World";
import * as Arr from "effect/Array";
import * as Schema from "effect/Schema";

const FRAME_MAX_ENTITIES = 1000;

/**
 * Frames of the world's event stream. A reader gathers the entities of
 * every `Entities` batch after `Reset`, builds its world from them once
 * `Ready` arrives, then applies every `Happened` event after `cursor`.
 */
export const StreamFrame = Schema.TaggedUnion({
  Reset: {},
  Entities: { entities: Schema.Array(Entity.Entity) },
  Ready: { cursor: Event.Seq },
  Happened: { seq: Event.Seq, event: Event.Event },
});

/**
 * The frames that open a stream: `Reset`, the world's entities in batches,
 * oldest first, then `Ready` with the sequence number of the last event the
 * world includes.
 */
export const opening = (world: World.World, cursor: number) => {
  const frames: readonly (typeof StreamFrame.Type)[] = [
    StreamFrame.cases.Reset.make({}),
    ...Arr.map(
      Arr.chunksOf(World.entities(world), FRAME_MAX_ENTITIES),
      (entities) => StreamFrame.cases.Entities.make({ entities })
    ),
    StreamFrame.cases.Ready.make({ cursor }),
  ];

  return frames;
};
