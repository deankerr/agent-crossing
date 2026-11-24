import { formatCell } from "@agent-crossing/world/cell";
import type { Cell } from "@agent-crossing/world/cell";
import { componentsOf, nounOf } from "@agent-crossing/world/entity";
import { traitsOf } from "@agent-crossing/world/ground";
import { agentViewText } from "@agent-crossing/world/text";
import {
  bounds,
  cellCount,
  entitiesAt,
  entityCount,
  entityCounts,
  groundAt,
  groundCounts,
  isWalkable,
} from "@agent-crossing/world/world";
import type { World } from "@agent-crossing/world/world";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";

import { statusOf } from "./feed-state.ts";
import type { FeedState, HistoryEntry, Status } from "./feed-state.ts";
import { groundStyles, palette } from "./palette.ts";

const HISTORY_SHOWN = 120;
const KINDS_SHOWN = 18;

const statusLabels: Readonly<Record<Status, string>> = {
  connecting: "Connecting…",
  demo: "Demo",
  live: "Live",
  loading: "Loading…",
  reconnecting: "Reconnecting…",
  reloading: "Reloading…",
};

const StatusBadge = ({ status }: { readonly status: Status }) => (
  <span className={`badge badge-${status}`}>
    <span className="badge-dot" />
    {statusLabels[status]}
  </span>
);

const clockTime = (at: number) =>
  DateTime.formatLocal(DateTime.makeUnsafe(at), {
    hour: "2-digit",
    minute: "2-digit",
  });

const CellDetails = ({
  cell,
  onClose,
  world,
}: {
  readonly world: World;
  readonly cell: Cell;
  readonly onClose: () => void;
}) => {
  const entities = entitiesAt(world, cell);
  const ground = groundAt(world, cell);

  return (
    <section className="panel-section cell-section">
      <header className="section-header">
        <h2>Cell {formatCell(cell)}</h2>
        <button
          aria-label="Close the cell"
          className="close"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      </header>
      {Option.isSome(ground) ? (
        <p className="ground-line">
          <span
            className="swatch"
            style={{ background: groundStyles[ground.value.kind].top }}
          />
          {traitsOf(ground.value.kind).noun} · height {ground.value.height} ·{" "}
          {isWalkable(world, cell) ? "walkable" : "not walkable"}
        </p>
      ) : (
        <p className="quiet">Outside the world: no ground here.</p>
      )}
      {Arr.isReadonlyArrayNonEmpty(entities) ? (
        <ul className="entity-list">
          {Arr.map(entities, (entity) => {
            const { colour, layer, text } = componentsOf(entity);

            return (
              <li key={entity.id}>
                <span className="entity-noun">{nounOf(entity)}</span>
                <span className="quiet">
                  {entity.kind} · {entity.id}
                  {layer === undefined ? "" : ` · ${layer}`}
                </span>
                {colour === undefined ? null : (
                  <span className="colour">
                    <span
                      className="swatch"
                      style={{ background: palette[colour] }}
                    />
                    {colour}
                  </span>
                )}
                {text === undefined ? null : <q className="writing">{text}</q>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="quiet">Nothing stands here.</p>
      )}
      <h3>What an agent here is told</h3>
      <pre className="agent-view">{agentViewText(world, cell)}</pre>
    </section>
  );
};

const Summary = ({ world }: { readonly world: World }) => {
  const kinds = entityCounts(world);
  const shownKinds = Arr.take(kinds, KINDS_SHOWN);
  const hidden = kinds.length - shownKinds.length;
  const span = bounds(world);

  return (
    <section className="panel-section">
      <h2>The world</h2>
      {Option.isSome(span) ? (
        <p>
          {cellCount(world).toLocaleString()} cells ·{" "}
          {entityCount(world).toLocaleString()} things
          <span className="quiet">
            {" "}
            · x {span.value.minX} to {span.value.maxX}, y {span.value.minY} to{" "}
            {span.value.maxY}
          </span>
        </p>
      ) : (
        <p className="quiet">No ground yet.</p>
      )}
      <ul className="chips">
        {Arr.map(groundCounts(world), ({ count, kind }) => (
          <li key={kind}>
            <span
              className="swatch"
              style={{ background: groundStyles[kind].top }}
            />
            {kind} <b>{count.toLocaleString()}</b>
          </li>
        ))}
      </ul>
      {Arr.isReadonlyArrayNonEmpty(shownKinds) ? (
        <ul className="chips">
          {Arr.map(shownKinds, ({ count, kind }) => (
            <li key={kind}>
              {kind} <b>{count.toLocaleString()}</b>
            </li>
          ))}
          {hidden > 0 ? <li className="quiet">+{hidden} more</li> : null}
        </ul>
      ) : null}
    </section>
  );
};

const History = ({
  history,
  onPick,
}: {
  readonly history: readonly HistoryEntry[];
  readonly onPick: (cell: Cell) => void;
}) => (
  <section className="panel-section history-section">
    <h2>What’s happening</h2>
    {Arr.isReadonlyArrayEmpty(history) ? (
      <p className="quiet">All quiet so far. New edits appear here.</p>
    ) : (
      <ol className="history">
        {Arr.map(Arr.take(history, HISTORY_SHOWN), (entry) => (
          <li className={`history-${entry.kind}`} key={entry.key}>
            <button
              disabled={Option.isNone(entry.cell)}
              onClick={() => {
                Option.map(entry.cell, onPick);
              }}
              type="button"
            >
              <time>{clockTime(entry.at)}</time>
              <span>{entry.sentence}</span>
            </button>
          </li>
        ))}
      </ol>
    )}
  </section>
);

export const SidePanel = ({
  onClose,
  onPick,
  selected,
  state,
}: {
  readonly state: FeedState;
  readonly selected: Option.Option<Cell>;
  readonly onPick: (cell: Cell) => void;
  readonly onClose: () => void;
}) => (
  <aside className="side-panel">
    <header className="panel-header">
      <h1>Agent Crossing</h1>
      <StatusBadge status={statusOf(state)} />
    </header>
    <div className="panel-body">
      {Option.isSome(state.shown) ? (
        <>
          {Option.isSome(selected) ? (
            <CellDetails
              cell={selected.value}
              onClose={onClose}
              world={state.shown.value.world}
            />
          ) : (
            <p className="quiet waiting">
              Click a cell to see what stands there and what an agent there
              would be told.
            </p>
          )}
          <Summary world={state.shown.value.world} />
        </>
      ) : (
        <p className="quiet waiting">Waiting for the world…</p>
      )}
      <History history={state.history} onPick={onPick} />
    </div>
  </aside>
);
