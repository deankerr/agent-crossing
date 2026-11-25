import * as Rivet from "@alchemy.run/rivet";
import * as RivetCloud from "@alchemy.run/rivet/Cloud";
import * as RivetDocker from "@alchemy.run/rivet/Docker";
import { AlchemyContext } from "alchemy/AlchemyContext";
import { Stack } from "alchemy/Stack";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

export const PERSISTENT_STAGE = "persistent";
export const PERSISTENT_CLUSTER = "agent-crossing";
export const REHEARSAL_CLUSTER = "agent-crossing-dev";

export const clusterOf = (stage: string) =>
  stage === PERSISTENT_STAGE ? PERSISTENT_CLUSTER : REHEARSAL_CLUSTER;

/** True under `alchemy dev`, where everything runs on this machine. */
export const local = Effect.map(
  Effect.serviceOption(AlchemyContext),
  Option.exists(({ dev }) => dev)
);

const swarm = RivetDocker.SwarmControlPlane("Rivet");

// WARNING: the Api runs in workerd on the host, outside the swarm's network, so callers need the published port.
const LocalCluster = Layer.effect(
  Rivet.Cluster,
  Effect.gen(function* () {
    const cluster = yield* Rivet.Cluster;

    return { ...cluster, clientEndpoint: cluster.endpoint };
  })
).pipe(Layer.provide(swarm));

const CloudCluster = Layer.unwrap(
  Stack.useSync(({ stage }) =>
    RivetCloud.ControlPlane("Rivet", { cluster: clusterOf(stage) })
  )
);

const LocalPool = RivetDocker.SwarmPool("Default").pipe(
  Layer.provide(LocalCluster)
);

const CloudPool = RivetCloud.Pool("Default").pipe(Layer.provide(CloudCluster));

export const Default = Layer.unwrap<
  Layer.Success<typeof LocalPool>,
  never,
  Layer.Services<typeof LocalPool> | Layer.Services<typeof CloudPool>,
  never,
  never
>(Effect.map(local, (here) => (here ? LocalPool : CloudPool)));
