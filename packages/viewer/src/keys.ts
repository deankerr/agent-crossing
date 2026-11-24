import * as Option from "effect/Option";

const TEXT_FIELDS = new Set(["INPUT", "SELECT", "TEXTAREA"]);

/** The element a key went to, as far as typing is concerned. */
export interface KeyTarget {
  readonly tagName: string;
  readonly isContentEditable: boolean;
}

/** The parts of a keydown that decide what it means to the viewer. */
export interface KeyPress {
  readonly key: string;
  readonly isComposing: boolean;
  readonly target: Option.Option<KeyTarget>;
}

const takesTyping = (target: KeyTarget) =>
  target.isContentEditable || TEXT_FIELDS.has(target.tagName);

/** Escape clears the selection, unless it belongs to something being typed. */
export const clearsSelection = (press: KeyPress) =>
  press.key === "Escape" &&
  !press.isComposing &&
  !Option.exists(press.target, takesTyping);
