import { Html } from "@react-three/drei";
import * as Option from "effect/Option";
import { createContext, use } from "react";
import type { ComponentProps } from "react";

export const OverlayContext = createContext(Option.none<HTMLElement>());

export const Overlay = (props: ComponentProps<typeof Html>) => {
  const overlay = use(OverlayContext);

  return Option.isSome(overlay) ? (
    <Html {...props} portal={{ current: overlay.value }} />
  ) : null;
};
