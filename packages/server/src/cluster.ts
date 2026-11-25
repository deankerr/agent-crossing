import * as RivetCloud from "@alchemy.run/rivet/Cloud";
import { Stack } from "alchemy/Stack";
import * as Layer from "effect/Layer";

export const PERSISTENT_STAGE = "persistent";
export const PERSISTENT_CLUSTER = "agent-crossing";
export const DEV_CLUSTER = "agent-crossing-dev";

export const clusterOf = (stage: string) =>
  stage === PERSISTENT_STAGE ? PERSISTENT_CLUSTER : DEV_CLUSTER;

export const Cluster = Layer.unwrap(
  Stack.useSync(({ stage }) =>
    RivetCloud.ControlPlane("Rivet", { cluster: clusterOf(stage) })
  )
);

export const Default = RivetCloud.Pool("Default").pipe(Layer.provide(Cluster));
