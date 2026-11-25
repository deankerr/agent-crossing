import { palette } from "@agent-crossing/world/definitions/palette";
import {
  componentsOf,
  nounOf,
  storedLevel,
} from "@agent-crossing/world/engine/state/entity";
import type { Entity } from "@agent-crossing/world/engine/state/entity";
import {
  allEntities,
  bounds,
  cellCount,
  countsBy,
  entitiesAt,
  floorAt,
  isFloor,
  isLiquid,
  isWalkable,
  liquidAt,
} from "@agent-crossing/world/engine/state/world";
import type { World } from "@agent-crossing/world/engine/state/world";
import { agentViewText } from "@agent-crossing/world/engine/text/agent-view";
import { formatCell } from "@agent-crossing/world/schema/cell";
import type { Cell } from "@agent-crossing/world/schema/cell";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Record from "effect/Record";

import { statusOf } from "../feed/feed-state.ts";
import type { FeedState, HistoryEntry, Status } from "../feed/feed-state.ts";
import { partHex } from "../scene/model-geometry.ts";

const HISTORY_SHOWN = 120;
const PREFABS_SHOWN = 18;

const swatchOf = (entity: typeof Entity.Type) => {
  const { colors, model } = componentsOf(entity);

  return Option.match(Option.fromNullishOr(model?.parts[0]), {
    onNone: () => "transparent",
    onSome: (part) => partHex(part, colors),
  });
};

const isStanding = (entity: typeof Entity.Type) =>
  !isFloor(entity) && !isLiquid(entity);

const LayerLine = ({ entity }: { readonly entity: typeof Entity.Type }) => (
  <>
    <span className="swatch" style={{ background: swatchOf(entity) }} />
    {nounOf(entity)} · level {storedLevel(entity)}
  </>
);

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
  readonly cell: typeof Cell.Type;
  readonly onClose: () => void;
}) => {
  const entities = Arr.filter(entitiesAt(world, cell), isStanding);
  const floor = floorAt(world, cell);
  const liquid = liquidAt(world, cell);

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
      {Option.isSome(floor) ? (
        <>
          <p className="floor-line">
            <LayerLine entity={floor.value} /> ·{" "}
            {isWalkable(world, cell) ? "walkable" : "not walkable"}
          </p>
          {Option.isSome(liquid) ? (
            <p className="floor-line">
              <LayerLine entity={liquid.value} />
            </p>
          ) : null}
        </>
      ) : (
        <p className="quiet">Outside the world: no floor here.</p>
      )}
      {Arr.isReadonlyArrayNonEmpty(entities) ? (
        <ul className="entity-list">
          {Arr.map(entities, (entity) => {
            const { colors, layer, text } = componentsOf(entity);

            return (
              <li key={entity.id}>
                <span className="entity-noun">{nounOf(entity)}</span>
                <span className="quiet">
                  {entity.prefab} · {entity.id}
                  {layer === undefined ? "" : ` · ${layer}`}
                </span>
                {Arr.map(Record.toEntries(colors ?? {}), ([part, shade]) => (
                  <span className="part-color" key={part}>
                    <span
                      className="swatch"
                      style={{ background: palette[shade].hex }}
                    />
                    {part} {shade}
                  </span>
                ))}
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

const PrefabChips = ({
  entities,
  swatches,
}: {
  readonly entities: readonly (typeof Entity.Type)[];
  readonly swatches: boolean;
}) => {
  const counts = countsBy(entities, (entity) => entity.prefab);
  const shown = Arr.take(counts, PREFABS_SHOWN);
  const hidden = counts.length - shown.length;

  const samples = new Map<string, typeof Entity.Type>(
    Arr.map(entities, (entity) => [entity.prefab, entity] as const)
  );

  return Arr.isReadonlyArrayNonEmpty(shown) ? (
    <ul className="chips">
      {Arr.map(shown, ({ count, key }) => {
        const sample = samples.get(key);

        return (
          <li key={key}>
            {swatches && sample !== undefined ? (
              <span
                className="swatch"
                style={{ background: swatchOf(sample) }}
              />
            ) : null}
            {key} <b>{count.toLocaleString()}</b>
          </li>
        );
      })}
      {hidden > 0 ? <li className="quiet">+{hidden} more</li> : null}
    </ul>
  ) : null;
};

const Summary = ({ world }: { readonly world: World }) => {
  const entities = allEntities(world);
  const standing = Arr.filter(entities, isStanding);
  const span = bounds(world);

  return (
    <section className="panel-section">
      <h2>The world</h2>
      {Option.isSome(span) ? (
        <p>
          {cellCount(world).toLocaleString()} cells ·{" "}
          {standing.length.toLocaleString()} entities
          <span className="quiet">
            {" "}
            · x {span.value.minX} to {span.value.maxX}, y {span.value.minY} to{" "}
            {span.value.maxY}
          </span>
        </p>
      ) : (
        <p className="quiet">No floor yet.</p>
      )}
      <PrefabChips
        entities={Arr.filter(
          entities,
          (entity) => isFloor(entity) || isLiquid(entity)
        )}
        swatches
      />
      <PrefabChips entities={standing} swatches={false} />
    </section>
  );
};

const History = ({
  history,
  onPick,
}: {
  readonly history: readonly HistoryEntry[];
  readonly onPick: (cell: typeof Cell.Type) => void;
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
  readonly selected: Option.Option<typeof Cell.Type>;
  readonly onPick: (cell: typeof Cell.Type) => void;
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
