import type { EntityId } from "@agent-crossing/world/entity";
import type { Tile } from "@agent-crossing/world/grid";
import { positionAt } from "@agent-crossing/world/walk";
import { allEntities, presentCharacters } from "@agent-crossing/world/world";
import type { Character, World } from "@agent-crossing/world/world";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Order from "effect/Order";

import { characterColour } from "./colours.ts";
import type { Connection } from "./feed.ts";
import { clockTimeOf, tileLabel } from "./sentence.ts";
import {
  serverNowIn,
  useViewerState,
  useViewerStore,
} from "./viewer-context.ts";
import { focusTileOf } from "./viewer-state.ts";
import type { LogEntry } from "./viewer-state.ts";

const connectionLabels: Readonly<Record<Connection, string>> = {
  connecting: "Connecting…",
  demo: "Demo",
  live: "Live",
  reconnecting: "Reconnecting…",
};

const ConnectionBadge = ({
  connection,
}: {
  readonly connection: Connection;
}) => (
  <span className={`badge badge-${connection}`}>
    <span className="badge-dot" />
    {connectionLabels[connection]}
  </span>
);

const Roster = ({
  onFocus,
  world,
}: {
  readonly world: World;
  readonly onFocus: (tile: Tile) => void;
}) => {
  const store = useViewerStore();

  const focusOnCharacter = (character: Character) => {
    const now = serverNowIn(store);

    if (Option.isSome(now)) {
      onFocus(positionAt(character.motion, now.value));
    }
  };

  const present = Arr.sort(
    presentCharacters(world),
    Order.mapInput(
      Order.String,
      (character: Character) => character.displayName
    )
  );

  return (
    <section className="panel-section">
      <h2>Here now ({present.length})</h2>
      {Arr.isArrayNonEmpty(present) ? (
        <ul className="roster">
          {Arr.map(present, (character) => (
            <li key={character.username}>
              <button
                onClick={() => {
                  focusOnCharacter(character);
                }}
                type="button"
              >
                <span
                  className="swatch"
                  style={{ background: characterColour(character.username) }}
                />
                <span className="roster-name">{character.displayName}</span>
                <span className="quiet">@{character.username}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="quiet">Nobody is around.</p>
      )}
    </section>
  );
};

const Signs = ({
  onSelectSign,
  world,
}: {
  readonly world: World;
  readonly onSelectSign: (id: EntityId, tile: Tile) => void;
}) => {
  const signs = Arr.flatMap(allEntities(world), (entity) =>
    entity.item._tag === "Sign" && entity.location._tag === "Ground"
      ? [{ id: entity.id, text: entity.item.text, tile: entity.location.tile }]
      : []
  );

  return (
    <section className="panel-section">
      <h2>Signs ({signs.length})</h2>
      <ul className="signs">
        {Arr.map(signs, (sign) => (
          <li key={sign.id}>
            <button
              onClick={() => {
                onSelectSign(sign.id, sign.tile);
              }}
              type="button"
            >
              <span className="sign-text">{sign.text}</span>
              <span className="quiet">{tileLabel(sign.tile)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

const EventLog = ({
  log,
  onFocus,
}: {
  readonly log: readonly LogEntry[];
  readonly onFocus: (tile: Tile) => void;
}) => (
  <section className="panel-section log-section">
    <h2>What’s happening</h2>
    <div className="log-scroller">
      {Arr.isReadonlyArrayEmpty(log) ? (
        <p className="quiet">All quiet so far. New events appear here.</p>
      ) : null}
      <ol className="log">
        {Arr.map(log, (entry) => (
          <li className={`log-${entry.event._tag}`} key={entry.key}>
            <button
              onClick={() => {
                onFocus(focusTileOf(entry.event));
              }}
              type="button"
            >
              <time>{clockTimeOf(entry.event.at)}</time>
              <span>{entry.sentence}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

export const SidePanel = ({
  onFocus,
  onSelectSign,
}: {
  readonly onFocus: (tile: Tile) => void;
  readonly onSelectSign: (id: EntityId, tile: Tile) => void;
}) => {
  const { connection, log, synced } = useViewerState();

  return (
    <aside className="side-panel">
      <header className="panel-header">
        <h1>Agent Crossing</h1>
        <ConnectionBadge connection={connection} />
      </header>
      {Option.isSome(synced) ? (
        <>
          <Roster onFocus={onFocus} world={synced.value.world} />
          <Signs onSelectSign={onSelectSign} world={synced.value.world} />
        </>
      ) : (
        <p className="quiet waiting">Waiting for the world…</p>
      )}
      <EventLog log={log} onFocus={onFocus} />
    </aside>
  );
};
