import { describe, expect, it } from "@effect/vitest";
import * as Option from "effect/Option";

import { clearsSelection } from "../src/keys.ts";
import type { KeyTarget } from "../src/keys.ts";

const on = (tagName: string, isContentEditable = false) =>
  Option.some<KeyTarget>({ isContentEditable, tagName });

const press = (
  key: string,
  target: Option.Option<KeyTarget> = on("BODY"),
  isComposing = false
) => ({ isComposing, key, target });

describe(clearsSelection, () => {
  it("clears on Escape anywhere on the page", () => {
    expect(clearsSelection(press("Escape"))).toBeTruthy();
    expect(clearsSelection(press("Escape", Option.none()))).toBeTruthy();
    expect(clearsSelection(press("Escape", on("BUTTON")))).toBeTruthy();
    expect(clearsSelection(press("Escape", on("CANVAS")))).toBeTruthy();
  });

  it("ignores other keys", () => {
    expect(clearsSelection(press("Esc"))).toBeFalsy();
    expect(clearsSelection(press("Enter"))).toBeFalsy();
  });

  it("leaves Escape to fields that take typing", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(clearsSelection(press("Escape", on(tagName)))).toBeFalsy();
    }

    expect(clearsSelection(press("Escape", on("DIV", true)))).toBeFalsy();
  });

  it("leaves Escape to an input method that is composing", () => {
    expect(clearsSelection(press("Escape", Option.none(), true))).toBeFalsy();
  });
});
