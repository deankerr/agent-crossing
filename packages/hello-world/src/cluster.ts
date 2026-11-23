import * as RivetCloud from "@alchemy.run/rivet/Cloud";
import * as Layer from "effect/Layer";

export const Cluster = RivetCloud.ControlPlane("Rivet");

export const Default = RivetCloud.Pool("Default").pipe(Layer.provide(Cluster));
