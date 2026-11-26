import * as Cell from "@agent-crossing/world/Cell";
import { inspectText } from "@agent-crossing/world/text/inspect";
import { summaryText } from "@agent-crossing/world/text/summary";
import type * as World from "@agent-crossing/world/World";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";

import { statusOf } from "../feed/feed-state.ts";
import type { FeedState, HistoryEntry, Status } from "../feed/feed-state.ts";

const statusLabels: Readonly<Record<Status, string>> = {
  connecting: "Connecting…",
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
  readonly world: World.World;
  readonly cell: typeof Cell.Cell.Type;
  readonly onClose: () => void;
}) => (
  <section className="panel-section">
    <header className="section-header">
      <h2>Cell {Cell.format(cell)}</h2>
      <button
        aria-label="Close the cell"
        className="close"
        onClick={onClose}
        type="button"
      >
        ×
      </button>
    </header>
    <pre className="panel-text">{inspectText(world, cell)}</pre>
  </section>
);

const Summary = ({ world }: { readonly world: World.World }) => (
  <section className="panel-section">
    <h2>The world</h2>
    <pre className="panel-text">{summaryText(world)}</pre>
  </section>
);

const History = ({
  history,
  onPick,
}: {
  readonly history: readonly HistoryEntry[];
  readonly onPick: (cell: typeof Cell.Cell.Type) => void;
}) => (
  <section className="panel-section">
    <h2>What’s happening</h2>
    {Arr.isReadonlyArrayEmpty(history) ? (
      <p className="quiet">All quiet so far. New edits appear here.</p>
    ) : (
      <ol className="history">
        {Arr.map(history, (entry) => (
          <li
            className={
              entry.kind === "EntitiesRemoved" ? "history-removed" : undefined
            }
            key={entry.key}
          >
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
  readonly selected: Option.Option<typeof Cell.Cell.Type>;
  readonly onPick: (cell: typeof Cell.Cell.Type) => void;
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
              Click a cell to see what stands there.
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
